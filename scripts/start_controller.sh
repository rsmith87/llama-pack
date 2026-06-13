#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${LLAMA_PACK_ENV_FILE:-$ROOT_DIR/.llama_pack.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

HOST="${LLAMA_PACK_HOST:-127.0.0.1}"
PORT="${LLAMA_PACK_PORT:-9137}"
DEFAULT_CONFIG="$ROOT_DIR/config.example.yaml"
if [[ -f "$ROOT_DIR/config.yaml" ]]; then
  DEFAULT_CONFIG="$ROOT_DIR/config.yaml"
fi
CONFIG="${LLAMA_PACK_CONFIG:-$DEFAULT_CONFIG}"
PID_FILE="${LLAMA_PACK_PID_FILE:-$ROOT_DIR/.llama_pack_controller.pid}"
LOG_FILE="${LLAMA_PACK_LOG_FILE:-$ROOT_DIR/logs/llama_pack_controller_uvicorn.log}"
RUN_MIGRATIONS="${LLAMA_PACK_RUN_MIGRATIONS:-1}"
START_FRONTEND="${LLAMA_PACK_START_FRONTEND:-0}"

cd "$ROOT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "Llama Pack controller is already running on PID $PID."
    echo "URL: http://$HOST:$PORT"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON="$ROOT_DIR/.venv/bin/python"
else
  PYTHON="${PYTHON:-python3}"
fi

LLAMA_PACK_CONFIG="$CONFIG" LLAMA_PACK_MODE=controller "$PYTHON" - <<'PY'
from llama_pack.core.config import load_config
from llama_pack.main import create_app

config = load_config()
if config.mode != "controller":
    raise SystemExit(f"Expected controller config, got {config.mode!r}")
create_app(config=config)
PY

if [[ "$RUN_MIGRATIONS" != "0" ]]; then
  echo "Running controller migrations..."
  LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x db=controller upgrade controller@head
  LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x db=auth upgrade auth@head
  LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x db=audit upgrade audit@head
  LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x db=chat_sessions upgrade chat_sessions@head
  LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x db=downloads upgrade downloads@head
  LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x db=benchmarks upgrade benchmarks@head
  LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x db=models upgrade models@head
fi

LLAMA_PACK_CONFIG="$CONFIG" LLAMA_PACK_MODE=controller nohup "$PYTHON" -m uvicorn llama_pack.main:app \
  --host "$HOST" \
  --port "$PORT" \
  >"$LOG_FILE" 2>&1 &

PID="$!"
echo "$PID" > "$PID_FILE"

echo "Started Llama Pack controller on PID $PID."
echo "URL: http://$HOST:$PORT"
echo "Config: $CONFIG"
echo "Log: $LOG_FILE"

if [[ "$START_FRONTEND" == "1" ]]; then
  LLAMA_PACK_BACKEND_HOST="${LLAMA_PACK_BACKEND_HOST:-127.0.0.1}" \
  LLAMA_PACK_BACKEND_PORT="$PORT" \
    "$ROOT_DIR/scripts/start_frontend.sh"
else
  echo "React dev UI not started. Use LLAMA_PACK_START_FRONTEND=1 or run scripts/start_frontend.sh."
fi
