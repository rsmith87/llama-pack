#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_DIR="${LLAMA_PACK_CERT_DIR:-$HOME/llama-pack-certs}"

cd "$REPO_DIR"

"$REPO_DIR/scripts/renew_caddy_step_cert.sh" \
  --name mac-mini \
  --leaf "$CERT_DIR/mac-mini.crt" \
  --key "$CERT_DIR/mac-mini.key" \
  --intermediate "$CERT_DIR/intermediate_ca.crt" \
  --ca-url https://pi-controller.local:8443 \
  --root "$CERT_DIR/root_ca.crt" \
  --cert-dir /opt/homebrew/etc/caddy/certs \
  --owner "${LLAMA_PACK_CADDY_CERT_OWNER:?Set LLAMA_PACK_CADDY_CERT_OWNER to the local Caddy certificate owner}" \
  --group staff \
  --expires-in 24h \
  --reload brew \
  --force
