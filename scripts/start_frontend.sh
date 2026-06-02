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

FRONTEND_HOST="${NEURAXIS_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${NEURAXIS_FRONTEND_PORT:-5173}"
FRONTEND_BASE_PATH="${NEURAXIS_FRONTEND_BASE_PATH:-/ui/}"
BACKEND_HOST="${NEURAXIS_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${NEURAXIS_BACKEND_PORT:-${NEURAXIS_PORT:-9137}}"
API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://$BACKEND_HOST:$BACKEND_PORT}"
PID_FILE="${NEURAXIS_FRONTEND_PID_FILE:-$ROOT_DIR/.llama_manager_frontend.pid}"
LOG_FILE="${NEURAXIS_FRONTEND_LOG_FILE:-$ROOT_DIR/logs/llama_manager_frontend_vite.log}"

cd "$ROOT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

if [[ ! -d "$ROOT_DIR/frontend" ]]; then
  echo "No frontend directory found at $ROOT_DIR/frontend." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/frontend/package.json" ]]; then
  echo "No frontend/package.json found." >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "Frontend dependencies are not installed. Run: cd frontend && npm ci" >&2
  exit 1
fi

echo "Building frontend..."
(cd "$ROOT_DIR/frontend" && npm run build)

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "Neuraxis React frontend is already running on PID $PID."
    echo "URL: http://$FRONTEND_HOST:$FRONTEND_PORT$FRONTEND_BASE_PATH"
    echo "API proxy: $API_PROXY_TARGET"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

(
  cd "$ROOT_DIR/frontend"
  VITE_API_PROXY_TARGET="$API_PROXY_TARGET" nohup npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" \
    >"$LOG_FILE" 2>&1 &
  echo "$!" > "$PID_FILE"
)

PID="$(cat "$PID_FILE")"

echo "Started Neuraxis React frontend on PID $PID."
echo "URL: http://$FRONTEND_HOST:$FRONTEND_PORT$FRONTEND_BASE_PATH"
echo "API proxy: $API_PROXY_TARGET"
echo "Log: $LOG_FILE"
