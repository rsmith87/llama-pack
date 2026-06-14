# Mobile Remote Client V1 Design

## Summary

Llama Pack should support a mobile app that acts as a remote controller
client for a user's home llama_pack system. V1 is not a compute node and
does not run local inference on the phone. The app connects to the controller,
lets the user chat through existing controller routing, and provides a compact
operations surface for inspecting and managing known workers and models.

The future "phone as compute" idea should be handled as a separate ephemeral
worker design. V1 should create the mobile authentication and controller API
foundation without adding phone-side inference, background work, or scheduler
changes.

## Goals

- Let a user access their llama_pack controller from a phone, including from
  outside the home network when they have a secure network path.
- Support mobile chat through the controller's existing chat and routing
  system.
- Show controller, node, model, and health status in a phone-friendly shape.
- Provide limited safe management actions for existing nodes and models.
- Add mobile pairing and revocation so users do not paste long admin keys into
  the app.
- Keep mobile credentials scoped and independently revocable.
- Reuse existing controller APIs where practical.
- Add small controller-side aggregate endpoints only where mobile screens would
  otherwise need several fragile round trips.

## Non-Goals

- Do not make the phone a model-serving node in v1.
- Do not add ephemeral worker registration, phone-side inference, or scheduler
  support in v1.
- Do not support background compute on the phone.
- Do not download, store, or manage GGUF files on the phone.
- Do not expose the controller publicly without authentication and TLS.
- Do not require raw public IP port forwarding as the default remote-access
  path.
- Do not attempt full parity with the desktop/web UI in v1.
- Do not add push notifications in v1.

## User Experience

The mobile app should be organized around common remote operations instead of
mirroring every desktop screen.

### Pairing

The user opens the existing web UI on a trusted device and creates a mobile
pairing code. The controller displays a QR code containing:

- controller URL
- one-time pairing token
- token expiration timestamp
- optional controller display name

The phone scans the QR code and exchanges the one-time token for a mobile
session credential. The credential is stored in the phone's secure storage and
can be revoked from the controller.

### Chat

The chat screen should allow the user to:

- select an available model or controller route
- continue or start a thread
- send messages through the controller
- receive streaming responses
- see compact route metadata when available
- retry or cancel an in-flight response

The default view should optimize for conversation. Operational details such as
node choice, route reason, and model artifact presence should be available but
not dominate the chat screen.

### Nodes

The nodes screen should show:

- configured and dynamically registered nodes
- online/offline status
- heartbeat age
- node URL or friendly name
- running models
- basic resource or capability summaries when available

Safe v1 actions can include refresh, inspect details, and existing start/stop
model operations if the user's mobile credential allows them. Destructive,
expensive, or ambiguous actions should remain web-only until mobile workflows
are designed separately.

### Models

The models screen should show:

- models known to the controller
- which nodes have each model artifact
- which nodes are currently running each model
- whether the model is routable for chat

V1 should avoid mobile-first model download, conversion, quantization, or
transfer flows unless those operations already have mature controller APIs and
clear safe states.

### System Status

The status screen should show:

- controller reachability
- authenticated account or device label
- controller mode and version/build metadata when available
- API health
- recent connection errors

### Settings

The settings screen should show:

- paired controller list
- active controller URL
- connection mode label, such as local, VPN, or tunnel
- logout/revoke local session
- basic app diagnostics

Multiple controllers can be supported by the data model, but v1 can ship with
one active controller if that keeps the first app simple.

## Remote Access Assumptions

V1 should not own the user's network perimeter. The app should work with any
reachable HTTPS or private-network controller URL, but the recommended setup
path should be one of:

- Tailscale or WireGuard private networking
- Cloudflare Tunnel or a similar authenticated HTTPS tunnel
- a manually managed public HTTPS endpoint with TLS and strict authentication

Raw port forwarding to the controller should not be the happy path. If
documented, it should be presented as advanced and should require TLS,
authentication, revocation, and audit logging.

The mobile app should not need the controller to know the phone's public IP.
For v1, all traffic is client-to-controller request traffic.

## Controller Authentication

Mobile access should use pairing-derived credentials rather than the existing
admin API key directly.

### Pairing Token

The controller should provide endpoints to:

- create a short-lived mobile pairing token
- render or return QR material for that token
- exchange the token for a mobile credential

Pairing tokens should be:

- single use
- short lived
- created only by an already authenticated admin session
- stored server-side as hashes, not raw tokens
- bound to an intended scope where practical

### Mobile Credential

Mobile credentials should be:

- scoped independently from admin keys
- stored hashed server-side
- revocable by device
- named by device label
- auditable when used
- usable from changing IP addresses

Initial scopes should be intentionally small:

| Scope | Allows |
| --- | --- |
| `mobile:chat` | chat and thread operations through the controller |
| `mobile:read` | read controller, node, model, and health status |
| `mobile:operate` | limited non-destructive node/model actions |
| `mobile:admin` | reserved for future full management workflows |

The v1 app can request `mobile:chat` and `mobile:read` by default. Management
actions should require `mobile:operate`.

## Controller API Shape

The app should reuse current APIs where the response shape is already stable
and mobile-friendly. Add aggregate endpoints only where needed to avoid brittle
mobile orchestration.

Potential v1 endpoints:

```text
POST /lm-api/v1/mobile/pairing-tokens
POST /lm-api/v1/mobile/sessions
GET  /lm-api/v1/mobile/sessions
DELETE /lm-api/v1/mobile/sessions/{session_id}

GET  /lm-api/v1/mobile/overview
GET  /lm-api/v1/mobile/chat/options
GET  /lm-api/v1/mobile/nodes
GET  /lm-api/v1/mobile/models
```

`/mobile/overview` should be a compact dashboard payload for the app launch
screen. It can include controller health, node counts, online/offline counts,
running model count, and recent error summaries.

`/mobile/chat/options` should expose the model and route choices that are safe
to show on a phone. The app should not have to infer routable chat options by
probing unrelated model, node, and capability endpoints.

Existing chat endpoints can continue to handle the actual prompt and streaming
path if they support mobile credentials and return enough route metadata.

## Data Model

The controller should persist mobile auth state in the auth database.

Suggested entities:

```text
mobile_pairing_tokens
- id
- token_hash
- created_at
- expires_at
- used_at
- created_by
- requested_scopes
- controller_url_hint

mobile_sessions
- id
- device_label
- credential_hash
- scopes
- created_at
- last_seen_at
- revoked_at
- revoked_by
- user_agent
```

This should live alongside existing auth storage patterns rather than creating
a separate mobile-only database.

## Mobile App Architecture

The app should be a real mobile client, not a compute process. The initial app
can be implemented as a native iOS app, native Android app, or a cross-platform
framework, but the controller contract should not depend on the UI framework.

Local app storage should contain:

- paired controller records
- secure mobile credential storage
- last selected controller
- lightweight cached display state

The app should treat the controller as the source of truth. Offline mode can
show cached status, but v1 does not need offline command queues.

## Security And Privacy

- Require authenticated controller access for all mobile endpoints.
- Prefer HTTPS or private VPN addresses for remote access.
- Never encode long-lived credentials directly in QR codes.
- Hash pairing tokens and mobile credentials in controller storage.
- Let users revoke individual mobile devices.
- Include mobile session use in audit events where the project already records
  security-relevant actions.
- Keep mobile scopes narrower than admin keys.
- Avoid storing prompt history on the phone beyond what the OS and app need for
  normal UI state.

## Error Handling

The app should distinguish:

- controller unreachable
- TLS or VPN failure
- credential revoked
- pairing token expired
- insufficient mobile scope
- target node offline
- model unavailable
- inference failed after routing

The controller should return stable error codes/messages for these cases so the
mobile app can show useful recovery actions instead of generic failure text.

## Testing

Backend tests should cover:

- pairing token creation, expiration, one-time use, and hashing
- mobile session creation and revocation
- scope enforcement for read, chat, and operate actions
- mobile aggregate endpoint payloads
- audit events for pairing and revocation where audit logging applies

API compatibility tests should verify that mobile credentials can call the
intended chat and read endpoints without granting broader admin access.

Mobile tests should cover:

- QR pairing success and expired-token failure
- credential persistence and logout
- controller unreachable state
- chat streaming rendering and cancellation
- node/model list rendering with empty, offline, and mixed-status payloads

## Rollout Plan

1. Add controller-side mobile pairing and session auth.
2. Add mobile-scoped authorization checks to existing read/chat APIs.
3. Add mobile aggregate endpoints for overview, chat options, nodes, and
   models.
4. Build the first mobile app with pairing, chat, nodes, models, status, and
   settings.
5. Document recommended remote access using Tailscale or another private/tunnel
   option.
6. Revisit phone-as-compute as a separate ephemeral worker design after the
   remote client is useful.

## Open Follow-Up

The next design should decide the mobile app implementation stack. That choice
should consider whether the first target is iOS only, Android only, or both,
and whether the project should prefer native APIs or a cross-platform UI layer.
