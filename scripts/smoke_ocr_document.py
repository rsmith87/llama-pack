#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


DEFAULT_DET_MODEL = Path("./models/ocr/pp-ocrv5-server/det")
DEFAULT_REC_MODEL = Path("./models/ocr/pp-ocrv5-server/rec")
DEFAULT_DET_MODEL_NAME = "PP-OCRv5_server_det"
DEFAULT_REC_MODEL_NAME = "PP-OCRv5_server_rec"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"}
PDF_EXTENSIONS = {".pdf"}


class OcrSmokeError(RuntimeError):
    pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a local OCR smoke test against one document.")
    parser.add_argument("--file", required=True, help="Image or PDF file to OCR.")
    parser.add_argument(
        "--engine",
        choices=["tesseract", "paddleocr"],
        default="tesseract",
        help="OCR engine to use.",
    )
    parser.add_argument("--det-model", default=str(DEFAULT_DET_MODEL), help="PaddleOCR detection model directory.")
    parser.add_argument("--rec-model", default=str(DEFAULT_REC_MODEL), help="PaddleOCR recognition model directory.")
    parser.add_argument("--det-model-name", default=DEFAULT_DET_MODEL_NAME, help="PaddleOCR detection model name.")
    parser.add_argument("--rec-model-name", default=DEFAULT_REC_MODEL_NAME, help="PaddleOCR recognition model name.")
    parser.add_argument("--pdf-page", type=int, default=0, help="Zero-based PDF page index to render for OCR.")
    parser.add_argument("--pdf-scale", type=float, default=2.0, help="PDF render scale used before OCR.")
    parser.add_argument("--json", action="store_true", help="Print structured JSON instead of a text report.")
    return parser


def require_existing_file(path: Path) -> None:
    if not path.exists():
        raise OcrSmokeError(f"OCR input file does not exist: {path}")
    if not path.is_file():
        raise OcrSmokeError(f"OCR input path is not a file: {path}")


def require_existing_directory(path: Path, label: str) -> None:
    if not path.exists():
        raise OcrSmokeError(f"{label} model directory does not exist: {path}")
    if not path.is_dir():
        raise OcrSmokeError(f"{label} model path is not a directory: {path}")


def require_command(command: str) -> str:
    resolved = shutil.which(command)
    if resolved is None:
        raise OcrSmokeError(f"Required command is not installed or not on PATH: {command}")
    return resolved


def render_pdf_page(pdf_path: Path, page_index: int, scale: float, output_dir: Path) -> Path:
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise OcrSmokeError(
            "pypdfium2 is required to smoke-test PDF OCR. Install it in the project environment."
        ) from exc

    if page_index < 0:
        raise OcrSmokeError(f"PDF page index must be non-negative: {page_index}")
    if scale <= 0:
        raise OcrSmokeError(f"PDF render scale must be positive: {scale}")

    document = pdfium.PdfDocument(str(pdf_path))
    page_count = len(document)
    if page_index >= page_count:
        raise OcrSmokeError(f"PDF page index {page_index} is out of range for {page_count} pages")

    page = document[page_index]
    bitmap = page.render(scale=scale)
    try:
        image = bitmap.to_pil()
    except ImportError as exc:
        raise OcrSmokeError(
            "Pillow is required to render PDF pages for OCR. Install it in the OCR Python environment with `pip install pillow`."
        ) from exc
    output_path = output_dir / f"{pdf_path.stem}-page-{page_index + 1}.png"
    image.save(output_path)
    return output_path


def render_pdf_page_with_pdftoppm(pdf_path: Path, page_index: int, output_dir: Path) -> Path:
    if page_index < 0:
        raise OcrSmokeError(f"PDF page index must be non-negative: {page_index}")
    pdftoppm = require_command("pdftoppm")
    output_prefix = output_dir / f"{pdf_path.stem}-page"
    page_number = page_index + 1
    result = subprocess.run(
        [
            pdftoppm,
            "-png",
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-singlefile",
            str(pdf_path),
            str(output_prefix),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise OcrSmokeError(f"pdftoppm failed with exit code {result.returncode}: {result.stderr.strip()}")
    output_path = output_prefix.with_suffix(".png")
    if not output_path.exists():
        raise OcrSmokeError(f"pdftoppm did not produce expected image: {output_path}")
    return output_path


def image_path_for_ocr(
    input_path: Path,
    page_index: int,
    scale: float,
    output_dir: Path,
    engine: str,
) -> Path:
    extension = input_path.suffix.lower()
    if extension in IMAGE_EXTENSIONS:
        return input_path
    if extension in PDF_EXTENSIONS:
        if engine == "tesseract":
            return render_pdf_page_with_pdftoppm(input_path, page_index, output_dir)
        return render_pdf_page(input_path, page_index, scale, output_dir)
    raise OcrSmokeError(f"Unsupported OCR smoke input type: {input_path.name}")


def create_paddle_ocr(det_model: Path, rec_model: Path, det_model_name: str, rec_model_name: str) -> Any:
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise OcrSmokeError(
            "paddleocr is required for OCR smoke testing. Install PaddleOCR and PaddlePaddle in a "
            "Python 3.11-3.13 environment; PaddlePaddle does not currently provide CPython 3.14 wheels."
        ) from exc

    try:
        return PaddleOCR(
            text_detection_model_name=det_model_name,
            text_detection_model_dir=str(det_model),
            text_recognition_model_name=rec_model_name,
            text_recognition_model_dir=str(rec_model),
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    except TypeError:
        return PaddleOCR(
            det_model_dir=str(det_model),
            rec_model_dir=str(rec_model),
            use_angle_cls=False,
        )


def collect_text_items(raw_result: Any) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if isinstance(raw_result, list):
        for entry in raw_result:
            items.extend(collect_text_items(entry))
        return items
    if isinstance(raw_result, tuple) and len(raw_result) >= 2:
        text_payload = raw_result[1]
        if isinstance(text_payload, tuple) and len(text_payload) >= 2:
            items.append({"text": str(text_payload[0]), "confidence": float(text_payload[1])})
        return items
    if isinstance(raw_result, dict):
        texts = raw_result.get("rec_texts")
        scores = raw_result.get("rec_scores")
        if isinstance(texts, list):
            for index, text in enumerate(texts):
                confidence = None
                if isinstance(scores, list) and index < len(scores):
                    confidence = float(scores[index])
                items.append({"text": str(text), "confidence": confidence})
        return items
    return items


def run_ocr(
    image_path: Path,
    det_model: Path,
    rec_model: Path,
    det_model_name: str,
    rec_model_name: str,
) -> list[dict[str, Any]]:
    ocr = create_paddle_ocr(det_model, rec_model, det_model_name, rec_model_name)
    if hasattr(ocr, "predict"):
        raw_result = ocr.predict(str(image_path))
    else:
        raw_result = ocr.ocr(str(image_path), cls=False)
    return collect_text_items(raw_result)


def run_tesseract(image_path: Path) -> str:
    tesseract = require_command("tesseract")
    result = subprocess.run(
        [tesseract, str(image_path), "stdout"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise OcrSmokeError(f"tesseract failed with exit code {result.returncode}: {result.stderr.strip()}")
    return result.stdout.strip()


def print_report(input_path: Path, ocr_image_path: Path, items: list[dict[str, Any]], as_json: bool) -> None:
    if as_json:
        print(json.dumps({"file": str(input_path), "ocr_image": str(ocr_image_path), "items": items}, indent=2))
        return

    print(f"Input: {input_path}")
    print(f"OCR image: {ocr_image_path}")
    print(f"Detected text lines: {len(items)}")
    for item in items:
        confidence = item.get("confidence")
        suffix = f" ({confidence:.3f})" if isinstance(confidence, float) else ""
        print(f"- {item['text']}{suffix}")


def print_tesseract_report(input_path: Path, ocr_image_path: Path, text: str, as_json: bool) -> None:
    if as_json:
        print(json.dumps({"file": str(input_path), "ocr_image": str(ocr_image_path), "text": text}, indent=2))
        return

    print(f"Input: {input_path}")
    print(f"OCR image: {ocr_image_path}")
    print("Detected text:")
    print(text)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    input_path = Path(args.file)
    det_model = Path(args.det_model)
    rec_model = Path(args.rec_model)

    try:
        require_existing_file(input_path)
        if args.engine == "paddleocr":
            require_existing_directory(det_model, "Detection")
            require_existing_directory(rec_model, "Recognition")
        with tempfile.TemporaryDirectory(prefix="llama-pack-ocr-smoke-") as tmp:
            ocr_image_path = image_path_for_ocr(input_path, args.pdf_page, args.pdf_scale, Path(tmp), args.engine)
            if args.engine == "tesseract":
                text = run_tesseract(ocr_image_path)
                print_tesseract_report(input_path, ocr_image_path, text, args.json)
            else:
                items = run_ocr(ocr_image_path, det_model, rec_model, args.det_model_name, args.rec_model_name)
                print_report(input_path, ocr_image_path, items, args.json)
    except OcrSmokeError as exc:
        parser.exit(2, f"ERROR: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
