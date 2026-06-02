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

TARGET="${1:-auto}"

pid_file_for_target() {
  case "$1" in
    "agent")
      echo "$ROOT_DIR/.neuraxis_agent.pid"
      ;;
    "controller")
      echo "$ROOT_DIR/.neuraxis_controller.pid"
      ;;
    "frontend")
      echo "$ROOT_DIR/.neuraxis_frontend.pid"
      ;;
    "server"|"legacy")
      echo "$ROOT_DIR/.neuraxis.pid"
      ;;
    *)
      return 1
      ;;
  esac
}

if [[ -n "${NEURAXIS_PID_FILE:-}" ]]; then
  PID_FILE="$NEURAXIS_PID_FILE"
elif [[ "$TARGET" == "auto" ]]; then
  PID_FILE=""
  for candidate in \
    "$ROOT_DIR/.neuraxis_agent.pid" \
    "$ROOT_DIR/.neuraxis_controller.pid" \
    "$ROOT_DIR/.neuraxis_frontend.pid" \
    "$ROOT_DIR/.neuraxis.pid"; do
    if [[ -f "$candidate" ]]; then
      PID_FILE="$candidate"
      break
    fi
  done
  if [[ -z "$PID_FILE" ]]; then
    echo "No PID file found for agent, controller, frontend, or legacy server."
    exit 0
  fi
else
  if ! PID_FILE="$(pid_file_for_target "$TARGET")"; then
    echo "Unknown target '$TARGET'. Use: agent, controller, frontend, server, legacy, or auto." >&2
    exit 2
  fi
fi

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found at $PID_FILE."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID is not running. Removing stale PID file."
  rm -f "$PID_FILE"
  exit 0
fi

kill "$PID"

for _ in {1..30}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Stopped Neuraxis process $PID."
    exit 0
  fi
  sleep 0.2
done

echo "Process $PID did not stop after SIGTERM; sending SIGKILL."
kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "Stopped Neuraxis process $PID."
