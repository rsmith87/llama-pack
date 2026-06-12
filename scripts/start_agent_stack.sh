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

VENV_ACTIVATE="$ROOT_DIR/.venv/bin/activate"
if [[ -f "$VENV_ACTIVATE" ]]; then
  # shellcheck disable=SC1090
  source "$VENV_ACTIVATE"
fi

AGENT_PID_FILE="${LLAMA_PACK_PID_FILE:-$ROOT_DIR/.llama_pack_agent.pid}"
FRONTEND_PID_FILE="${LLAMA_PACK_FRONTEND_PID_FILE:-$ROOT_DIR/.llama_pack_frontend.pid}"
DEFAULT_CONFIG="$ROOT_DIR/config.example.yaml"
if [[ -f "$ROOT_DIR/config.yaml" ]]; then
  DEFAULT_CONFIG="$ROOT_DIR/config.yaml"
fi
CONFIG="${LLAMA_PACK_CONFIG:-$DEFAULT_CONFIG}"

print_debug_config_keys() {
  if [[ "${LLAMA_PACK_DEBUG_CONFIG_KEYS:-0}" != "1" ]]; then
    return
  fi

  local python_bin
  if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    python_bin="$ROOT_DIR/.venv/bin/python"
  else
    python_bin="${PYTHON:-python3}"
  fi

  LLAMA_PACK_CONFIG="$CONFIG" LLAMA_PACK_MODE=agent "$python_bin" - <<'PY'
from llama_pack.core.config import load_config

config = load_config()
print("Resolved agent auth config:")
print(f"  config: {config.config_source}")
print(f"  node_name: {config.node_name}")
print(f"  agent_api_key: {config.agent_api_key}")
print(f"  controller_registration_key_outbound: {config.controller_registration_key_outbound}")
print(f"  controller_registration_key: {config.controller_registration_key}")
PY
}

is_running() {
  local pid_file="$1"

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  echo "Removing stale PID file: $pid_file"
  rm -f "$pid_file"
  return 1
}

AGENT_RUNNING=0
FRONTEND_RUNNING=0

if is_running "$AGENT_PID_FILE"; then
  AGENT_RUNNING=1
fi

if is_running "$FRONTEND_PID_FILE"; then
  FRONTEND_RUNNING=1
fi

print_debug_config_keys

if [[ "$AGENT_RUNNING" == "1" && "$FRONTEND_RUNNING" == "1" ]]; then
  echo "Llama Pack agent stack is currently up."
  exit 0
fi

if [[ "$AGENT_RUNNING" == "1" ]]; then
  echo "Llama Pack agent is currently up."
else
  LLAMA_PACK_START_FRONTEND=0 "$ROOT_DIR/scripts/start_agent.sh"
  if is_running "$FRONTEND_PID_FILE"; then
    FRONTEND_RUNNING=1
  else
    FRONTEND_RUNNING=0
  fi
fi

if [[ "$FRONTEND_RUNNING" == "1" ]]; then
  echo "Llama Pack React frontend is currently up."
else
  "$ROOT_DIR/scripts/start_frontend.sh"
fi
