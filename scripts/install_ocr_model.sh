#!/usr/bin/env bash
# Downloads the default PaddleOCR model pair used for business document OCR.
# Requires internet access on first run; model files are cached locally after that.
#
# Usage:
#   ./scripts/install_ocr_model.sh
#   ./scripts/install_ocr_model.sh ./custom/ocr/model/path

set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "ERROR: Expected zero or one argument: target directory" >&2
  exit 2
fi

if [[ $# -eq 1 ]]; then
  MODEL_DIR="$1"
else
  MODEL_DIR="./models/ocr/pp-ocrv5-server"
fi

DET_REPO="PaddlePaddle/PP-OCRv5_server_det"
REC_REPO="PaddlePaddle/PP-OCRv5_server_rec"

echo "Installing OCR models:"
echo "  detector:   $DET_REPO"
echo "  recognizer: $REC_REPO"
echo "Target directory: $MODEL_DIR"

uv run python - "$MODEL_DIR" "$DET_REPO" "$REC_REPO" <<'PY'
from __future__ import annotations

import sys
from pathlib import Path


def populated_directory(path: Path) -> bool:
    return path.exists() and any(path.iterdir())


def download_repo(repo_id: str, target_dir: Path) -> Path:
    if populated_directory(target_dir):
        print(f"Model already present at {target_dir}, skipping download.")
        return target_dir

    try:
        from huggingface_hub import snapshot_download
    except ImportError as exc:
        raise RuntimeError(
            "huggingface_hub is not installed. Run this script through the project "
            "environment with `uv run`, or install project dependencies with `uv sync`."
        ) from exc

    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {repo_id} to {target_dir}...")
    return Path(
        snapshot_download(
            repo_id=repo_id,
            local_dir=target_dir,
        )
    )


if len(sys.argv) != 4:
    raise RuntimeError("Expected target directory, detector repo, and recognizer repo arguments")

model_dir = Path(sys.argv[1])
detector_repo = sys.argv[2]
recognizer_repo = sys.argv[3]

download_repo(detector_repo, model_dir / "det")
download_repo(recognizer_repo, model_dir / "rec")

print(f"OCR model files are ready at {model_dir}")
PY

echo "Done. Configure OCR consumers to use:"
echo "  detector:   $MODEL_DIR/det"
echo "  recognizer: $MODEL_DIR/rec"
