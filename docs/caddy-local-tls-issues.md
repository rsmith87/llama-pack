# Caddy Local TLS — Incidents & Troubleshooting Notes

Real-world issues encountered running the Llama Pack local TLS setup.
See [caddy-local-tls.md](caddy-local-tls.md) for the full setup and renewal
reference.

---

## 2026-06-06 — "500 errors on RPi" turned out to be an expired mac-mini cert

### Symptom

Internal `httpx` calls to model endpoints were returning 500 errors. Logs on
the Raspberry Pi controller showed messages like:

```
TLS certificate verification failed: the certificate appears to be expired.
Re-issue and reinstall the Caddy certificate, then reload Caddy.
```

### What we thought at first

Because the errors were appearing in the controller logs (running on the Pi),
the assumption was that the Pi's own certificate had expired and was causing the
failure.

### The real cause

The **controller's httpx calls proxy through to agent nodes**. When an agent
node's cert is expired, the controller is the one that throws the SSL error —
not the agent itself. The error surface is always the *requesting* side (the Pi
controller), even when the *responding* side (e.g. mac-mini) is the broken
node.

A quick check of all node cert expiries made the real culprit obvious:

```bash
for h in pi-controller.local mac-mini.local linux-2080ti.local; do
  echo "=== $h ==="
  echo | openssl s_client -servername "$h" -connect "$h:443" 2>/dev/null \
    | openssl x509 -noout -subject -dates
done
```

Output:
```
=== pi-controller.local ===
notBefore=Jun  6 22:10:55 2026 GMT
notAfter=Jun  7 22:11:55 2026 GMT       ← valid

=== mac-mini.local ===
notBefore=Jun  5 06:49:28 2026 GMT
notAfter=Jun  6 06:50:28 2026 GMT       ← EXPIRED

=== linux-2080ti.local ===
notBefore=Jun  6 20:20:34 2026 GMT
notAfter=Jun  7 20:21:34 2026 GMT       ← valid
```

The mac-mini cert had been expired for ~10 hours.

### Why `step ca renew` won't work here

`step ca renew` only works while a cert is **still valid**. Once it has expired,
the command is blocked. You must re-issue from scratch using `step ca
certificate ... --force`.

### Fix

**Step 1 — Make sure `step-ca` is running on the Pi:**

```bash
sudo systemctl start step-ca
sudo systemctl status step-ca
```

**Step 2 — Re-issue the expired cert** (run on the mac-mini):

```bash
step ca certificate mac-mini.local ~/llama-pack-certs/mac-mini.crt ~/llama-pack-certs/mac-mini.key \
  --ca-url https://pi-controller.local:8443 \
  --root ~/llama-pack-certs/ca-root.crt \
  --not-after 24h \
  --force
```

**Step 3 — Rebuild the fullchain and reload Caddy** (run on the mac-mini):

```bash
cd /Users/robertsmith/Apps/llama-pack
scripts/renew_caddy_mac_mini.sh
```

Wrapper script content (`scripts/renew_caddy_mac_mini.sh`):

```bash
cd /Users/robertsmith/Apps/llama-pack
scripts/renew_caddy_step_cert.sh \
  --name mac-mini \
  --leaf ~/llama-pack-certs/mac-mini.crt \
  --key ~/llama-pack-certs/mac-mini.key \
  --intermediate ~/llama-pack-certs/intermediate_ca.crt \
  --ca-url https://pi-controller.local:8443 \
  --root ~/llama-pack-certs/root_ca.crt \
  --cert-dir /opt/homebrew/etc/caddy/certs \
  --owner robertsmith \
  --group staff \
  --expires-in 24h \
  --reload brew \
  --force
```

**Step 4 — Verify the renewed cert and full chain:**

```bash
echo | openssl s_client -connect mac-mini.local:443 2>/dev/null | openssl x509 -noout -dates
echo | openssl s_client -connect mac-mini.local:443 2>/dev/null | grep -E "depth|verify"
```

Expect `depth=2` (leaf + intermediate + root). If you see `depth=0`, the
fullchain was not installed — re-run Step 3.

---

## Key Lessons

### The error appears on the controller, not the broken node

When a controller-side `httpx` call fails with a TLS error, the node whose cert
is expired is the *target* of that call, not necessarily the machine the error
is logged on. Always check **all** nodes before assuming the controller itself
is the problem.

### Check every node's expiry first

Before any debugging, run the one-liner against all nodes:

```bash
for h in pi-controller.local mac-mini.local linux-2080ti.local; do
  echo "=== $h ==="
  echo | openssl s_client -servername "$h" -connect "$h:443" 2>/dev/null \
    | openssl x509 -noout -dates
done
```

### Caddy must serve the fullchain, not the leaf cert

Serving only the leaf cert causes Python/httpx to fail with
`unable to get local issuer certificate` even when `curl` succeeds. Always use
`*-fullchain.crt` (leaf + intermediate concatenated) in the Caddyfile:

```caddyfile
mac-mini.local {
    tls /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt /opt/homebrew/etc/caddy/certs/mac-mini.key
    reverse_proxy 127.0.0.1:9137
}
```

### 24h certs require twice-daily renewal

With `--not-after 24h` (or `--expires-in 24h`), the systemd timer on Pi/Linux
and the cron job on macOS must run at least twice a day. The
`0 3,15 * * *` schedule (3 AM and 3 PM) is the recommended interval. If a
machine is off during both windows, the cert will expire before the next
attempt.

If you move scheduling to `launchd` (recommended), copy the wrapper script to a
stable user path first:

```bash
install -m 755 /Users/robertsmith/Apps/llama-pack/scripts/renew_caddy_mac_mini.sh \
  /Users/robertsmith/bin/renew_caddy_mac_mini.sh
```

Then point your LaunchAgent `ProgramArguments` to:
`/Users/robertsmith/bin/renew_caddy_mac_mini.sh`.
