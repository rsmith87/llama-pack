# Caddy Local TLS Setup

This is the operator checklist for running Neuraxis controller and agent nodes
over local HTTPS with Caddy.

You can run Neuraxis without this TLS setup by exposing uvicorn directly on the
LAN:

```bash
export NEURAXIS_HOST=0.0.0.0
export NEURAXIS_PORT=9137
```

In that direct HTTP mode, controller and agent URLs use
`http://<host>:9137`. That is simpler, but API keys, prompts, responses, and
heartbeats travel in plaintext. For local TLS, change `NEURAXIS_HOST` to
`127.0.0.1`, use `https://<host>.local` URLs, and expose Caddy on `443`.

The target shape is:

```text
other machines -> https://<node>.local:443 -> Caddy -> http://127.0.0.1:9137
```

Neuraxis still uses API keys for authorization. Caddy adds transport
encryption and keeps uvicorn off the LAN.

## Hostnames

Use stable hostnames everywhere, not IP addresses:

| Role | Hostname |
| --- | --- |
| Controller | `pi-controller.local` |
| Mac agent | `mac-mini.local` |
| Linux agent | `linux-2080ti.local` |

The same hostname must be used in:

- `/etc/hosts`, mDNS, or LAN DNS
- the certificate DNS SAN
- the Caddy site block
- `NEURAXIS_CONTROLLER_URL`, `NEURAXIS_AGENT_URL`, and controller `nodes:`

After changing `/etc/hosts`, restart the affected Neuraxis process so long-lived
HTTP clients do not keep stale resolution behavior.

## Public Controller, Private Agents

For external user or mobile access, the best default topology is a public
controller domain with private agents reachable only over a VPN/private network.

```text
public users/mobile apps
        |
        v
https://controller.example.com  ->  Caddy on controller  ->  127.0.0.1:9137
        |
        | controller-to-agent over VPN/private DNS
        v
https://linux-2080ti.tailnet-name.ts.net or https://linux-2080ti.internal
https://mac-mini.tailnet-name.ts.net or https://mac-mini.internal
```

In this topology:

- The controller has a public DNS name and public HTTPS certificate, preferably
  from ACME/Let's Encrypt through Caddy.
- Agents stay off the public internet. Their Caddy listeners are reachable only
  from the controller over Tailscale, WireGuard, a private subnet, or a private
  DNS/VPN name.
- Public clients use only the controller URL.
- The controller `nodes:` URLs use the private/VPN agent names.
- Agents set `NEURAXIS_CONTROLLER_URL` to the public controller URL, because
  their heartbeat and work-claim traffic goes outbound to the controller.
- Agents set `NEURAXIS_AGENT_URL` to their private/VPN URL, because that is the
  URL the controller uses to call them.

Example controller `.neuraxis.env`:

```bash
export NEURAXIS_HOST=127.0.0.1
export NEURAXIS_MAC_MINI_AGENT_URL=https://mac-mini.tailnet-name.ts.net
export NEURAXIS_LINUX_2080TI_AGENT_URL=https://linux-2080ti.tailnet-name.ts.net
```

Example Mac agent `.neuraxis.env`:

```bash
export NEURAXIS_HOST=127.0.0.1
export NEURAXIS_CONTROLLER_URL=https://controller.example.com
export NEURAXIS_AGENT_URL=https://mac-mini.tailnet-name.ts.net
```

Example Linux agent `.neuraxis.env`:

```bash
export NEURAXIS_HOST=127.0.0.1
export NEURAXIS_CONTROLLER_URL=https://controller.example.com
export NEURAXIS_AGENT_URL=https://linux-2080ti.tailnet-name.ts.net
```

Controller Caddy with a public ACME cert can be as simple as:

```caddyfile
controller.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:9137
}
```

Agent Caddy can still use private CA certs, Tailscale HTTPS certs, or any
certificate trusted by the controller's Python runtime. If agent certs are
private CA certs, the controller must still set `SSL_CERT_FILE` and
`REQUESTS_CA_BUNDLE` to the private CA chain bundle.

Do not expose agent Caddy listeners publicly unless the controller cannot reach
them privately. Public agents increase the attack surface and require tighter
firewall, monitoring, and key-rotation discipline.

## Certificate Files

The CA root and intermediate cert are created by `step ca init` on the CA
machine. They are often under:

```bash
~/.step/certs/root_ca.crt
~/.step/certs/intermediate_ca.crt
```

If they are not there, ask Step where it keeps its files:

```bash
step path
step context current
step context inspect
```

Or search:

```bash
find ~ -name 'root_ca.crt' -o -name 'intermediate_ca.crt'
```

Copy both CA certs to every machine and keep a local staging copy:

```bash
mkdir -p ~/neuraxis-certs
cp ~/.step/certs/root_ca.crt ~/neuraxis-certs/ca-root.crt
cp ~/.step/certs/intermediate_ca.crt ~/neuraxis-certs/intermediate_ca.crt
cat ~/neuraxis-certs/ca-root.crt ~/neuraxis-certs/intermediate_ca.crt \
  > ~/neuraxis-certs/neuraxis-ca-chain.crt
```

On other nodes, copy it with `scp` or another trusted transfer method:

```bash
mkdir -p ~/neuraxis-certs
# copy root_ca.crt into ~/neuraxis-certs/ca-root.crt
# copy intermediate_ca.crt into ~/neuraxis-certs/intermediate_ca.crt
cat ~/neuraxis-certs/ca-root.crt ~/neuraxis-certs/intermediate_ca.crt \
  > ~/neuraxis-certs/neuraxis-ca-chain.crt
```

Install the root into system trust.

macOS:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ~/neuraxis-certs/ca-root.crt
```

Debian, Ubuntu, and Raspberry Pi OS:

```bash
sudo cp ~/neuraxis-certs/ca-root.crt /usr/local/share/ca-certificates/neuraxis-ca.crt
sudo update-ca-certificates
```

System trust is not always enough for Python/httpx on every platform. Also
point Neuraxis at the CA chain bundle in each node's `.neuraxis.env`:

```bash
export SSL_CERT_FILE=/home/rsmith/neuraxis-certs/neuraxis-ca-chain.crt
export REQUESTS_CA_BUNDLE=/home/rsmith/neuraxis-certs/neuraxis-ca-chain.crt
```

Use the local account path on each machine. On the Mac mini, for example:

```bash
export SSL_CERT_FILE=/Users/robertsmith/neuraxis-certs/neuraxis-ca-chain.crt
export REQUESTS_CA_BUNDLE=/Users/robertsmith/neuraxis-certs/neuraxis-ca-chain.crt
```

## Issue Node Certificates

`step-ca` only needs to be running when issuing or renewing certificates.

Start it on the CA machine when needed:

```bash
step-ca ~/.step/config/ca.json
```

Issue each node certificate with the exact hostname clients will use.

Controller:

```bash
step ca certificate pi-controller.local pi-controller.crt pi-controller.key \
  --ca-url https://pi-controller.local:8443 \
  --root ~/.step/certs/root_ca.crt \
  --not-after 720h
```

Mac agent:

```bash
step ca certificate mac-mini.local mac-mini.crt mac-mini.key \
  --ca-url https://pi-controller.local:8443 \
  --root ~/neuraxis-certs/ca-root.crt \
  --not-after 720h
```

Linux agent:

```bash
step ca certificate linux-2080ti.local linux-2080ti.crt linux-2080ti.key \
  --ca-url https://pi-controller.local:8443 \
  --root ~/neuraxis-certs/ca-root.crt \
  --not-after 720h
```

The `--not-after 720h` example gives 30-day certs if the CA policy allows it.
Shorter default certs work, but they need renewal sooner.

## Install Certs For Caddy

Caddy should serve a fullchain certificate: the node leaf certificate followed
by the intermediate CA certificate. Without the intermediate, `curl` may still
work in some environments while Python/httpx fails with
`unable to get local issuer certificate`.

Linux and Raspberry Pi:

```bash
scripts/install_caddy_fullchain.sh \
  --name pi-controller \
  --leaf pi-controller.crt \
  --key pi-controller.key \
  --intermediate ~/neuraxis-certs/intermediate_ca.crt
```

The script builds `pi-controller-fullchain.crt` from the user-writable leaf and
intermediate files, then uses `sudo install` to write:

- `/etc/caddy/certs/pi-controller.crt` with mode `644`
- `/etc/caddy/certs/pi-controller-fullchain.crt` with mode `644`
- `/etc/caddy/certs/pi-controller.key` with mode `640`
- `/etc/caddy/certs/` with owner `root:caddy` and mode `750`

Use `--dry-run` to preview the `sudo install` commands after building the local
fullchain. For `linux-2080ti.local`, replace `pi-controller` with
`linux-2080ti`.

macOS with Homebrew on Apple Silicon:

```bash
sudo mkdir -p /opt/homebrew/etc/caddy/certs
sudo cp mac-mini.crt /opt/homebrew/etc/caddy/certs/mac-mini.crt
sudo cp mac-mini.key /opt/homebrew/etc/caddy/certs/mac-mini.key
cat mac-mini.crt ~/neuraxis-certs/intermediate_ca.crt > mac-mini-fullchain.crt
sudo cp mac-mini-fullchain.crt /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt
sudo chown robertsmith:staff /opt/homebrew/etc/caddy/certs/mac-mini.key
sudo chmod 644 /opt/homebrew/etc/caddy/certs/mac-mini.crt
sudo chmod 644 /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt
sudo chmod 600 /opt/homebrew/etc/caddy/certs/mac-mini.key
```

Use `brew --prefix` to confirm `/opt/homebrew`. Intel Homebrew commonly uses
`/usr/local`.

## Caddyfiles

Linux and Raspberry Pi use `/etc/caddy/Caddyfile`.

Controller:

```caddyfile
pi-controller.local {
    tls /etc/caddy/certs/pi-controller-fullchain.crt /etc/caddy/certs/pi-controller.key
    reverse_proxy 127.0.0.1:9137
}
```

Linux agent:

```caddyfile
linux-2080ti.local {
    tls /etc/caddy/certs/linux-2080ti-fullchain.crt /etc/caddy/certs/linux-2080ti.key
    reverse_proxy 127.0.0.1:9137
}
```

macOS with Homebrew uses `/opt/homebrew/etc/Caddyfile` on Apple Silicon:

```caddyfile
mac-mini.local {
    tls /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt /opt/homebrew/etc/caddy/certs/mac-mini.key
    reverse_proxy 127.0.0.1:9137
}
```

Repo templates are also available under `deploy/caddy/`.

## Run Caddy As A Service

Linux and Raspberry Pi:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

After Caddyfile changes:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

macOS Homebrew:

```bash
caddy validate --config /opt/homebrew/etc/Caddyfile
brew services start caddy
brew services list | grep caddy
```

If `brew services` reports an error, run this to expose the real failure:

```bash
caddy run --config /opt/homebrew/etc/Caddyfile
```

If the error says `127.0.0.1:2019` is already in use, another Caddy process is
already running. Stop the manual process, then restart the service:

```bash
sudo pkill caddy
brew services restart caddy
```

## Lock Down Neuraxis

Set uvicorn to loopback on every node:

```bash
export NEURAXIS_HOST=127.0.0.1
```

If using `.neuraxis.env`, add or update:

```bash
export NEURAXIS_HOST=127.0.0.1
export NEURAXIS_PORT=9137
```

Restart Neuraxis after changing `.neuraxis.env`:

```bash
scripts/stop_server.sh
scripts/start_controller.sh   # controller machine
scripts/start_agent.sh        # agent machines
```

## Switch Neuraxis URLs To HTTPS

Controller `.neuraxis.env`:

```bash
export NEURAXIS_MAC_MINI_AGENT_URL=https://mac-mini.local
export NEURAXIS_LINUX_2080TI_AGENT_URL=https://linux-2080ti.local
export SSL_CERT_FILE=/home/rsmith/neuraxis-certs/neuraxis-ca-chain.crt
export REQUESTS_CA_BUNDLE=/home/rsmith/neuraxis-certs/neuraxis-ca-chain.crt
```

Mac agent `.neuraxis.env`:

```bash
export NEURAXIS_CONTROLLER_URL=https://pi-controller.local
export NEURAXIS_AGENT_URL=https://mac-mini.local
export SSL_CERT_FILE=/Users/robertsmith/neuraxis-certs/neuraxis-ca-chain.crt
export REQUESTS_CA_BUNDLE=/Users/robertsmith/neuraxis-certs/neuraxis-ca-chain.crt
```

Linux agent `.neuraxis.env`:

```bash
export NEURAXIS_CONTROLLER_URL=https://pi-controller.local
export NEURAXIS_AGENT_URL=https://linux-2080ti.local
export SSL_CERT_FILE=/home/neuraxis/neuraxis-certs/neuraxis-ca-chain.crt
export REQUESTS_CA_BUNDLE=/home/neuraxis/neuraxis-certs/neuraxis-ca-chain.crt
```

Controller node config should use HTTPS and keep TLS verification enabled:

```yaml
nodes:
  mac-mini:
    url: https://mac-mini.local
    api_key: ${NEURAXIS_MAC_MINI_AGENT_API_KEY}
    verify_tls: true
  linux-2080ti:
    url: https://linux-2080ti.local
    api_key: ${NEURAXIS_LINUX_2080TI_AGENT_API_KEY}
    verify_tls: true
```

## Verification

Run from each machine:

```bash
curl -v https://pi-controller.local/health
curl -v https://mac-mini.local/health
curl -v https://linux-2080ti.local/health
```

The TLS output should include:

```text
subjectAltName: host "<node>.local" matched
SSL certificate verify ok.
```

Local uvicorn should still work on the node itself:

```bash
curl -v http://127.0.0.1:9137/health
```

Direct remote uvicorn access should fail:

```bash
curl -v http://mac-mini.local:9137/health
curl -v http://pi-controller.local:9137/health
curl -v http://linux-2080ti.local:9137/health
```

Controller node visibility:

```bash
curl -s -H "X-Llama-Manager-Key: $NEURAXIS_CONTROLLER_ADMIN_API_KEY" \
  https://pi-controller.local/lm-api/v1/nodes
```

Python/httpx trust from each node:

```bash
SSL_CERT_FILE=$HOME/neuraxis-certs/neuraxis-ca-chain.crt python3 - <<'PY'
import urllib.request
for url in [
    "https://pi-controller.local/health",
    "https://mac-mini.local/health",
    "https://linux-2080ti.local/health",
]:
    print(url, urllib.request.urlopen(url, timeout=5).read())
PY
```

Heartbeats flow from each agent to the controller. If `/ui/nodes` shows stale
heartbeats, test the controller URL from the agent process environment first:

```bash
SSL_CERT_FILE=$HOME/neuraxis-certs/neuraxis-ca-chain.crt python3 - <<'PY'
import urllib.request
print(urllib.request.urlopen("https://pi-controller.local/health", timeout=5).read())
PY
```

The controller also calls agents for `/ui/nodes` model/status data, so the
controller's Python environment must trust the same CA chain.

## Troubleshooting

| Symptom | Meaning | Fix |
| --- | --- | --- |
| `HTTP/2 502` from Caddy | TLS works, upstream Neuraxis is not reachable | Check `curl http://127.0.0.1:9137/health` on that node and verify `reverse_proxy`. |
| `certificate verify failed` | Root CA is not trusted by the client | Install `ca-root.crt` into the client system trust store. |
| `unable to get local issuer certificate` in Python/httpx | Missing intermediate chain or Python is not using system trust | Serve `*-fullchain.crt` from Caddy and set `SSL_CERT_FILE` to `neuraxis-ca-chain.crt`. |
| `certificate is valid for ..., not ...` | Hostname does not match the cert SAN | Reissue the node cert with the exact `.local` hostname. |
| `step: Unknown options: ca-url, root` | Wrong `step` binary or old CLI | Install Smallstep `step-cli`, then check `step ca certificate --help`. |
| `connect: connection refused` on `:8443` | `step-ca` is not running | Start `step-ca ~/.step/config/ca.json` while issuing certs. |
| `127.0.0.1:2019 already in use` | Another Caddy process is running | Stop the manual process or restart the service cleanly. |
| Caddy reload says cert/key permission denied | Caddy service user cannot read `/etc/caddy/certs` | Use `systemctl show caddy -p User -p Group`, then `chown root:caddy`, `chmod 750` on the cert dir, `640` on keys, and `644` on certs. |
| Pi can ping an agent but HTTPS hangs | Firewall blocks TCP 443 | Allow `443/tcp` on the agent, for example `sudo ufw allow 443/tcp`. |
| Admin API returns `Unauthorized` with `Authorization: Bearer ...` | Neuraxis does not use Bearer auth for admin APIs | Send `X-Llama-Manager-Key: $NEURAXIS_CONTROLLER_ADMIN_API_KEY`. |

## Mobile App Note

Private CA HTTPS is fine for LAN/VPN mobile testing only after the phone trusts
the private root CA. For broader mobile access, prefer a public ACME cert on a
real domain such as `controller.example.com`.
