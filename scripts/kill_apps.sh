#!/usr/bin/env bash
set -euo pipefail

DEFAULT_PORTS=(
  9137
  9000
  5173
  5174
  5175
  5176
  8080
  8081
)

usage() {
  cat <<'USAGE'
Usage:
  scripts/kill_apps.sh [--dry-run] [--force] [port ...]

Stops local app processes listening on known Llama Pack/Spitball dev ports.
If ports are provided, only those ports are checked.

Default ports:
  9137 9000 5173 5174 5175 5176 8080 8081
USAGE
}

DRY_RUN=false
FORCE=false
PORTS=()

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    --force)
      FORCE=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    ''|*[!0-9]*)
      echo "Invalid argument: $arg" >&2
      usage >&2
      exit 2
      ;;
    *)
      PORTS+=("$arg")
      ;;
  esac
done

if [[ "${#PORTS[@]}" -eq 0 ]]; then
  PORTS=("${DEFAULT_PORTS[@]}")
fi

pids_for_port() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u
}

describe_pid() {
  local pid="$1"
  ps -p "$pid" -o pid= -o comm= -o args= 2>/dev/null || echo "  pid=$pid"
}

kill_pid() {
  local pid="$1"
  if [[ "$DRY_RUN" == true ]]; then
    return 0
  fi
  kill "$pid" 2>/dev/null || true
}

force_kill_pid() {
  local pid="$1"
  if [[ "$DRY_RUN" == true ]]; then
    return 0
  fi
  kill -9 "$pid" 2>/dev/null || true
}

FOUND=false
PIDS=()

for port in "${PORTS[@]}"; do
  port_pids=()
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && port_pids+=("$pid")
  done < <(pids_for_port "$port")
  if [[ "${#port_pids[@]}" -eq 0 ]]; then
    echo "Port $port: no listener"
    continue
  fi

  FOUND=true
  echo "Port $port:"
  for pid in "${port_pids[@]}"; do
    describe_pid "$pid"
    PIDS+=("$pid")
  done
done

if [[ "$FOUND" == false ]]; then
  echo "No app listeners found."
  exit 0
fi

UNIQUE_PIDS=()
while IFS= read -r pid; do
  [[ -n "$pid" ]] && UNIQUE_PIDS+=("$pid")
done < <(printf '%s\n' "${PIDS[@]}" | sort -u)

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run only. No processes were stopped."
  exit 0
fi

for pid in "${UNIQUE_PIDS[@]}"; do
  kill_pid "$pid"
done

sleep 1

if [[ "$FORCE" == true ]]; then
  for port in "${PORTS[@]}"; do
    remaining_pids=()
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && remaining_pids+=("$pid")
    done < <(pids_for_port "$port")
    for pid in "${remaining_pids[@]}"; do
      echo "Port $port still has listener $pid; sending SIGKILL."
      force_kill_pid "$pid"
    done
  done
fi

echo "Done."
