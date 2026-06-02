#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${NEURAXIS_ENV_FILE:-$ROOT_DIR/.llama-manager.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

HOST="${NEURAXIS_HOST:-0.0.0.0}"
PORT="${NEURAXIS_PORT:-9137}"
DEFAULT_CONFIG="$ROOT_DIR/config.example.yaml"
if [[ -f "$ROOT_DIR/config.yaml" ]]; then
  DEFAULT_CONFIG="$ROOT_DIR/config.yaml"
fi
CONFIG="${NEURAXIS_CONFIG:-$DEFAULT_CONFIG}"
PID_FILE="${NEURAXIS_PID_FILE:-$ROOT_DIR/.llama_manager_agent.pid}"
LOG_FILE="${NEURAXIS_LOG_FILE:-$ROOT_DIR/logs/llama_manager_agent_uvicorn.log}"
START_FRONTEND="${NEURAXIS_START_FRONTEND:-0}"

cd "$ROOT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "Neuraxis agent is already running on PID $PID."
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

NEURAXIS_CONFIG="$CONFIG" NEURAXIS_MODE=agent "$PYTHON" - <<'PY'
from llama_manager.core.config import load_config
from llama_manager.main import create_app

config = load_config()
if config.mode != "agent":
    raise SystemExit(f"Expected agent config, got {config.mode!r}")
create_app(config=config)
PY

NEURAXIS_CONFIG="$CONFIG" NEURAXIS_MODE=agent nohup "$PYTHON" -m uvicorn llama_manager.main:app \
  --host "$HOST" \
  --port "$PORT" \
  >"$LOG_FILE" 2>&1 &

PID="$!"
echo "$PID" > "$PID_FILE"

echo "Started Neuraxis agent on PID $PID."
echo "URL: http://$HOST:$PORT"
echo "Config: $CONFIG"
echo "Log: $LOG_FILE"

if [[ "$START_FRONTEND" == "1" ]]; then
  NEURAXIS_BACKEND_HOST="${NEURAXIS_BACKEND_HOST:-127.0.0.1}" \
  NEURAXIS_BACKEND_PORT="$PORT" \
    "$ROOT_DIR/scripts/start_frontend.sh"
else
  echo "React dev UI not started. Use NEURAXIS_START_FRONTEND=1 or run scripts/start_frontend.sh."
fi
