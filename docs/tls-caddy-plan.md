# TLS Plan: Caddy + Private CA

This document covers the plan for encrypting all inter-node traffic between the
controller and agents using Caddy as a TLS-terminating reverse proxy and
`step-ca` as a private certificate authority.

## Why This Matters

All nodes currently communicate over plain HTTP on `192.168.x.x` addresses.
On a LAN this means:

- **API keys are transmitted in plaintext** — every request and heartbeat sends
  a Bearer token that can be sniffed passively.
- **Chat content is unencrypted** — all prompts and model responses proxied
  between controller and agents are visible on the wire.
- **ARP spoofing is trivial** — any device on the same subnet can impersonate a
  node, intercept the TCP stream, and forward it without either side noticing.

TLS with certificate verification (`verify_tls: true`, already the default)
closes all of these: a spoofed connection presents an invalid cert and is
rejected rather than silently succeeding.

## Architecture

Each machine runs two processes:

```
Internet/LAN
     │
     ▼
  Caddy :443          ← TLS termination, cert from private CA
     │
     ▼
  Uvicorn :9137       ← bound to 127.0.0.1 only
```

Caddy proxies `https://<node-hostname>/` → `http://127.0.0.1:9137`. Uvicorn
stops accepting connections from other machines entirely.

## Node Inventory

| Role | Machine | Planned hostname |
| --- | --- | --- |
| Controller | Raspberry Pi | `pi-controller.local` (or LAN DNS name) |
| Agent | Mac mini | `mac-mini.local` |
| Agent | Linux 2080 Ti | `linux-2080ti.local` |

## Step 1: Private CA with step-ca

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

Issue a cert for each node:

```bash
# On each machine (or remotely if the CA is reachable)
step ca certificate mac-mini.local mac-mini.crt mac-mini.key \
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

## Step 2: Caddy on Each Node

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

**Pi controller** (`/etc/caddy/Caddyfile` on the Pi):

```
pi-controller.local {
    tls /etc/caddy/certs/pi-controller.crt /etc/caddy/certs/pi-controller.key
    reverse_proxy localhost:9137
}
```

**Mac mini agent** (`/etc/caddy/Caddyfile` on the Mac mini):

```
mac-mini.local {
    tls /etc/caddy/certs/mac-mini.crt /etc/caddy/certs/mac-mini.key
    reverse_proxy localhost:9137
}
```

**Linux agent** (`/etc/caddy/Caddyfile` on the Linux box):

```
linux-2080ti.local {
    tls /etc/caddy/certs/linux-2080ti.crt /etc/caddy/certs/linux-2080ti.key
    reverse_proxy localhost:9137
}
```

Reload Caddy after editing:

```bash
sudo systemctl reload caddy   # Linux
caddy reload                  # macOS / manual
```

## Step 3: Lock Down Uvicorn to Localhost

In each machine's startup environment (`.neuraxis.env` or the shell that
sources it), set:

```bash
export NEURAXIS_HOST=127.0.0.1
```

`start_controller.sh` and `start_agent.sh` both read `NEURAXIS_HOST` and pass
it to uvicorn. After this change, uvicorn only accepts connections from the
local machine; all external traffic must come through Caddy.

## Step 4: Update Node URLs

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
needed — just update the URLs and ensure the CA root is trusted system-wide.

## Step 5: Smoke Check

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
curl -s -H "Authorization: Bearer $NEURAXIS_ADMIN_API_KEY" \
  https://pi-controller.local/nodes
```

## Ongoing Maintenance

| Task | When |
| --- | --- |
| Renew node certs | Before expiry (step-ca can automate this with `step ca renew --daemon`) |
| Rotate CA root | Annually or if the CA key is compromised |
| Check Caddy logs | `journalctl -u caddy` or `caddy adapt --watch` for config errors |
| Add a new node | Issue a cert, write a Caddyfile block, update controller node config with `https://` URL |
