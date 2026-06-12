#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_CONFIG="$ROOT_DIR/config.example.yaml"
if [[ -f "$ROOT_DIR/config.yaml" ]]; then
	DEFAULT_CONFIG="$ROOT_DIR/config.yaml"
fi
CONFIG="${LLAMA_PACK_CONFIG:-$DEFAULT_CONFIG}"

if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
	PYTHON="$ROOT_DIR/.venv/bin/python"
else
	PYTHON="${PYTHON:-python3}"
fi

MODE="${LLAMA_PACK_MODE:-}"
if [[ -z "$MODE" ]]; then
	MODE="$(LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" - <<'PY'
import os
from llama_pack.core.config import load_config

os.environ.pop("LLAMA_PACK_MODE", None)
print(load_config().mode)
PY
)"
fi

echo "Starting full-stack dev mode (${MODE} backend + React Vite frontend)..."
echo "Config: $CONFIG"
echo "Tip: stop with scripts/stop_server.sh ${MODE} && scripts/stop_frontend.sh"

case "$MODE" in
	"agent")
		LLAMA_PACK_START_FRONTEND=1 exec "$ROOT_DIR/scripts/start_agent.sh"
		;;
	"controller")
		LLAMA_PACK_START_FRONTEND=1 exec "$ROOT_DIR/scripts/start_controller.sh"
		;;
	*)
		echo "Unsupported mode '$MODE'. Expected 'agent' or 'controller'." >&2
		exit 2
		;;
esac