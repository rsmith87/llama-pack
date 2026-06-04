#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME=""
LEAF=""
KEY=""
INTERMEDIATE=""
CA_URL=""
ROOT_CERT=""
EXPIRES_IN="168h"
CERT_DIR="/etc/caddy/certs"
OWNER="root"
GROUP="caddy"
RELOAD="systemd"
FORCE="false"
DRY_RUN="false"

usage() {
  cat <<'USAGE'
Usage: scripts/renew_caddy_step_cert.sh --name NAME --leaf PATH --key PATH --intermediate PATH [options]

Renew a Smallstep-issued node certificate, rebuild the Caddy fullchain, install
the renewed cert/key into Caddy's cert directory, and reload Caddy.

Required:
  --name NAME             Installed cert basename, e.g. pi-controller.
  --leaf PATH             Leaf certificate to renew in place.
  --key PATH              Private key matching the leaf certificate.
  --intermediate PATH     Intermediate CA certificate to append after the leaf.

Options:
  --ca-url URL            step-ca URL, e.g. https://pi-controller.local:8443.
  --root PATH             CA root cert passed to step.
  --expires-in DURATION   Renew only when cert expires within this duration. Default: 168h.
  --force                 Force renewal even if the cert is not near expiry.
  --cert-dir PATH         Caddy cert directory. Default: /etc/caddy/certs.
  --owner USER            Installed file owner. Default: root.
  --group GROUP           Installed file group. Default: caddy.
  --reload MODE           Reload mode: systemd, brew, none. Default: systemd.
  --dry-run               Print commands without renewing, installing, or reloading.
  -h, --help              Show this help.
USAGE
}

quote() {
  printf "%q" "$1"
}

print_command() {
  for arg in "$@"; do
    printf '%s ' "$(quote "$arg")"
  done
  printf '\n'
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
    --ca-url)
      CA_URL="$2"
      shift 2
      ;;
    --root)
      ROOT_CERT="$2"
      shift 2
      ;;
    --expires-in)
      EXPIRES_IN="$2"
      shift 2
      ;;
    --force)
      FORCE="true"
      shift
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
    --reload)
      RELOAD="$2"
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
if [[ -n "$ROOT_CERT" ]]; then
  require_file "Root certificate" "$ROOT_CERT"
fi

renew_cmd=(step ca renew "$LEAF" "$KEY" --expires-in "$EXPIRES_IN")
if [[ "$FORCE" == "true" ]]; then
  renew_cmd+=(--force)
fi
if [[ -n "$CA_URL" ]]; then
  renew_cmd+=(--ca-url "$CA_URL")
fi
if [[ -n "$ROOT_CERT" ]]; then
  renew_cmd+=(--root "$ROOT_CERT")
fi

install_cmd=(
  "$ROOT_DIR/scripts/install_caddy_fullchain.sh"
  --name "$NAME"
  --leaf "$LEAF"
  --key "$KEY"
  --intermediate "$INTERMEDIATE"
  --cert-dir "$CERT_DIR"
  --owner "$OWNER"
  --group "$GROUP"
)

case "$RELOAD" in
  systemd)
    reload_cmd=(sudo systemctl reload caddy)
    ;;
  brew)
    reload_cmd=(brew services restart caddy)
    ;;
  none)
    reload_cmd=()
    ;;
  *)
    echo "Invalid --reload value: $RELOAD. Use systemd, brew, or none." >&2
    exit 2
    ;;
esac

if [[ "$DRY_RUN" == "true" ]]; then
  print_command "${renew_cmd[@]}"
  print_command "${install_cmd[@]}" --dry-run
  if [[ ${#reload_cmd[@]} -gt 0 ]]; then
    print_command "${reload_cmd[@]}"
  fi
  exit 0
fi

"${renew_cmd[@]}"
"${install_cmd[@]}"
if [[ ${#reload_cmd[@]} -gt 0 ]]; then
  "${reload_cmd[@]}"
fi

echo "Renewed and installed Caddy certificate for: $NAME"
