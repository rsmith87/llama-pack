#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

from llama_pack.core.ocr import (
    OcrEngineConfig,
    OcrError,
    OcrRequest,
    PaddleOcrModelConfig,
    create_ocr_service,
)


DEFAULT_DET_MODEL = Path("./models/ocr/pp-ocrv5-server/det")
DEFAULT_REC_MODEL = Path("./models/ocr/pp-ocrv5-server/rec")
DEFAULT_DET_MODEL_NAME = "PP-OCRv5_server_det"
DEFAULT_REC_MODEL_NAME = "PP-OCRv5_server_rec"


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


def build_engine_config(
    engine: str,
    det_model: Path,
    rec_model: Path,
    det_model_name: str,
    rec_model_name: str,
) -> OcrEngineConfig:
    if engine == "tesseract":
        return OcrEngineConfig(engine="tesseract", paddleocr=None)
    return OcrEngineConfig(
        engine="paddleocr",
        paddleocr=PaddleOcrModelConfig(
            det_model=det_model,
            rec_model=rec_model,
            det_model_name=det_model_name,
            rec_model_name=rec_model_name,
        ),
    )


def print_report(result, as_json: bool) -> None:
    if as_json:
        print(
            json.dumps(
                {
                    "file": str(result.source_path),
                    "ocr_image": str(result.ocr_image_path),
                    "engine": result.engine,
                    "text": result.text,
                    "items": [item.model_dump(mode="json") for item in result.items],
                },
                indent=2,
            )
        )
        return

    print(f"Input: {result.source_path}")
    print(f"OCR image: {result.ocr_image_path}")
    print(f"Engine: {result.engine}")
    if result.engine == "tesseract":
        print("Detected text:")
        print(result.text)
        return
    print(f"Detected text lines: {len(result.items)}")
    for item in result.items:
        suffix = f" ({item.confidence:.3f})" if isinstance(item.confidence, float) else ""
        print(f"- {item.text}{suffix}")


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    input_path = Path(args.file)
    engine_config = build_engine_config(
        args.engine,
        Path(args.det_model),
        Path(args.rec_model),
        args.det_model_name,
        args.rec_model_name,
    )

    try:
        with tempfile.TemporaryDirectory(prefix="llama-pack-ocr-smoke-") as tmp:
            service = create_ocr_service(Path(tmp))
            result = service.ocr_file(
                OcrRequest(
                    file_path=input_path,
                    pdf_page=args.pdf_page if input_path.suffix.lower() == ".pdf" else None,
                    pdf_scale=args.pdf_scale,
                    engine=engine_config,
                )
            )
            print_report(result, args.json)
    except OcrError as exc:
        parser.exit(2, f"ERROR: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
