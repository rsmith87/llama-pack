#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/Users/robertsmith/Apps/neuraxis"

cd "$REPO_DIR"

"$REPO_DIR/scripts/renew_caddy_step_cert.sh" \
  --name mac-mini \
  --leaf "$HOME/neuraxis-certs/mac-mini.crt" \
  --key "$HOME/neuraxis-certs/mac-mini.key" \
  --intermediate "$HOME/neuraxis-certs/intermediate_ca.crt" \
  --ca-url https://pi-controller.local:8443 \
  --root "$HOME/neuraxis-certs/root_ca.crt" \
  --cert-dir /opt/homebrew/etc/caddy/certs \
  --owner robertsmith \
  --group staff \
  --expires-in 24h \
  --reload brew \
  --force
