#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG=""
ENV_FILE="$ROOT_DIR/.llama_pack.env"
USERNAME="test-chat"

usage() {
  cat <<'USAGE'
Usage: scripts/create_test_chat_key.sh [options]

Create a scoped test-chat API key, store its hash in the configured auth DB,
and write the raw key to the local env file for /ui/test-chat bootstrap.

Options:
  --config PATH      Llama Pack config path passed to python -m llama_pack.auth.
  --env-file PATH    Secrets file to update. Default: ./.llama_pack.env
  --username NAME    Auth username for the key. Default: test-chat
  -h, --help         Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --username)
      USERNAME="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd "$ROOT_DIR"

PYTHON="python3"
if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON="$ROOT_DIR/.venv/bin/python"
fi

AUTH_ARGS=()
if [[ -n "$CONFIG" ]]; then
  AUTH_ARGS+=(--config "$CONFIG")
fi

OUTPUT="$("$PYTHON" -m llama_pack.auth "${AUTH_ARGS[@]}" create-test-chat-key --username "$USERNAME")"
KEY="$(printf '%s\n' "$OUTPUT" | awk -F': ' '/^API key: / {print $2; exit}')"
if [[ -z "$KEY" ]]; then
  echo "$OUTPUT" >&2
  echo "Failed to parse generated API key." >&2
  exit 1
fi

"$PYTHON" - "$ENV_FILE" "$KEY" <<'PY'
from pathlib import Path
import shlex
import sys

path = Path(sys.argv[1])
value = sys.argv[2]
key = "LLAMA_PACK_TEST_CHAT_API_KEY"
line = f"export {key}={shlex.quote(value)}\n"
prefix = f"export {key}="
lines = path.read_text(encoding="utf-8").splitlines(keepends=True) if path.exists() else []
for index, existing in enumerate(lines):
    if existing.startswith(prefix):
        lines[index] = line
        break
else:
    if lines and not lines[-1].endswith("\n"):
        lines[-1] += "\n"
    lines.append(line)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text("".join(lines), encoding="utf-8")
path.chmod(0o600)
PY

chmod 600 "$ENV_FILE"
echo "$OUTPUT"
echo
echo "Updated LLAMA_PACK_TEST_CHAT_API_KEY in $ENV_FILE"
echo "Source this env file and restart the controller before opening /ui/test-chat."
