#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${LLAMA_MANAGER_FRONTEND_PID_FILE:-}" && -z "${LLAMA_MANAGER_PID_FILE:-}" ]]; then
  export LLAMA_MANAGER_PID_FILE="$LLAMA_MANAGER_FRONTEND_PID_FILE"
fi

exec "$ROOT_DIR/scripts/stop_server.sh" frontend
