# Business Local AI Roadmap

This plan tracks features that would make Neuraxis useful for businesses that
want to reduce spend on paid AI services by running local or self-hosted models.

Business features should ship as an optional add-on/plugin. The core product
should remain free, home-network friendly, and fully usable without business
dashboards, identity providers, quotas, document governance, or audit-heavy
workflows.

For the plugin runtime, frontend extension host, versioning, security boundary,
namespaces, migrations, and testing strategy, see
[plugin-architecture.md](plugin-architecture.md).
For the first plugin foundation implementation pass, see
[plugin-foundation-implementation-plan.md](plugin-foundation-implementation-plan.md).

## Product Goal

Make Neuraxis practical for small and medium business deployments where multiple
employees use shared local AI capacity for chat, document work, automation, and
internal knowledge access.

The product should help administrators answer:

- Who is using local AI?
- What is it being used for?
- Is capacity healthy?
- Is sensitive data controlled?
- Is the local system saving money compared with paid AI services?

## Product Boundary

Neuraxis core owns the free, home-friendly local AI runtime:

- Model management.
- Native chat.
- OpenAI-compatible and Ollama-compatible APIs.
- Basic auth and API keys.
- Node/controller operation.
- Chat admission and queue safety.
- Per-thread turn serialization.
- Basic logs and health.
- Plugin extension points.

The optional `neuraxis_business` plugin owns enterprise-level features:

- Usage accounting dashboards.
- Team, user, department, and group management.
- Quotas and workload policy.
- SSO/OIDC/SAML and directory integrations.
- Audit reporting.
- Business assistants and team workspaces.
- Document governance.
- Cost-savings reports.
- Advanced admin dashboards.
- Compliance-oriented retention/export controls.
- Enterprise connectors.

Core should work whether or not the business plugin is installed.

## Prioritized Backlog

### P0: Capacity Safety For Everyone

Status: **complete** (core).

This is foundational and should stay enabled for both home and plugin-backed
business deployments:

- Add controlled admission for expensive chat generation work.
- Limit active generations per model and target node.
- Limit active generations per public/test-chat session.
- Bound queues so overload returns explicit errors instead of hanging.
- Support queue timeouts and cancellation.
- Keep streaming responses admitted for the full stream lifetime.
- Preserve OpenAI-compatible, Ollama-compatible, and native chat APIs.
- Serialize turns within the same thread so conversation history cannot race.

Why this comes first: multiple users or browser tabs can overload local model
servers quickly. The system needs predictable behavior before business features
are layered on top.

### P1: Plugin Foundation

Status: **complete** (core).

Build the modular plugin foundation before implementing business-only features:

- Manifest loading and validation.
- Config-driven plugin enable/disable.
- Plugin entrypoint loading.
- `PluginContext` registration API.
- Backend route registration.
- Plugin-owned frontend asset metadata.
- Static serving for plugin frontend assets.
- Frontend route, primary navigation, and scoped secondary navigation metadata.
- Frontend extension host placeholder.
- Usage event bus.
- Policy hook registry.
- Plugin health checks.
- Plugin migration metadata.
- `/lm-api/v1/plugins/enabled` metadata endpoint.
- Plugin failure warnings surfaced to administrators.
- Route and asset namespace collision checks.
- Plugin API/frontend API version compatibility checks.

Why this comes before business dashboards: it preserves the free/home core and
prevents enterprise features from becoming hard dependencies in the application.

### P2: Plugin Event Contracts

Status: **complete** (core + `neuraxis_business`).

Define stable event schemas before business usage accounting depends on them:

- Event names and required fields.
- Redaction rules.
- Correlation/request ids.
- User, session, and API-key identifiers where available.
- Queue wait, latency, token counts, status, and route metadata.
- Tests for event subscriber delivery and privacy defaults.

`ChatScheduler` now emits `neuraxis.chat.admitted`, `neuraxis.chat.rejected`,
`neuraxis.chat.completed`, and `neuraxis.chat.failed` with a stable dict payload.
The business plugin subscribes to all four.

Why this comes before usage accounting: the business plugin should consume
stable events instead of depending on route internals.

### P3: Capacity Dashboard

Status: **complete** (`neuraxis_business`).

Add administrator visibility into live usage:

- Active requests by model and node.
- Queue depth by model and node.
- Queue wait time.
- Generation latency.
- Failed and rejected requests.
- Node online/offline state.
- GPU, CPU, RAM, and VRAM health.
- Model load/unload events.

`CapacityTracker` maintains in-memory per-model counters driven by event
subscriptions. `GET /capacity` returns live stats. Node/GPU health is deferred.

Why this is high priority: an admin needs to know whether the local AI system is
healthy before employees depend on it.

### P4: Usage Accounting

Status: **complete** (`neuraxis_business`).

Track business-level usage even when inference is locally hosted:

- User, team, API key, model, node, and request type.
- Prompt token count, completion token count, and total tokens.
- Queue wait time and generation time.
- Streaming versus non-streaming requests.
- Failed, timed out, and rejected requests.
- Estimated compute cost or GPU time.

`UsageStore` writes `chat_usage_events` durably to `identity.db` via
`PluginContext.get_state_dir()`. `GET /usage/history` exposes records.
Per-user enrichment added in P5. Cost estimation is deferred.

Reports should help compare local usage against paid AI service spend.

### P5: Business Identity Foundation

Status: **complete** (`neuraxis_business`).

Move from shared keys toward business identity:

- Users, groups, and departments.
- Role-based access beyond admin/operator/viewer/test-chat.
- API key scopes and ownership.
- Per-user and per-team audit trails.
- SSO/OIDC support.
- SAML support if needed for larger customers.
- LDAP or Active Directory integration.

`IdentityStore` provides durable `User`, `Group`, `UserGroupMembership`, and
`SessionIdentity` tables in `identity.db`. Admin CRUD endpoints under
`/identity/users` and `/identity/groups`. `POST /identity/sessions` maps a chat
`session_id` to a known user (resolve-only, no auto-provisioning). Completed
chat events are enriched with `user_id` and `department`. Role-based access,
OIDC/SAML, and directory integrations are deferred.

### P6: Quotas And Workload Policy

Business plugin: provided by `neuraxis_business`.

Extend capacity safety into business policy:

- Per-user quotas.
- Per-team quotas.
- Per-API-key quotas.
- Priority users or departments.
- Admin override.
- Queue visibility by user or team.
- Explicit `429` or `503` behavior when limits are exceeded.
- Optional fallback to a smaller or faster model when capacity is saturated.

Why this matters: business deployments need fairness. One user or integration
should not be able to consume the whole local cluster.

### P7: Document Upload, Retrieval, And Citations

Business plugin: provided by `neuraxis_business`.

Businesses usually need more than general chat:

- Upload and index PDFs, Word documents, spreadsheets, and text files.
- Ask questions over internal documents.
- Return source citations for retrieval-based answers.
- Summarize documents.
- Compare documents.
- Extract structured data from documents.
- Build department-specific knowledge bases.
- Enforce document access permissions during retrieval.

Why this is a major milestone: document and knowledge workflows are often the
clearest replacement for paid AI products.

### P8: Governance And Data Controls

Business plugin: provided by `neuraxis_business`.

Make the privacy advantages of local hosting explicit:

- Configurable chat and document retention.
- Do-not-store mode for sensitive chats.
- PII and secret detection.
- Optional prompt redaction.
- Audit logs for document retrieval and admin actions.
- Export and delete user data.
- Encryption guidance for local databases and storage.
- Clear settings for what is logged.

### P9: Assistant And Workspace Management

Business plugin: provided by `neuraxis_business`.

Let admins define reusable business assistants:

- Assistant name, description, model, and system prompt.
- Allowed users or groups.
- Allowed document collections.
- Temperature, max tokens, and other generation settings.
- Logging and retention policy.
- Default request type and routing policy.

Example assistants:

- HR policy assistant.
- Support response drafter.
- Sales email assistant.
- Code review assistant.
- Legal document summarizer.
- Operations SOP assistant.

Team spaces should support shared assistants, shared document collections, and
department-specific permissions.

### P10: API Migration Features

Core plus business plugin. Compatibility APIs belong in core. API key scopes,
quotas, and usage reports belong in `neuraxis_business`.

Make it easy to redirect existing tools from paid APIs to Neuraxis:

- Keep improving OpenAI-compatible chat completions.
- Support embeddings.
- Support structured output.
- Support tool/function calling.
- Support streaming.
- Add API key scopes and quotas in the business plugin.
- Add usage logs by API key in the business plugin.
- Document migration examples for common SDKs.

### P11: Local Connectors

Business plugin: provided by `neuraxis_business`.

Help businesses bring existing data into local AI workflows:

- Local file shares.
- Google Drive.
- SharePoint and OneDrive.
- Slack or Microsoft Teams.
- Jira.
- GitHub and GitLab.
- Confluence.
- Notion.
- Email import.

Start with local filesystem and file-share indexing because it is useful without
requiring third-party cloud credentials.

### P12: Backup, Restore, And Operations

Core plus business plugin. Basic backup guidance belongs in core. Business
retention, audit, and compliance workflows belong in `neuraxis_business`.

Support serious self-hosted deployments:

- Backups for config, databases, chat history, and document indexes.
- Restore flow and migration checks.
- Multiple controller or worker nodes.
- Health-based routing.
- Model placement rules.
- Node drain and maintenance mode.
- Warm standby models.
- Graceful shutdown that finishes or cancels active requests predictably.
- Queue persistence across restart for eligible jobs.

### P13: Quality Controls

Business plugin: provided by `neuraxis_business`.

Give administrators a way to measure whether local models are good enough:

- Prompt evaluation suites.
- Business-task benchmarks.
- Model comparison views.
- Regression testing after model changes.
- User feedback buttons.
- Reports showing which model performs best for each task type.

### P14: Plugin Developer Experience

Core feature.

Make plugin development practical for future contributors:

- Minimal sample plugin.
- Manifest schema documentation.
- Backend extension API documentation.
- Frontend extension API documentation.
- Plugin build workflow documentation.
- Testing helpers.
- Hello-world plugin walkthrough.

## Suggested Milestones

### Milestone 1: Safe Shared Chat

- Chat scheduler and queue bounds.
- Per-thread turn serialization.
- User-facing overload responses.
- Basic queue/capacity data available internally.

### Milestone 2: Plugin Foundation

- Plugin manifest and enable/disable lifecycle.
- Backend route registration.
- Plugin-owned frontend asset metadata and static serving.
- Frontend route, primary navigation, and scoped secondary navigation metadata.
- Frontend extension host placeholder.
- Plugin config schema.
- Plugin-owned migrations.
- Usage event bus.
- Version compatibility checks.
- Plugin failure warnings.
- Route and asset namespace safety checks.
- Business navigation hidden unless the plugin is enabled.

### Milestone 3: Event Contracts

- Stable usage event schemas.
- Redaction/privacy defaults.
- Event subscriber tests.
- Policy hook tests.

### Milestone 4: Business Visibility

- Capacity dashboard.
- Usage accounting.
- API-key/user attribution where available.

### Milestone 5: Business Access Control

- Users, groups, and departments.
- Scoped API keys.
- Basic quotas.
- Admin policy screens.
- OIDC-ready identity model.

### Milestone 6: Business Knowledge Base

- Document upload and indexing.
- Retrieval with citations.
- Document collection permissions.
- Retention controls.
- Local file-share connector.

### Milestone 7: Business Workspaces

- Reusable assistants.
- Team spaces.
- Assistant-specific models, prompts, documents, and policies.
- Feedback and quality reporting.

### Milestone 8: Production Operations

- Backup and restore.
- Multi-node operations improvements.
- Node drain and maintenance mode.
- Health-based routing.
- Cost-savings reports.

### Milestone 9: Plugin Developer Experience

- Sample plugin.
- Manifest schema docs.
- Backend and frontend plugin API docs.
- Plugin build workflow docs.
- Testing helpers.

## Near-Term Definition Of Done

The next useful milestone is a safe shared-chat deployment:

- Multiple employees can chat at once without overloading the model server.
- Same-thread conversations cannot produce overlapping turns.
- Overload produces clear user-facing errors or queue states.
- The home-network experience remains simple by default.
- Business-only UI and policy features are unavailable unless the business
  plugin is installed and enabled.
