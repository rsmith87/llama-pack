#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import tempfile
import time
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict

from llama_pack.core.ocr import (
    OcrEngineConfig,
    OcrError,
    OcrRequest,
    PaddleOcrModelConfig,
    create_ocr_service,
)


CandidateKind = Literal["shared-ocr-service", "paddleocr-vl"]


class SharedOcrCandidateConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    engine: str
    det_model: str | None
    rec_model: str | None
    det_model_name: str | None
    rec_model_name: str | None


class OcrCandidate(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    label: str
    kind: CandidateKind
    integration_status: str
    repo_install: list[str]
    model_install: list[str]
    shared_ocr_config: SharedOcrCandidateConfig | None
    required_repo_config: dict[str, str]
    decision_notes: list[str]


class EvaluationResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    candidate_id: str
    file: str
    ok: bool
    elapsed_seconds: float
    text_chars: int
    item_count: int
    error: str | None


class EvaluationDocument(BaseModel):
    model_config = ConfigDict(frozen=True)

    recommendation: str
    files: list[str]
    pdf_page: int
    pdf_scale: float
    candidates: list[OcrCandidate]
    results: list[EvaluationResult]


DEFAULT_PDF_PAGE = 0
DEFAULT_PDF_SCALE = 2.0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compare the current shared OCR baseline against the smallest PaddleOCR candidates."
    )
    parser.add_argument("--file", action="append", required=True, help="Image or PDF file to evaluate.")
    parser.add_argument("--pdf-page", type=int, default=DEFAULT_PDF_PAGE, help="Zero-based PDF page index.")
    parser.add_argument("--pdf-scale", type=float, default=DEFAULT_PDF_SCALE, help="PDF render scale.")
    parser.add_argument(
        "--candidate",
        action="append",
        choices=["tesseract-baseline", "ppocrv5-server"],
        help="Runnable shared-service candidate to execute. Repeat for multiple candidates.",
    )
    parser.add_argument("--config-only", action="store_true", help="Print candidate config without running OCR.")
    return parser


def build_candidates() -> list[OcrCandidate]:
    return [
        OcrCandidate(
            id="tesseract-baseline",
            label="Tesseract through the shared OCR service",
            kind="shared-ocr-service",
            integration_status="runnable-now",
            repo_install=["brew install tesseract", "apt-get install -y tesseract-ocr"],
            model_install=[],
            shared_ocr_config=SharedOcrCandidateConfig(
                engine="tesseract",
                det_model=None,
                rec_model=None,
                det_model_name=None,
                rec_model_name=None,
            ),
            required_repo_config={"engine": "tesseract"},
            decision_notes=[
                "Keep as the default baseline because it has the smallest runtime footprint and is already wired.",
                "Expected to lose on complex layouts, tables, stamps, rotated scans, and multilingual documents.",
            ],
        ),
        OcrCandidate(
            id="ppocrv5-server",
            label="PP-OCRv5 server detection and recognition through the shared OCR service",
            kind="shared-ocr-service",
            integration_status="runnable-after-model-install",
            repo_install=["uv add paddleocr paddlepaddle"],
            model_install=["scripts/install_ocr_model.sh"],
            shared_ocr_config=SharedOcrCandidateConfig(
                engine="paddleocr",
                det_model="models/ocr/pp-ocrv5-server/det",
                rec_model="models/ocr/pp-ocrv5-server/rec",
                det_model_name="PP-OCRv5_server_det",
                rec_model_name="PP-OCRv5_server_rec",
            ),
            required_repo_config={
                "engine": "paddleocr",
                "det_model": "models/ocr/pp-ocrv5-server/det",
                "rec_model": "models/ocr/pp-ocrv5-server/rec",
                "det_model_name": "PP-OCRv5_server_det",
                "rec_model_name": "PP-OCRv5_server_rec",
            },
            decision_notes=[
                "This is the smallest standardized upgrade that fits the current OcrEngineConfig shape.",
                "Use it as the first challenger before adding a VLM parser path.",
            ],
        ),
        OcrCandidate(
            id="paddleocr-vl-0.9b",
            label="PaddleOCR-VL 0.9B document parser",
            kind="paddleocr-vl",
            integration_status="requires-new-paddleocr-vl-runner",
            repo_install=["uv add paddleocr paddlepaddle"],
            model_install=["Install the PaddleOCR-VL-0.9B model under models/ocr/paddleocr-vl-0.9b"],
            shared_ocr_config=None,
            required_repo_config={
                "engine": "paddleocr-vl",
                "model_dir": "models/ocr/paddleocr-vl-0.9b",
                "model_name": "PaddleOCR-VL-0.9B",
            },
            decision_notes=[
                "Smallest VLM candidate reported by PaddleOCR-VL.",
                "Not compatible with the current det_model/rec_model service contract.",
            ],
        ),
        OcrCandidate(
            id="paddleocr-vl-1.5",
            label="PaddleOCR-VL 1.5 0.9B document parser",
            kind="paddleocr-vl",
            integration_status="requires-new-paddleocr-vl-runner",
            repo_install=["uv add paddleocr paddlepaddle"],
            model_install=["Install the PaddleOCR-VL-1.5 model under models/ocr/paddleocr-vl-1.5"],
            shared_ocr_config=None,
            required_repo_config={
                "engine": "paddleocr-vl",
                "model_dir": "models/ocr/paddleocr-vl-1.5",
                "model_name": "PaddleOCR-VL-1.5",
            },
            decision_notes=[
                "Updated 0.9B VLM with better robustness claims than the original 0.9B release.",
                "Use only if local layout-quality wins justify adding a second OCR integration contract.",
            ],
        ),
        OcrCandidate(
            id="paddleocr-vl-1.6",
            label="PaddleOCR-VL 1.6 0.9B document parser",
            kind="paddleocr-vl",
            integration_status="requires-new-paddleocr-vl-runner",
            repo_install=["uv add paddleocr paddlepaddle"],
            model_install=["Install the PaddleOCR-VL-1.6 model under models/ocr/paddleocr-vl-1.6"],
            shared_ocr_config=None,
            required_repo_config={
                "engine": "paddleocr-vl",
                "model_dir": "models/ocr/paddleocr-vl-1.6",
                "model_name": "PaddleOCR-VL-1.6",
            },
            decision_notes=[
                "Most recent smallest PaddleOCR-VL candidate identified for this decision.",
                "Treat as the preferred VLM challenger once a PaddleOCR-VL runner exists.",
            ],
        ),
    ]


def runnable_candidate_ids(args_candidate: list[str] | None) -> list[str]:
    if args_candidate is None:
        return ["tesseract-baseline", "ppocrv5-server"]
    return args_candidate


def engine_config(candidate: OcrCandidate) -> OcrEngineConfig:
    config = candidate.shared_ocr_config
    if config is None:
        raise ValueError(f"Candidate is not runnable through shared OCR service: {candidate.id}")
    if config.engine == "tesseract":
        return OcrEngineConfig(engine="tesseract", paddleocr=None)
    if (
        config.det_model is None
        or config.rec_model is None
        or config.det_model_name is None
        or config.rec_model_name is None
    ):
        raise ValueError(f"PaddleOCR candidate is missing required model fields: {candidate.id}")
    return OcrEngineConfig(
        engine="paddleocr",
        paddleocr=PaddleOcrModelConfig(
            det_model=Path(config.det_model),
            rec_model=Path(config.rec_model),
            det_model_name=config.det_model_name,
            rec_model_name=config.rec_model_name,
        ),
    )


def evaluate_candidate(candidate: OcrCandidate, file_path: Path, pdf_page: int, pdf_scale: float) -> EvaluationResult:
    start = time.monotonic()
    try:
        with tempfile.TemporaryDirectory(prefix="llama-pack-ocr-eval-") as tmp:
            service = create_ocr_service(Path(tmp))
            result = service.ocr_file(
                OcrRequest(
                    file_path=file_path,
                    pdf_page=pdf_page if file_path.suffix.lower() == ".pdf" else None,
                    pdf_scale=pdf_scale,
                    engine=engine_config(candidate),
                )
            )
        elapsed_seconds = time.monotonic() - start
        return EvaluationResult(
            candidate_id=candidate.id,
            file=str(file_path),
            ok=True,
            elapsed_seconds=elapsed_seconds,
            text_chars=len(result.text),
            item_count=len(result.items),
            error=None,
        )
    except (OcrError, ValueError) as exc:
        elapsed_seconds = time.monotonic() - start
        return EvaluationResult(
            candidate_id=candidate.id,
            file=str(file_path),
            ok=False,
            elapsed_seconds=elapsed_seconds,
            text_chars=0,
            item_count=0,
            error=str(exc),
        )


def build_document(
    files: list[Path],
    pdf_page: int,
    pdf_scale: float,
    config_only: bool,
    selected_candidate_ids: list[str],
) -> EvaluationDocument:
    candidates = build_candidates()
    by_id = {candidate.id: candidate for candidate in candidates}
    missing = [candidate_id for candidate_id in selected_candidate_ids if candidate_id not in by_id]
    if missing:
        raise ValueError(f"Unknown OCR candidate IDs: {', '.join(missing)}")
    results: list[EvaluationResult] = []
    if not config_only:
        for candidate_id in selected_candidate_ids:
            candidate = by_id[candidate_id]
            for file_path in files:
                results.append(evaluate_candidate(candidate, file_path, pdf_page, pdf_scale))
    return EvaluationDocument(
        recommendation="stay-tesseract-first-until-local-paddleocr-vl-benchmark-wins",
        files=[str(file_path) for file_path in files],
        pdf_page=pdf_page,
        pdf_scale=pdf_scale,
        candidates=candidates,
        results=results,
    )


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    files = [Path(file_name) for file_name in args.file]
    try:
        document = build_document(
            files=files,
            pdf_page=args.pdf_page,
            pdf_scale=args.pdf_scale,
            config_only=args.config_only,
            selected_candidate_ids=runnable_candidate_ids(args.candidate),
        )
    except ValueError as exc:
        parser.exit(2, f"ERROR: {exc}\n")
    print(json.dumps(document.model_dump(mode="json"), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
