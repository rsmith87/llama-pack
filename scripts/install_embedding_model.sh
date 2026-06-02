#!/usr/bin/env bash
# Downloads the sentence-transformers embedding model used by the controller
# memory subsystem.  Run once during initial controller setup.
# Requires internet access on first run; model is cached locally after that.
#
# Usage:
#   ./scripts/install_embedding_model.sh
#   ./scripts/install_embedding_model.sh ./custom/model/path

set -euo pipefail

MODEL_DIR="${1:-./models/embedding/all-MiniLM-L6-v2}"
MODEL_NAME="sentence-transformers/all-MiniLM-L6-v2"

echo "Installing embedding model: $MODEL_NAME"
echo "Target directory: $MODEL_DIR"

uv run python - <<EOF
from pathlib import Path
import sys

model_dir = Path("$MODEL_DIR")
if model_dir.exists() and any(model_dir.iterdir()):
    print(f"Model already present at {model_dir}, skipping download.")
    sys.exit(0)

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("ERROR: sentence-transformers is not installed.")
    print("Install the controller-memory extras first:")
    print("  uv pip install -e '.[controller-memory]'")
    sys.exit(1)

print("Downloading model (this may take a minute)...")
model = SentenceTransformer("$MODEL_NAME")
model.save(str(model_dir))
print(f"Model saved to {model_dir}")

# Quick smoke test
test_embedding = model.encode("test", normalize_embeddings=True)
assert len(test_embedding) == 384, f"Unexpected embedding size: {len(test_embedding)}"
print(f"Smoke test passed — embedding dimension: {len(test_embedding)}")
EOF

echo "Done. Update your config.yaml:"
echo "  memory:"
echo "    enabled: true"
echo "    embedding_model_path: $MODEL_DIR"
