# Agent Tools

Agent tools give a coding agent structured, operator-controlled access to the
local machine. Most tools are read-only; write-capable tools must be explicitly
configured by the operator and are constrained by `safe_roots` and per-tool
limits. Each tool is a named YAML entry under `agent_tools.tools` with a `type`
and a `description` that is shown to the LLM.

## Configuration skeleton

```yaml
agent_tools:
  enabled: true
  max_iterations: 4          # max tool-call rounds per request (1–16)
  tool_timeout_seconds: 10   # per-tool timeout in seconds
  answer_verification_mode: warn
  answer_verification_max_retries: 1
  safe_roots:
    - /path/to/allowed/root  # all file-system tools must resolve under a safe root
  tools:
    my_tool_name:
      type: <tool_type>
      description: What this tool does (shown to the LLM).
      # ... type-specific fields
```

---

## Final Answer Verification

Project-graph chats can verify final answers before returning them. The verifier
checks repository file paths and symbol-looking claims against the active project
graph. In `warn` mode, the runtime asks the model to revise once when
unverified claims are found. In `strict` mode, unresolved verifier failures can
fail the request rather than returning an ungrounded answer.

## Prompt Assembly

Agent-tool chat prompts are assembled through
`llama_pack.core.agent_tools.prompt_builder.PromptBuilder` before they are sent
to `AgentToolLoop`. Prompt mutations for agent chats should live there rather
than in routes, tool runtime loops, or UI-specific code.

Current prompt inputs:

- Project graph context: when a project graph is active, `PromptBuilder` adds a
  system instruction telling the model to inspect indexed symbols,
  relationships, routes, and React components before making codebase claims.
- Previous-answer review context: when the latest user message asks to review,
  verify, correct, or check a previous answer, `PromptBuilder` injects the
  latest prior assistant answer in a `<previous_assistant_answer>` block. This
  keeps self-review prompts grounded in the exact answer being reviewed instead
  of conversational memory.

Add future prompt inputs by extending `PromptBuilder` with a small, test-covered
message transformation. Keep each transformation deterministic and based on
explicit request, thread, or runtime context. Do not make prompt assembly depend
on model output, and do not duplicate prompt-injection behavior in callers.

Expected call flow for OpenAI-compatible agent chats:

```text
openai_compat.openai_chat_completions
  -> PromptBuilder.build_agent_messages(...)
  -> AgentToolLoop.run(...)
```

`AgentToolLoop` may still append verification retry messages during a turn, but
initial request prompt shaping belongs in `PromptBuilder`.

---

## Tool Types

### `shell`

Run a fixed configured command and return stdout/stderr.

```yaml
list_runtime_status:
  type: shell
  description: Print a short runtime status line.
  command: ["printf", "agent runtime ok"]
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `command` | required | Command array passed to the subprocess directly (no shell). |
| `timeout_seconds` | `tool_timeout_seconds` | Override the global timeout for this tool. |

---

### `file_read`

Read a single configured file.

```yaml
read_agent_note:
  type: file_read
  description: Read a local note file.
  path: ./logs/agent-note.txt
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | File to read. Must resolve under `safe_roots`. |

---

### `file_read_dynamic`

Read a file selected by the model under a configured root directory. The model
must pass a relative `path` argument; absolute paths and traversal outside the
configured root are rejected.

```yaml
read_project_file:
  type: file_read_dynamic
  description: Read a project or log file by relative path.
  path: /path/to/llama-pack
  max_file_bytes: 524288
```

Example model arguments:

```json
{"path":"logs/backend.log"}
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Root directory for relative file reads. Must resolve under `safe_roots`. |
| `max_file_bytes` | `524288` | Reject files larger than this limit before reading. |

---

### `file_write`

Write, append, or create a single configured file. The model supplies only the
`content` argument; the destination path and write mode are fixed in YAML.

```yaml
append_agent_note:
  type: file_write
  description: Append a note to the agent scratch log.
  path: ./logs/agent-notes.md
  write_mode: append
  max_write_bytes: 32768
```

Model arguments:

```json
{"content":"\n- Checked node health.\n"}
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | File to write. Must resolve under `safe_roots`. Parent directories are created if needed. |
| `write_mode` | `append` | `append`, `write`, or `create_only`. `create_only` fails if the file already exists. |
| `max_write_bytes` | `32768` | Reject content larger than this limit (1–1048576 bytes). |

---

### `http`

Call a fixed HTTP endpoint and return the raw response body as text.

```yaml
local_health:
  type: http
  description: Check local health endpoint.
  method: GET
  url: http://127.0.0.1:9137/health
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `url` | required | Fixed endpoint URL. |
| `method` | `GET` | `GET` or `POST`. |
| `timeout_seconds` | `tool_timeout_seconds` | Override the global timeout. |

---

### `http_json`

Call a fixed HTTP endpoint and return bounded parsed JSON. Returns a structured
error if the response is not valid JSON.

```yaml
agent_health_json:
  type: http_json
  description: Check agent health and return structured JSON.
  method: GET
  url: http://127.0.0.1:9137/health
  max_response_bytes: 65536
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `url` | required | Fixed endpoint URL. |
| `method` | `GET` | `GET` or `POST`. |
| `max_response_bytes` | `65536` | Truncate response body before parsing. |
| `timeout_seconds` | `tool_timeout_seconds` | Override the global timeout. |

---

### `directory_list`

List files and directories under a configured path without shelling out.

```yaml
list_project_files:
  type: directory_list
  description: List top-level project structure.
  path: /path/to/llama-pack
  recursive: true
  max_depth: 2
  max_entries: 200
  include_hidden: false
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Directory to list. Must resolve under `safe_roots`. |
| `recursive` | `false` | Recurse into subdirectories. |
| `max_depth` | `0` | Max recursion depth when `recursive: true` (0–32). |
| `max_entries` | `200` | Max entries to return (1–5000). |
| `include_hidden` | `false` | Include dotfiles and hidden directories. |

---

### `file_search`

Search file names under a configured root by glob pattern. Safe equivalent of
`find` or `rg --files`.

```yaml
find_python_files:
  type: file_search
  description: Find Python source files in the project.
  path: /path/to/llama-pack
  glob: "**/*.py"
  max_entries: 200
  include_hidden: false
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Root to search under. Must resolve under `safe_roots`. |
| `glob` | required | Glob pattern relative to `path`. |
| `include_hidden` | `false` | Include hidden files and directories. |
| `max_entries` | `200` | Max results to return (1–5000). |

---

### `text_search`

Search file contents under a configured root. Safe equivalent of bounded `rg`.

The agent provides a `query` argument at call time (defined via `parameters`).

```yaml
search_project_code:
  type: text_search
  description: Search for text or symbols in project Python source files.
  path: /path/to/llama-pack
  glob: "**/*.py"
  case_sensitive: false
  max_matches: 50
  max_file_bytes: 524288
  regex: true
  parameters:
    type: object
    properties:
      query:
        type: string
        description: The substring or regex pattern to search for.
    required: [query]
    additionalProperties: false
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Root to search under. Must resolve under `safe_roots`. |
| `glob` | required | Glob pattern to filter which files to search. |
| `case_sensitive` | `false` | Case-sensitive matching. |
| `regex` | `false` | Treat `query` as a compiled regex instead of a substring. |
| `max_matches` | `50` | Max total matches to return (1–2000). |
| `max_file_bytes` | `524288` | Skip files larger than this (bytes). |

---

### `git_status`

Report read-only git state for a configured repository: current branch and
changed files.

```yaml
repo_status:
  type: git_status
  description: Show current git branch and changed files.
  path: /path/to/llama-pack
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Repository root. Must resolve under `safe_roots`. |
| `max_entries` | `200` | Max changed files to return. |
| `timeout_seconds` | `tool_timeout_seconds` | Override the global timeout. |

---

### `git_diff`

Show the unstaged diff (`git diff HEAD`) for a configured repository, bounded
by `max_lines`.

```yaml
repo_diff:
  type: git_diff
  description: Show unstaged changes in the project repo.
  path: /path/to/llama-pack
  max_lines: 300
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Repository root. Must resolve under `safe_roots`. |
| `max_lines` | `100` | Max diff lines to return (1–1000). |
| `timeout_seconds` | `tool_timeout_seconds` | Override the global timeout. |

---

### `git_log`

Show recent commit metadata for a configured repository.

```yaml
repo_log:
  type: git_log
  description: Show recent commits in the project repo.
  path: /path/to/llama-pack
  max_commits: 20
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Repository root. Must resolve under `safe_roots`. |
| `max_commits` | `20` | Max commits to return (1–200). |
| `timeout_seconds` | `tool_timeout_seconds` | Override the global timeout. |

Returns `hash`, `subject`, `author`, and `age` for each commit.

---

### `process_status`

Report runtime health for locally managed model servers. Reads internal Llama
Pack process state — no shell commands.

```yaml
model_health:
  type: process_status
  description: Report which model servers are running and on which ports.
  max_entries: 20
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `max_entries` | `200` | Max processes to return (1–5000). |

Returns `name`, `running`, `pid`, `port`, and `family` for each process.

---

### `log_tail`

Return the last N lines of a configured log file without shelling out.

```yaml
inference_log:
  type: log_tail
  description: Tail the most recent lines from the inference server log.
  path: logs/llama_pack_agent_uvicorn.log
  max_lines: 100
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | required | Log file to read. Must resolve under `safe_roots`. |
| `max_lines` | `100` | Max lines to return from the end of the file (1–1000). |

---

### `sqlite_query`

Run read-only SQL queries against one configured SQLite database, or against one
of several configured databases selected by stem name. Only queries whose first
non-comment token is `SELECT` or `WITH` are allowed, and connections open in
SQLite read-only mode.

Single database:

```yaml
query_audit_db:
  type: sqlite_query
  description: Query audit event metadata.
  path: ./logs/audit_events.db
  max_entries: 100
```

Multiple databases:

```yaml
query_local_dbs:
  type: sqlite_query
  description: Query selected local SQLite stores.
  paths:
    - ./logs/auth_store.db
    - ./logs/audit_events.db
    - ./logs/chat_sessions.db
  max_entries: 100
```

Model arguments:

```json
{"db":"audit_events","query":"select id, event_type, created_at from audit_events limit 20"}
```

For a single configured `path`, omit `db`:

```json
{"query":"select count(*) as total from audit_events"}
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `path` | optional | SQLite database file. Required unless `paths` is set. Must resolve under `safe_roots`. |
| `paths` | `[]` | Multiple SQLite database files. The model chooses one with `db`, using the file stem such as `audit_events`. |
| `max_entries` | `200` | Max rows to return (1–5000). |

---

### `web_fetch`

Fetch a URL and return the page content. The agent provides the `url` at call
time. HTML is stripped to readable text by default using BeautifulSoup.

```yaml
browse_web:
  type: web_fetch
  description: Fetch and read a public web page.
  strip_html: true
  max_response_bytes: 131072
  # Optional: restrict to specific domains (and their subdomains).
  # If omitted, any public URL is allowed.
  allowed_domains:
    - stackoverflow.com
    - docs.python.org
    - github.com
    - pypi.org
  parameters:
    type: object
    properties:
      url:
        type: string
        description: The URL to fetch.
    required: [url]
    additionalProperties: false
```

**Fields**

| Field | Default | Description |
|---|---|---|
| `allowed_domains` | `[]` (open) | If non-empty, only these domains and their subdomains are permitted. |
| `strip_html` | `true` | Strip HTML tags and extract visible text via BeautifulSoup. |
| `max_response_bytes` | `65536` | Truncate the response body before parsing (bytes). |
| `timeout_seconds` | `tool_timeout_seconds` | Override the global timeout. |

**Built-in SSRF protection** (always enforced, regardless of `allowed_domains`):
- Blocks `localhost`, `0.0.0.0`, `::1`
- Blocks RFC 1918 private ranges: `10.x`, `172.16–31.x`, `192.168.x`
- Blocks link-local: `169.254.x`, `fe80::/10`
- Only `http` and `https` schemes are allowed (`file://`, `ftp://`, etc. are rejected)

---

## Safety Rules

- All path-based local tools (`file_read`, `file_read_dynamic`, `file_write`,
  `directory_list`, `file_search`, `text_search`, `git_status`, `git_diff`,
  `git_log`, `log_tail`, and `sqlite_query`) require `safe_roots` to be set and
  will reject any path that does not resolve under a configured root.
- `file_write` is the only filesystem-mutating tool. It writes only to its
  configured `path`, enforces `write_mode`, and rejects content larger than
  `max_write_bytes`.
- `sqlite_query` opens databases read-only and accepts only `SELECT`/`WITH`
  queries after comments are stripped.
- `http` and `http_json` URLs are fixed in YAML; the agent cannot supply or
  modify URLs at call time.
- `web_fetch` blocks loopback, private IP ranges, and non-http(s) schemes at
  all times. Set `allowed_domains` to further restrict which public sites the
  agent can reach.
- `process_status` reads in-memory state only — no subprocess or filesystem
  access.
- Git tools are read-only status, diff, and log views. No commit, checkout, or
  push tools are implemented.

---

## Memory Tool Types

These tools interact with the controller's semantic memory store (ChromaDB +
`all-MiniLM-L6-v2`). They are only registered when the controller's memory
subsystem is enabled and the store is not disabled. See `configuration.md` for
the `memory:` config block.

---

### `memory_write`

Write an observation or fact into the controller's memory store. The write is
fire-and-forget — the tool returns immediately without waiting for the
embedding and storage to complete. Near-identical entries (cosine similarity
≥ 0.92) are deduplicated server-side.

```yaml
save_user_note:
  type: memory_write
  description: Save a persistent note or observation about the user to memory.
```

Model arguments at call time:

```json
{
  "text": "User prefers dark mode and concise answers.",
  "tier": "durable",
  "topic": "preferences",
  "tags": ["ui", "style"]
}
```

**Fields** (all optional in YAML — no static config beyond `type` and `description`)

| Argument | Default | Description |
|---|---|---|
| `text` | required | The fact or observation to store. Must be non-empty. |
| `tier` | `durable` | Memory tier: `permanent`, `durable`, or `ephemeral`. |
| `topic` | `""` | Optional topic label for grouping. |
| `tags` | `[]` | Optional list of tag strings. |

---

### `memory_search`

Search the controller's memory store by semantic similarity and return the
most relevant entries. The model provides the search query at call time.

```yaml
recall_user_context:
  type: memory_search
  description: Search memory for facts about the user relevant to the current conversation.
  parameters:
    type: object
    properties:
      query:
        type: string
        description: What to search for in memory.
      top_k:
        type: integer
        description: Max results to return (1–20). Defaults to the store's configured top_k.
    required: [query]
    additionalProperties: false
```

Model arguments at call time:

```json
{"query": "user interface and workflow preferences", "top_k": 3}
```

Returns:

```json
{
  "ok": true,
  "count": 2,
  "results": [
    {"text": "User prefers dark mode.", "tier": "durable", "topic": "preferences", "tags": [], "score": 0.94, "id": "..."},
    {"text": "User uses a split-pane editor layout.", "tier": "ephemeral", "topic": "workflow", "tags": [], "score": 0.87, "id": "..."}
  ]
}
```

**Fields**

| Argument | Default | Description |
|---|---|---|
| `query` | required | Natural language search query. Must be non-empty. |
| `top_k` | store `top_k` | Max results to return (1–20). |

---

## Tool-Loop Evaluations

Use `scripts/tool_loop_eval.py` to run deterministic tool-loop evaluations
against one or more local tool-capable models. The runner uses the same
agent-local tool execution path as `/v1/chat/completions` with
`tool_runtime: "agent"`, then writes an append-only JSONL history, a latest
summary JSON file, and durable benchmark history for UI/API consumption.

```bash
rtk uv run python scripts/tool_loop_eval.py --config /path/to/controller-config.yaml --model gpt-oss-20b --target node:mac-mini
```

Default output paths are:

- `logs/tool_loop_eval_results.jsonl`
- `logs/tool_loop_eval_latest.json`

The built-in cases use deterministic eval-only tools instead of the target
agent's configured tools. This keeps runs comparable across nodes and models.
Current synthetic presets cover:

- short and long ordered tool sequences
- avoiding unnecessary tool calls
- recovery after a deterministic tool error
- stopping after a tool reports that no more information is available
- branch selection
- exact tool argument preservation
- order-insensitive fact gathering
- helper/delegation-style synthesis

Current real-world deterministic scenarios ask models to draft compact design
documents from relevant project-like sources while avoiding unrelated scope.
UI/API-triggered runs also include live workspace scenarios that use actual
workspace tools in temporary seeded coding-agent workspaces and check the
generated artifact content. Current live presets cover collaborative app
design, CI failure triage, config migration planning, targeted bugfix planning,
and PR review findings.

Tool-loop case status can be `passed`, `partial`, or `failed`. `partial`
means the model completed the loop, used the required tools, and produced the
required artifact, but missed scoring details such as exact expected strings or
artifact substrings. Missing required tools, tool errors, repeated tool calls,
missing artifacts, and forbidden stale content remain `failed`.

Run multiple models by repeating `--model`; route to a specific controller node
with `--target node:<name>`; run a single built-in case with `--case <case-id>`.
Node targets require a controller-mode config that defines the node. Running
the command with an agent-mode config will resolve the model as local to that
process instead of going through the controller. Runs started from the Tool
Loop Evals UI call `/lm-api/v1/runtime/tool-loop-evals/run` in agent mode or
`/lm-api/v1/runtime/tool-loop-evals/node-run` in controller mode, then persist
summaries and case details in the benchmark database.

See [Tool-Loop Eval Presets](tool-loop-eval-presets.md) for the preset roadmap
and scoring model.
