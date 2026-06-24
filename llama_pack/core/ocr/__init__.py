from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict


OcrEngine = Literal["tesseract", "paddleocr"]
IMAGE_EXTENSIONS: frozenset[str] = frozenset({".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"})
PDF_EXTENSIONS: frozenset[str] = frozenset({".pdf"})


class OcrError(RuntimeError):
    pass


class OcrInputError(OcrError):
    pass


class OcrEngineError(OcrError):
    pass


class PaddleOcrModelConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    det_model: Path
    rec_model: Path
    det_model_name: str
    rec_model_name: str


class OcrEngineConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    engine: OcrEngine
    paddleocr: PaddleOcrModelConfig | None


class OcrRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    file_path: Path
    pdf_page: int | None
    pdf_scale: float
    engine: OcrEngineConfig


class OcrTextItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    text: str
    confidence: float | None


class OcrResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_path: Path
    ocr_image_path: Path
    engine: OcrEngine
    text: str
    items: list[OcrTextItem]


class PdfPageRenderer:
    def render_page(self, pdf_path: Path, page_index: int, scale: float, output_dir: Path) -> Path:
        if page_index < 0:
            raise OcrInputError(f"PDF page index must be non-negative: {page_index}")
        if scale <= 0:
            raise OcrInputError(f"PDF render scale must be positive: {scale}")
        try:
            import pypdfium2 as pdfium
        except ImportError as exc:
            raise OcrEngineError("pypdfium2 is required to render PDF pages for OCR") from exc

        output_dir.mkdir(parents=True, exist_ok=True)
        document = pdfium.PdfDocument(str(pdf_path))
        page_count = len(document)
        if page_index >= page_count:
            raise OcrInputError(f"PDF page index {page_index} is out of range for {page_count} pages")

        page = document[page_index]
        bitmap = page.render(scale=scale)
        try:
            image = bitmap.to_pil()
        except ImportError as exc:
            raise OcrEngineError("Pillow is required to render PDF pages for OCR") from exc
        output_path = output_dir / f"{pdf_path.stem}-page-{page_index + 1}.png"
        image.save(output_path)
        return output_path


class OcrRunner:
    def ocr_image(self, image_path: Path, config: OcrEngineConfig) -> OcrResult:
        if config.engine == "tesseract":
            return self._run_tesseract(image_path)
        if config.paddleocr is None:
            raise OcrInputError("PaddleOCR model configuration is required when engine is paddleocr")
        return self._run_paddleocr(image_path, config.paddleocr)

    def _run_tesseract(self, image_path: Path) -> OcrResult:
        tesseract = shutil.which("tesseract")
        if tesseract is None:
            raise OcrEngineError("Required command is not installed or not on PATH: tesseract")
        result = subprocess.run([tesseract, str(image_path), "stdout"], capture_output=True, text=True)
        if result.returncode != 0:
            raise OcrEngineError(
                f"tesseract failed with exit code {result.returncode} for image {image_path}: {result.stderr.strip()}"
            )
        text = result.stdout.strip()
        items = [OcrTextItem(text=text, confidence=None)] if text else []
        return OcrResult(source_path=image_path, ocr_image_path=image_path, engine="tesseract", text=text, items=items)

    def _run_paddleocr(self, image_path: Path, config: PaddleOcrModelConfig) -> OcrResult:
        _require_directory(config.det_model, "Detection")
        _require_directory(config.rec_model, "Recognition")
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise OcrEngineError("paddleocr is required when engine is paddleocr") from exc

        try:
            paddle_ocr = PaddleOCR(
                text_detection_model_name=config.det_model_name,
                text_detection_model_dir=str(config.det_model),
                text_recognition_model_name=config.rec_model_name,
                text_recognition_model_dir=str(config.rec_model),
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        except TypeError:
            paddle_ocr = PaddleOCR(
                det_model_dir=str(config.det_model),
                rec_model_dir=str(config.rec_model),
                use_angle_cls=False,
            )

        raw_result = (
            paddle_ocr.predict(str(image_path))
            if hasattr(paddle_ocr, "predict")
            else paddle_ocr.ocr(str(image_path), cls=False)
        )
        items = _collect_paddle_text_items(raw_result)
        text = "\n".join(item.text for item in items)
        return OcrResult(source_path=image_path, ocr_image_path=image_path, engine="paddleocr", text=text, items=items)


class OcrService:
    def __init__(self, runner: OcrRunner, pdf_renderer: PdfPageRenderer, render_dir: Path) -> None:
        self.runner = runner
        self.pdf_renderer = pdf_renderer
        self.render_dir = render_dir

    def ocr_file(self, request: OcrRequest) -> OcrResult:
        _require_file(request.file_path)
        ocr_image_path = self._ocr_image_path(request)
        result = self.runner.ocr_image(ocr_image_path, request.engine)
        return result.model_copy(update={"source_path": request.file_path, "ocr_image_path": ocr_image_path})

    def _ocr_image_path(self, request: OcrRequest) -> Path:
        extension = request.file_path.suffix.lower()
        if extension in IMAGE_EXTENSIONS:
            return request.file_path
        if extension in PDF_EXTENSIONS:
            if request.pdf_page is None:
                raise OcrInputError("pdf_page is required when OCR input is a PDF")
            return self.pdf_renderer.render_page(request.file_path, request.pdf_page, request.pdf_scale, self.render_dir)
        extensions = ", ".join(sorted([*IMAGE_EXTENSIONS, *PDF_EXTENSIONS]))
        raise OcrInputError(
            f"Unsupported OCR input type for {request.file_path.name}. Supported extensions: {extensions}"
        )


def create_ocr_service(render_dir: Path) -> OcrService:
    return OcrService(runner=OcrRunner(), pdf_renderer=PdfPageRenderer(), render_dir=render_dir)


def _require_file(path: Path) -> None:
    if not path.exists():
        raise OcrInputError(f"OCR input file does not exist: {path}")
    if not path.is_file():
        raise OcrInputError(f"OCR input path is not a file: {path}")


def _require_directory(path: Path, label: str) -> None:
    if not path.exists():
        raise OcrInputError(f"{label} model directory does not exist: {path}")
    if not path.is_dir():
        raise OcrInputError(f"{label} model path is not a directory: {path}")


def _collect_paddle_text_items(raw_result: object) -> list[OcrTextItem]:
    items: list[OcrTextItem] = []
    if isinstance(raw_result, list):
        for entry in raw_result:
            items.extend(_collect_paddle_text_items(entry))
        return items
    if isinstance(raw_result, tuple) and len(raw_result) >= 2:
        text_payload = raw_result[1]
        if isinstance(text_payload, tuple) and len(text_payload) >= 2:
            items.append(OcrTextItem(text=str(text_payload[0]), confidence=float(text_payload[1])))
        return items
    if isinstance(raw_result, dict):
        texts = raw_result.get("rec_texts")
        scores = raw_result.get("rec_scores")
        if isinstance(texts, list):
            for index, text in enumerate(texts):
                confidence = None
                if isinstance(scores, list) and index < len(scores):
                    confidence = float(scores[index])
                items.append(OcrTextItem(text=str(text), confidence=confidence))
        return items
    return items
