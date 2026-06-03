# TLS Plan: Caddy + Private CA

This document covers the setup for encrypting controller, agent, and future
mobile-app traffic using Caddy as a TLS-terminating reverse proxy and a private
certificate authority.

For the command-oriented local setup checklist, see `docs/caddy-local-tls.md`.

## Why This Matters

All nodes currently communicate over plain HTTP on `192.168.x.x` addresses.
On a LAN this means:

- **API keys are transmitted in plaintext** — protected requests use
  `X-Llama-Manager-Key`, and agent registration sends a registration key that
  can be sniffed passively over plain HTTP.
- **Chat content is unencrypted** — all prompts and model responses proxied
  between controller and agents are visible on the wire.
- **ARP spoofing is trivial** — any device on the same subnet can impersonate a
  node, intercept the TCP stream, and forward it without either side noticing.

TLS with certificate verification (`verify_tls: true`, already the default)
closes all of these: a spoofed connection presents an invalid cert and is
rejected rather than silently succeeding.

## Architecture

Each machine runs two network-facing layers:

```
Internet/LAN
     │
     ▼
  Caddy :443          ← TLS termination, cert from a trusted CA
     │
     ▼
  Uvicorn :9137       ← bound to 127.0.0.1 only
```

Caddy proxies `https://<node-hostname>/` to `http://127.0.0.1:9137`. Uvicorn
stops accepting connections from other machines entirely. Neuraxis API keys
remain required; Caddy supplies transport encryption, not application auth.

Use hostnames, not raw IP addresses, in Neuraxis URLs. The hostname in each
URL must be present in that node certificate's DNS subject alternative names
or TLS verification will fail.

## Node Inventory

| Role | Machine | Planned hostname |
| --- | --- | --- |
| Controller | Raspberry Pi | `pi-controller.local` (or LAN DNS name) |
| Agent | Mac mini | `mac-mini.local` |
| Agent | Linux 2080 Ti | `linux-2080ti.local` |

## Step 1: Choose Certificate Source

There are two practical certificate options:

| Option | Best for | Notes |
| --- | --- | --- |
| Public ACME certificate | Mobile app access, remote access, user-owned domain | Easiest for phones because iOS and Android already trust public roots. Requires DNS or HTTP validation and a stable name such as `controller.example.com`. |
| Private CA | LAN-only controller/agent encryption, homelab hostnames | Works well for inter-machine traffic. Every client, including future mobile devices, must trust the private root before HTTPS succeeds. |

For the current inter-machine encryption goal, the private CA path is enough.
For the mobile app, prefer a public ACME certificate when the controller is
reachable through a real domain. If the mobile app is LAN-only or VPN-only,
the private CA root must be installed on the phone.

## Step 2: Private CA with step-ca

Install [smallstep CLI](https://smallstep.com/docs/step-cli/) on one machine
(the Pi is a reasonable choice):

```bash
# Install step CLI
brew install step   # macOS
# or on the Pi:
wget https://dl.smallstep.com/cli/docs-ca-install/latest/step-cli_amd64.deb
sudo dpkg -i step-cli_amd64.deb

# Initialize the CA (run once, keep the CA key and password safe)
step ca init \
  --name "Neuraxis Internal CA" \
  --dns "pi-controller.local" \
  --address ":8443" \
  --provisioner "admin"
```

Issue a certificate for each node. Include every stable name that clients will
use for that machine:

```bash
# On each machine (or remotely if the CA is reachable)
step ca certificate mac-mini.local mac-mini.crt mac-mini.key \
  --ca-url https://pi-controller.local:8443 \
  --root /path/to/ca-root.crt
```

If a machine is reached through multiple names, pass them when issuing the
certificate, for example:

```bash
step ca certificate pi-controller.local pi-controller.crt pi-controller.key \
  --san pi-controller.local \
  --san controller.lan \
  --ca-url https://pi-controller.local:8443 \
  --root /path/to/ca-root.crt
```

Distribute `ca-root.crt` to every machine's system trust store so
`verify_tls: true` works without extra config:

```bash
# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ca-root.crt

# Debian/Ubuntu (Pi, Linux agent)
sudo cp ca-root.crt /usr/local/share/ca-certificates/neuraxis-ca.crt
sudo update-ca-certificates
```

Certs from `step-ca` default to 24-hour lifetimes with auto-renewal. Adjust
with `--not-after` if you want longer-lived certs for a homelab where the CA
is not always running.

## Step 3: Caddy on Each Node

Install Caddy:

```bash
# macOS
brew install caddy

# Debian/Ubuntu (Pi, Linux agent)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

### Caddyfile (per node)

Replace `<hostname>` and cert paths with the values for each machine.
Repo examples are available at:

- `deploy/caddy/controller.Caddyfile.example`
- `deploy/caddy/agent.Caddyfile.example`

**Pi controller** (`/etc/caddy/Caddyfile` on the Pi):

```
pi-controller.local {
    tls /etc/caddy/certs/pi-controller-fullchain.crt /etc/caddy/certs/pi-controller.key
    reverse_proxy 127.0.0.1:9137
}
```

**Mac mini agent** (`/etc/caddy/Caddyfile` on the Mac mini):

```
mac-mini.local {
    tls /etc/caddy/certs/mac-mini-fullchain.crt /etc/caddy/certs/mac-mini.key
    reverse_proxy 127.0.0.1:9137
}
```

**Linux agent** (`/etc/caddy/Caddyfile` on the Linux box):

```
linux-2080ti.local {
    tls /etc/caddy/certs/linux-2080ti-fullchain.crt /etc/caddy/certs/linux-2080ti.key
    reverse_proxy 127.0.0.1:9137
}
```

Before reload, validate the file:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Reload Caddy after editing:

```bash
sudo systemctl reload caddy   # Linux
sudo caddy reload --config /etc/caddy/Caddyfile   # macOS / manual service
```

## Step 4: Lock Down Uvicorn to Localhost

In each machine's startup environment (`.neuraxis.env` or the shell that
sources it), set:

```bash
export NEURAXIS_HOST=127.0.0.1
```

`start_controller.sh` and `start_agent.sh` both read `NEURAXIS_HOST` and pass
it to uvicorn. After this change, uvicorn only accepts connections from the
local machine; all external traffic must come through Caddy.

Restart the Neuraxis process after changing this value:

```bash
scripts/stop_server.sh
scripts/start_controller.sh   # controller machine
scripts/start_agent.sh        # agent machines
```

## Step 5: Update Node URLs

Switch all URLs from `http://` to `https://` and from raw IP addresses to
hostnames. Update `.neuraxis.env` on each machine:

```bash
# Pi controller .neuraxis.env
export NEURAXIS_MAC_MINI_AGENT_URL=https://mac-mini.local
export NEURAXIS_LINUX_2080TI_AGENT_URL=https://linux-2080ti.local

# Mac mini .neuraxis.env
export NEURAXIS_CONTROLLER_URL=https://pi-controller.local
export NEURAXIS_AGENT_URL=https://mac-mini.local

# Linux agent .neuraxis.env
export NEURAXIS_CONTROLLER_URL=https://pi-controller.local
export NEURAXIS_AGENT_URL=https://linux-2080ti.local
```

The `verify_tls: true` default in `NodeConfig` is already wired into
`httpx.AsyncClient(verify=node_config.verify_tls)`. No code changes are
needed — just update the URLs and ensure the CA chain is trusted by both the
system and Python runtime. In practice, set `SSL_CERT_FILE` and
`REQUESTS_CA_BUNDLE` to a bundle containing the root and intermediate CA certs.

For manually maintained controller configs, keep node entries on HTTPS:

```yaml
nodes:
  mac-mini:
    url: https://mac-mini.local
    api_key: ${NEURAXIS_MAC_MINI_AGENT_API_KEY}
    verify_tls: true
```

If you use `scripts/onboard_agent.sh`, pass the HTTPS URLs:

```bash
scripts/onboard_agent.sh \
  --node mac-mini \
  --controller-url https://pi-controller.local \
  --agent-url https://mac-mini.local \
  --host 127.0.0.1
```

## Step 6: Smoke Check

After restarting each node:

```bash
# From any machine, verify TLS is working
curl -s https://pi-controller.local/health
curl -s https://mac-mini.local/health
curl -s https://linux-2080ti.local/health
```

Expected response on each:

```json
{"ok": true, "mode": "controller"}   # Pi
{"ok": true, "mode": "agent"}        # agents
```

If `curl` returns a cert error, the CA root is not yet trusted on that machine.
Add `--cacert /path/to/ca-root.crt` temporarily to confirm the cert itself is
valid, then fix the trust store.

Also verify the controller sees healthy agents:

```bash
curl -s -H "X-Llama-Manager-Key: $NEURAXIS_CONTROLLER_ADMIN_API_KEY" \
  https://pi-controller.local/lm-api/v1/nodes
```

Confirm uvicorn is no longer reachable directly from another machine:

```bash
curl -sS http://pi-controller.local:9137/health
```

That direct request should fail once `NEURAXIS_HOST=127.0.0.1` is active.

From the controller machine itself, local uvicorn should still respond:

```bash
curl -s http://127.0.0.1:9137/health
```

## Mobile App Readiness

For a native mobile app, the controller URL should be a stable HTTPS URL:

```text
https://pi-controller.local
```

or, for public/VPN-backed access:

```text
https://controller.example.com
```

Mobile clients will use the same Caddy listener as agents. The app should not
connect to uvicorn directly and should not disable certificate validation. If
you stay on a private CA, install the root CA profile/certificate on the phone
before pairing. If you use a public ACME certificate, no custom mobile trust
setup is needed.

## Ongoing Maintenance

| Task | When |
| --- | --- |
| Renew node certs | Before expiry (step-ca can automate this with `step ca renew --daemon`) |
| Rotate CA root | Annually or if the CA key is compromised |
| Check Caddy logs | `journalctl -u caddy` or `caddy adapt --watch` for config errors |
| Add a new node | Issue a cert, write a Caddyfile block, update controller node config with `https://` URL |

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `certificate is not trusted` | Private root CA is not installed on the client | Install `ca-root.crt` in the system trust store, then retry without `--cacert`. |
| `unable to get local issuer certificate` in Python/httpx | Missing intermediate chain or Python is not using the system trust store | Serve Caddy with a leaf+intermediate fullchain and set `SSL_CERT_FILE` to a root+intermediate CA bundle. |
| `certificate is valid for ..., not ...` | URL hostname does not match the certificate SAN | Reissue the certificate with the exact hostname used in `NEURAXIS_*_URL`. |
| Caddy returns `502` | Neuraxis is not listening on `127.0.0.1:9137` | Check `NEURAXIS_HOST`, `NEURAXIS_PORT`, and the Neuraxis uvicorn log. |
| Controller marks agent unreachable | Controller config still uses `http://` or an IP address | Update `nodes.<name>.url` or rerun agent onboarding with HTTPS URLs. |
| Mobile app cannot connect to private CA host | Phone does not trust the private CA | Install the root CA on the phone or use a public ACME certificate. |
