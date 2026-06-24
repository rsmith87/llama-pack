from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from llama_pack.api.dependencies import get_ocr_service
from llama_pack.core.ocr import (
    OcrEngine,
    OcrEngineConfig,
    OcrEngineError,
    OcrInputError,
    OcrRequest,
    OcrResult,
    OcrService,
    PaddleOcrModelConfig,
)


router = APIRouter(prefix="/ocr")


@router.post("/files")
async def ocr_uploaded_file(
    file: UploadFile = File(...),
    engine: OcrEngine = Form(...),
    pdf_scale: float = Form(...),
    pdf_page: int | None = Form(None),
    det_model: str | None = Form(None),
    rec_model: str | None = Form(None),
    det_model_name: str | None = Form(None),
    rec_model_name: str | None = Form(None),
    service: OcrService = Depends(get_ocr_service),
) -> OcrResult:
    try:
        engine_config = _engine_config(engine, det_model, rec_model, det_model_name, rec_model_name)
        with tempfile.TemporaryDirectory(prefix="llama-pack-ocr-upload-") as tmp:
            upload_path = Path(tmp) / Path(file.filename or "upload").name
            upload_path.write_bytes(await file.read())
            return service.ocr_file(
                OcrRequest(
                    file_path=upload_path,
                    pdf_page=pdf_page,
                    pdf_scale=pdf_scale,
                    engine=engine_config,
                )
            )
    except OcrInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OcrEngineError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _engine_config(
    engine: OcrEngine,
    det_model: str | None,
    rec_model: str | None,
    det_model_name: str | None,
    rec_model_name: str | None,
) -> OcrEngineConfig:
    if engine == "tesseract":
        return OcrEngineConfig(engine=engine, paddleocr=None)
    missing = [
        field_name
        for field_name, value in (
            ("det_model", det_model),
            ("rec_model", rec_model),
            ("det_model_name", det_model_name),
            ("rec_model_name", rec_model_name),
        )
        if value is None or value == ""
    ]
    if missing:
        raise OcrInputError(
            f"PaddleOCR request is missing required model configuration fields: {', '.join(missing)}"
        )
    return OcrEngineConfig(
        engine=engine,
        paddleocr=PaddleOcrModelConfig(
            det_model=Path(str(det_model)),
            rec_model=Path(str(rec_model)),
            det_model_name=str(det_model_name),
            rec_model_name=str(rec_model_name),
        ),
    )
