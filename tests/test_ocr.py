from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from llama_pack.api.routes import ocr as ocr_routes
from llama_pack.core.ocr import (
    OcrEngineConfig,
    OcrEngineError,
    OcrInputError,
    OcrRequest,
    OcrResult,
    OcrService,
    OcrTextItem,
    PaddleOcrModelConfig,
)


class RecordingRunner:
    def __init__(self, result: OcrResult) -> None:
        self.result = result
        self.calls: list[tuple[Path, OcrEngineConfig]] = []

    def ocr_image(self, image_path: Path, config: OcrEngineConfig) -> OcrResult:
        self.calls.append((image_path, config))
        return self.result


class RecordingPdfRenderer:
    def __init__(self, rendered_path: Path) -> None:
        self.rendered_path = rendered_path
        self.calls: list[tuple[Path, int, float, Path]] = []

    def render_page(self, pdf_path: Path, page_index: int, scale: float, output_dir: Path) -> Path:
        self.calls.append((pdf_path, page_index, scale, output_dir))
        return self.rendered_path


def test_ocr_service_ocr_uploaded_image_with_explicit_tesseract_config(tmp_path: Path) -> None:
    image_path = tmp_path / "invoice.png"
    image_path.write_bytes(b"fake-image")
    expected = OcrResult(
        source_path=image_path,
        ocr_image_path=image_path,
        engine="tesseract",
        text="Invoice 123",
        items=[OcrTextItem(text="Invoice 123", confidence=None)],
    )
    runner = RecordingRunner(expected)
    service = OcrService(
        runner=runner,
        pdf_renderer=RecordingPdfRenderer(tmp_path / "unused.png"),
        render_dir=tmp_path / "ocr",
    )
    config = OcrEngineConfig(engine="tesseract", paddleocr=None)

    result = service.ocr_file(OcrRequest(file_path=image_path, pdf_page=None, pdf_scale=2.0, engine=config))

    assert result == expected
    assert runner.calls == [(image_path, config)]


def test_ocr_service_renders_requested_pdf_page_before_ocr(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    rendered_path = tmp_path / "invoice-page-2.png"
    pdf_path.write_bytes(b"%PDF-1.4\n")
    rendered_path.write_bytes(b"fake-rendered-page")
    expected = OcrResult(
        source_path=pdf_path,
        ocr_image_path=rendered_path,
        engine="paddleocr",
        text="Page two",
        items=[OcrTextItem(text="Page two", confidence=0.91)],
    )
    runner = RecordingRunner(expected)
    renderer = RecordingPdfRenderer(rendered_path)
    service = OcrService(runner=runner, pdf_renderer=renderer, render_dir=tmp_path / "ocr")
    config = OcrEngineConfig(
        engine="paddleocr",
        paddleocr=PaddleOcrModelConfig(
            det_model=tmp_path / "det",
            rec_model=tmp_path / "rec",
            det_model_name="PP-OCRv5_server_det",
            rec_model_name="PP-OCRv5_server_rec",
        ),
    )

    result = service.ocr_file(OcrRequest(file_path=pdf_path, pdf_page=1, pdf_scale=3.0, engine=config))

    assert result == expected
    assert renderer.calls == [(pdf_path, 1, 3.0, service.render_dir)]
    assert runner.calls == [(rendered_path, config)]


def test_ocr_service_rejects_pdf_without_page(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")
    service = OcrService(
        runner=RecordingRunner(
            OcrResult(source_path=pdf_path, ocr_image_path=pdf_path, engine="tesseract", text="", items=[])
        ),
        pdf_renderer=RecordingPdfRenderer(tmp_path / "unused.png"),
        render_dir=tmp_path / "ocr",
    )

    with pytest.raises(OcrInputError, match="pdf_page is required"):
        service.ocr_file(
            OcrRequest(
                file_path=pdf_path,
                pdf_page=None,
                pdf_scale=2.0,
                engine=OcrEngineConfig(engine="tesseract", paddleocr=None),
            )
        )


def test_ocr_route_returns_clear_error_for_unsupported_upload(tmp_path: Path) -> None:
    app = FastAPI()
    app.state.ocr_service = OcrService(
        runner=RecordingRunner(
            OcrResult(
                source_path=tmp_path / "unused.txt",
                ocr_image_path=tmp_path / "unused.txt",
                engine="tesseract",
                text="",
                items=[],
            )
        ),
        pdf_renderer=RecordingPdfRenderer(tmp_path / "unused.png"),
        render_dir=tmp_path / "ocr",
    )
    app.include_router(ocr_routes.router, prefix="/lm-api/v1")
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/ocr/files",
        data={"engine": "tesseract", "pdf_scale": "2.0"},
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": (
            "Unsupported OCR input type for notes.txt. Supported extensions: "
            ".bmp, .jpeg, .jpg, .pdf, .png, .tif, .tiff, .webp"
        )
    }


def test_ocr_route_returns_clear_error_when_engine_fails(tmp_path: Path) -> None:
    class FailingService:
        def ocr_file(self, request: OcrRequest) -> OcrResult:
            raise OcrEngineError(f"tesseract failed for image {request.file_path}: missing language data")

    app = FastAPI()
    app.state.ocr_service = FailingService()
    app.include_router(ocr_routes.router, prefix="/lm-api/v1")
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/ocr/files",
        data={"engine": "tesseract", "pdf_scale": "2.0"},
        files={"file": ("invoice.png", b"fake-image", "image/png")},
    )

    assert response.status_code == 502
    assert response.json()["detail"].startswith("tesseract failed for image")
    assert "missing language data" in response.json()["detail"]


def test_ocr_route_ocr_uploaded_image(tmp_path: Path) -> None:
    class CapturingService:
        def __init__(self) -> None:
            self.requests: list[OcrRequest] = []

        def ocr_file(self, request: OcrRequest) -> OcrResult:
            self.requests.append(request)
            return OcrResult(
                source_path=request.file_path,
                ocr_image_path=request.file_path,
                engine=request.engine.engine,
                text="Uploaded invoice",
                items=[OcrTextItem(text="Uploaded invoice", confidence=None)],
            )

    service = CapturingService()
    app = FastAPI()
    app.state.ocr_service = service
    app.include_router(ocr_routes.router, prefix="/lm-api/v1")
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/ocr/files",
        data={"engine": "tesseract", "pdf_scale": "2.0"},
        files={"file": ("invoice.png", b"fake-image", "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["text"] == "Uploaded invoice"
    assert response.json()["engine"] == "tesseract"
    assert service.requests[0].file_path.name == "invoice.png"
    assert service.requests[0].engine == OcrEngineConfig(engine="tesseract", paddleocr=None)
