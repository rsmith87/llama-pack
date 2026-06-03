#!/usr/bin/env bash
set -euo pipefail

NAME=""
LEAF=""
KEY=""
INTERMEDIATE=""
CERT_DIR="/etc/caddy/certs"
OWNER="root"
GROUP="caddy"
FULLCHAIN=""
DRY_RUN="false"

usage() {
  cat <<'USAGE'
Usage: scripts/install_caddy_fullchain.sh --name NAME --leaf PATH --key PATH --intermediate PATH [options]

Build a Caddy fullchain certificate from user-writable files, then install the
leaf certificate, fullchain certificate, and private key into Caddy's cert dir.

Required:
  --name NAME             Installed cert basename, e.g. pi-controller.
  --leaf PATH             Leaf certificate issued for the node.
  --key PATH              Private key issued for the node.
  --intermediate PATH     Intermediate CA certificate to append after the leaf.

Options:
  --cert-dir PATH         Caddy cert directory. Default: /etc/caddy/certs
  --owner USER            Installed file owner. Default: root
  --group GROUP           Installed file group. Default: caddy
  --fullchain PATH        Staging fullchain path. Default: leaf directory/NAME-fullchain.crt
  --dry-run               Build the staging fullchain and print sudo install commands without running them.
  -h, --help              Show this help.
USAGE
}

quote() {
  printf "%q" "$1"
}

run_or_print() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf 'sudo'
    for arg in "$@"; do
      printf ' %s' "$(quote "$arg")"
    done
    printf '\n'
  else
    sudo "$@"
  fi
}

require_file() {
  local label="$1"
  local path="$2"
  if [[ ! -f "$path" ]]; then
    echo "$label not found: $path" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      NAME="$2"
      shift 2
      ;;
    --leaf)
      LEAF="$2"
      shift 2
      ;;
    --key)
      KEY="$2"
      shift 2
      ;;
    --intermediate)
      INTERMEDIATE="$2"
      shift 2
      ;;
    --cert-dir)
      CERT_DIR="$2"
      shift 2
      ;;
    --owner)
      OWNER="$2"
      shift 2
      ;;
    --group)
      GROUP="$2"
      shift 2
      ;;
    --fullchain)
      FULLCHAIN="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
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

if [[ -z "$NAME" || -z "$LEAF" || -z "$KEY" || -z "$INTERMEDIATE" ]]; then
  echo "Missing required --name, --leaf, --key, or --intermediate option." >&2
  usage >&2
  exit 2
fi

if [[ "$NAME" == *"/"* || "$NAME" == "." || "$NAME" == ".." || -z "$NAME" ]]; then
  echo "Invalid --name: use a basename such as pi-controller." >&2
  exit 2
fi

require_file "Leaf certificate" "$LEAF"
require_file "Private key" "$KEY"
require_file "Intermediate certificate" "$INTERMEDIATE"

if [[ -z "$FULLCHAIN" ]]; then
  FULLCHAIN="$(dirname "$LEAF")/$NAME-fullchain.crt"
fi

mkdir -p "$(dirname "$FULLCHAIN")"
cat "$LEAF" "$INTERMEDIATE" > "$FULLCHAIN"
chmod 644 "$FULLCHAIN"

echo "Built fullchain: $FULLCHAIN"

run_or_print install -d -o "$OWNER" -g "$GROUP" -m 750 "$CERT_DIR"
run_or_print install -o "$OWNER" -g "$GROUP" -m 644 "$LEAF" "$CERT_DIR/$NAME.crt"
run_or_print install -o "$OWNER" -g "$GROUP" -m 644 "$FULLCHAIN" "$CERT_DIR/$NAME-fullchain.crt"
run_or_print install -o "$OWNER" -g "$GROUP" -m 640 "$KEY" "$CERT_DIR/$NAME.key"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run complete. Re-run without --dry-run to install with sudo."
else
  echo "Installed Caddy certs under: $CERT_DIR"
fi
