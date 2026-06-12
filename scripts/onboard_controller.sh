#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT_DIR/config.yaml"
ENV_FILE="$ROOT_DIR/.llama_pack.env"
TEMPLATE=""
HOST="127.0.0.1"
PORT="9137"
ADMIN_USER="${USER:-admin}"
FORCE="false"
RUN_MIGRATIONS="true"
ENABLE_MEMORY="false"
MEMORY_MODEL_PATH="./models/embedding/all-MiniLM-L6-v2"
MEMORY_STORE_PATH="./logs/agent_memory"
INSTALL_MEMORY="true"

usage() {
  cat <<'USAGE'
Usage: scripts/onboard_controller.sh [options]

Create and validate a controller config, generate a controller registration key,
run controller/auth/audit/chat-session migrations, and print startup commands.

Options:
  --config PATH          Controller config to create/update. Default: ./config.yaml
  --env-file PATH        Local secrets file to create/update. Default: ./.llama_pack.env
  --template PATH        Optional controller template to copy instead of generating a portable config.
  --host HOST            Uvicorn bind host. Default: 127.0.0.1 for Caddy/TLS.
                         Use 0.0.0.0 only for direct LAN HTTP without Caddy.
  --port PORT            Port used in the printed start command. Default: 9137
  --admin-user NAME      Admin key username shown in the create-admin command. Default: $USER
  --enable-memory        Install controller-memory extras, install the embedding model, and write memory config.
  --memory-model-path PATH
                         Embedding model directory for memory. Default: ./models/embedding/all-MiniLM-L6-v2
  --memory-store-path PATH
                         ChromaDB persistence directory for memory. Default: ./logs/agent_memory
  --skip-memory-install  Write/validate memory config without installing extras or downloading the model.
  --skip-migrations      Do not run Alembic migrations.
  --force                Overwrite --config if it already exists.
  -h, --help             Show this help.
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
    --template)
      TEMPLATE="$2"
      shift 2
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --admin-user)
      ADMIN_USER="$2"
      shift 2
      ;;
    --enable-memory)
      ENABLE_MEMORY="true"
      shift
      ;;
    --memory-model-path)
      MEMORY_MODEL_PATH="$2"
      shift 2
      ;;
    --memory-store-path)
      MEMORY_STORE_PATH="$2"
      shift 2
      ;;
    --skip-memory-install)
      INSTALL_MEMORY="false"
      shift
      ;;
    --skip-migrations)
      RUN_MIGRATIONS="false"
      shift
      ;;
    --force)
      FORCE="true"
      shift
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

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -n "$TEMPLATE" && ! -f "$TEMPLATE" ]]; then
  echo "Controller template not found: $TEMPLATE" >&2
  exit 1
fi

configure_memory() {
  "$PYTHON" - "$CONFIG" "$MEMORY_STORE_PATH" "$MEMORY_MODEL_PATH" <<'PY'
from pathlib import Path
import sys

try:
    import yaml
except ImportError as exc:
    raise SystemExit("Memory setup failed: PyYAML is required to update controller memory config.") from exc

path = Path(sys.argv[1])
store_path = sys.argv[2]
model_path = sys.argv[3]
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
if not isinstance(data, dict):
    raise SystemExit("Memory setup failed: controller config must be a YAML mapping.")
memory = data.get("memory")
if memory is None:
    memory = {}
elif not isinstance(memory, dict):
    raise SystemExit("Memory setup failed: existing memory config must be a YAML mapping.")
memory.update(
    {
        "enabled": True,
        "path": store_path,
        "embedding_model_path": model_path,
        "auto_inject": True,
        "top_k": 3,
        "soft_cap": 500,
        "ephemeral_ttl_days": 7,
        "durable_ttl_days": 90,
    }
)
data["memory"] = memory
path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY
}

if [[ -f "$CONFIG" && "$FORCE" != "true" ]]; then
  echo "Config already exists: $CONFIG"
  echo "Use --force to overwrite it, or pass --config for a different path."
else
  mkdir -p "$(dirname "$CONFIG")"
  if [[ -n "$TEMPLATE" ]]; then
    sed "s|{user_name}|${USER:-llama-manager}|g" "$TEMPLATE" > "$CONFIG"
  else
    cat > "$CONFIG" <<'YAML'
mode: controller
log_dir: ./logs

controller_registration_key: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}
node_heartbeat_timeout_seconds: 90

controller_db_url: sqlite+pysqlite:///./state/controller_state.db
auth_db_url: sqlite+pysqlite:///./state/auth_store.db
audit_db_url: sqlite+pysqlite:///./state/audit_events.db
chat_sessions_db_url: sqlite+pysqlite:///./state/chat_sessions.db
downloads_db_url: sqlite+pysqlite:///./state/downloads.db
benchmarks_db_url: sqlite+pysqlite:///./state/benchmarks.db

controller_instance_id: local-controller
controller_leader_lease_seconds: 60
controller_retention_days: 14
controller_archive_retention_days: 30
controller_archive_dir: ./logs/archives

nodes: {}
YAML
  fi
  if [[ "$ENABLE_MEMORY" == "true" ]]; then
    cat >> "$CONFIG" <<YAML

memory:
  enabled: true
  path: $MEMORY_STORE_PATH
  embedding_model_path: $MEMORY_MODEL_PATH
  auto_inject: true
  top_k: 3
  soft_cap: 500
  ephemeral_ttl_days: 7
  durable_ttl_days: 90
YAML
  fi
  echo "Wrote controller config: $CONFIG"
fi

if [[ -f "$CONFIG" && "$ENABLE_MEMORY" == "true" ]]; then
  configure_memory
  echo "Configured controller memory in: $CONFIG"
fi

if [[ -z "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY:-}" ]]; then
  CONTROLLER_REGISTRATION_KEY="$(scripts/generate_api_key.py)"
  export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY="$CONTROLLER_REGISTRATION_KEY"
  echo "Generated LLAMA_PACK_CONTROLLER_REGISTRATION_KEY for this shell."
else
  CONTROLLER_REGISTRATION_KEY="$LLAMA_PACK_CONTROLLER_REGISTRATION_KEY"
  echo "Using existing LLAMA_PACK_CONTROLLER_REGISTRATION_KEY from the environment."
fi

mkdir -p logs

upsert_env() {
  local key="$1"
  local value="$2"
  "$PYTHON" - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import shlex
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
line = f"export {key}={shlex.quote(value)}\n"
lines = path.read_text(encoding="utf-8").splitlines(keepends=True) if path.exists() else []
prefix = f"export {key}="
updated = False
for index, existing in enumerate(lines):
    if existing.startswith(prefix):
        lines[index] = line
        updated = True
        break
if not updated:
    if lines and not lines[-1].endswith("\n"):
        lines[-1] += "\n"
    lines.append(line)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text("".join(lines), encoding="utf-8")
path.chmod(0o600)
PY
}

if [[ "$ENABLE_MEMORY" == "true" && "$INSTALL_MEMORY" == "true" ]]; then
  if ! command -v uv >/dev/null 2>&1; then
    echo "Memory setup failed: uv is required to install the controller-memory extras." >&2
    echo "Install uv, then rerun scripts/onboard_controller.sh --enable-memory." >&2
    exit 1
  fi
  if ! uv pip install -e '.[controller-memory]'; then
    echo "Memory setup failed: could not install the controller-memory extras." >&2
    echo "Retry manually with: uv pip install -e '.[controller-memory]'" >&2
    exit 1
  fi
  if ! scripts/install_embedding_model.sh "$MEMORY_MODEL_PATH"; then
    echo "Memory setup failed: could not install or validate the embedding model at $MEMORY_MODEL_PATH." >&2
    echo "Retry manually with: scripts/install_embedding_model.sh '$MEMORY_MODEL_PATH'" >&2
    exit 1
  fi
elif [[ "$ENABLE_MEMORY" == "true" && ! -d "$MEMORY_MODEL_PATH" ]]; then
  echo "Memory setup failed: embedding model path does not exist: $MEMORY_MODEL_PATH" >&2
  echo "Rerun without --skip-memory-install, or run: scripts/install_embedding_model.sh '$MEMORY_MODEL_PATH'" >&2
  exit 1
fi

LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" - <<'PY'
from llama_pack.core.config import load_config

config = load_config()
if config.mode != "controller":
    raise SystemExit(f"Expected controller mode, got {config.mode!r}")
if not config.controller_registration_key:
    raise SystemExit("controller_registration_key is required")
if config.memory.enabled and not config.memory.embedding_model_path:
    raise SystemExit("memory.embedding_model_path is required when memory is enabled")
print(f"Controller config OK: {config.config_source}")
print(f"Configured nodes: {len(config.nodes)}")
PY

if [[ "$RUN_MIGRATIONS" == "true" ]]; then
  for db in controller auth audit chat_sessions downloads benchmarks; do
    LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m alembic -x "db=$db" upgrade "${db}@head"
  done
fi

upsert_env "LLAMA_PACK_CONFIG" "$CONFIG"
upsert_env "LLAMA_PACK_CONTROLLER_REGISTRATION_KEY" "$CONTROLLER_REGISTRATION_KEY"
upsert_env "LLAMA_PACK_HOST" "$HOST"
upsert_env "LLAMA_PACK_PORT" "$PORT"
if [[ "$ENABLE_MEMORY" == "true" ]]; then
  upsert_env "LLAMA_PACK_MEMORY_MODEL_PATH" "$MEMORY_MODEL_PATH"
fi

if [[ "$RUN_MIGRATIONS" == "true" && -z "${LLAMA_PACK_CONTROLLER_ADMIN_API_KEY:-}" ]]; then
  ADMIN_OUTPUT="$(LLAMA_PACK_CONFIG="$CONFIG" "$PYTHON" -m llama_pack.auth --config "$CONFIG" create-admin "$ADMIN_USER")"
  echo "$ADMIN_OUTPUT"
  CONTROLLER_ADMIN_API_KEY="$(printf '%s\n' "$ADMIN_OUTPUT" | awk -F': ' '/^API key: / {print $2}')"
  if [[ -n "$CONTROLLER_ADMIN_API_KEY" ]]; then
    export LLAMA_PACK_CONTROLLER_ADMIN_API_KEY="$CONTROLLER_ADMIN_API_KEY"
    upsert_env "LLAMA_PACK_CONTROLLER_ADMIN_API_KEY" "$CONTROLLER_ADMIN_API_KEY"
  fi
elif [[ -n "${LLAMA_PACK_CONTROLLER_ADMIN_API_KEY:-}" ]]; then
  upsert_env "LLAMA_PACK_CONTROLLER_ADMIN_API_KEY" "$LLAMA_PACK_CONTROLLER_ADMIN_API_KEY"
  echo "Using existing LLAMA_PACK_CONTROLLER_ADMIN_API_KEY from $ENV_FILE or the environment."
else
  echo "Skipped admin API key creation because --skip-migrations was used."
fi

cat <<EOF

Controller onboarding complete.

Local secrets were written to:
  $ENV_FILE

Give this controller-owned registration key to agents:
  export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY='$CONTROLLER_REGISTRATION_KEY'

Start the controller:
  scripts/start_controller.sh

Memory:
  enabled: $ENABLE_MEMORY
  embedding_model_path: $MEMORY_MODEL_PATH

Agents should use:
  export LLAMA_PACK_CONTROLLER_URL='http://<controller-host>:$PORT'
  controller_url: \${LLAMA_PACK_CONTROLLER_URL}
  controller_registration_key_outbound: \${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}
EOF
