# Model Downloads

Llama Pack can download GGUF model artifacts from Hugging Face into the
configured model library. Downloads are started through the UI or the
`/lm-api/v1/downloads/*` API and are recorded in the downloads database.

## Prerequisites

- Configure at least one model library root with `hf_models_dirs` or the legacy
  `hf_models_dir`. Downloads use the first configured root.
- Run the downloads migration before starting the app:

```bash
alembic -x db=downloads upgrade downloads@head
```

- Use a Python environment where `huggingface_hub` is installed. The downloader
  runs:

```bash
{python_bin} -m huggingface_hub.cli.hf download <repo_id> --local-dir <target>
```

- For gated Hugging Face repos, sign in with `hf auth login` and accept the
  model terms on Hugging Face before starting the download.

## Destination Layout

Downloads write under the first configured model root. Repository IDs are
normalized by replacing `/` with `__`:

```text
hf_models_dirs[0]/
`-- TheBloke__example-model-GGUF/
```

Each download stores the destination path, command, log path, triggering user,
revision, process id, timestamps, and byte progress metadata.

## Selecting Files

Use quant listing before download when a repo contains multiple GGUF files:

```bash
curl -s \
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \
  "http://127.0.0.1:9137/lm-api/v1/downloads/TheBloke/example-GGUF/quants"
```

The quant listing returns GGUF files with filename, repo path, size, detected
quant label, and any matching multimodal projector sidecar. `include_file` must
be a relative `.gguf` path; absolute paths, parent traversal, backslashes, and
non-GGUF files are rejected.

## Starting A Download

Download an entire repo:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/downloads/TheBloke/example-GGUF/start \
  -d '{}'
```

Download one GGUF file from a specific revision:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/downloads/TheBloke/example-GGUF/start \
  -d '{
    "revision": "main",
    "include_file": "example.Q4_K_M.gguf"
  }'
```

Only one active download per repo is allowed. Starting another download for the
same repo while one is still running returns a conflict.

## Monitoring And History

Useful endpoints:

- `GET /lm-api/v1/downloads/history?status=running&limit=100`
- `GET /lm-api/v1/downloads/{download_id}`
- `GET /lm-api/v1/downloads/{download_id}/logs?lines=200`
- `GET /lm-api/v1/downloads/{download_id}/logs/stream?lines=200`
- `POST /lm-api/v1/downloads/{download_id}/cancel`
- `DELETE /lm-api/v1/downloads/{download_id}`

Download statuses are:

| Status | Meaning |
|---|---|
| `queued` | Record was created before the child process was marked running. |
| `running` | Hugging Face download process is active. |
| `succeeded` | Process exited with code 0. |
| `failed` | Process exited non-zero or startup validation failed. |
| `cancelled` | User cancelled a running process. |

Progress is computed from bytes present in the destination path. If the selected
file size is known, responses include `progress_percent`; otherwise progress is
reported as downloaded bytes with `progress_percent: null`.

Completed, failed, or cancelled records can be deleted. Running downloads must
be cancelled before deletion.

## Recommendations

`GET /lm-api/v1/downloads/recommendations` returns suggested model downloads
based on the controller health payload. Results are cached in memory for one
hour to avoid repeated Hugging Face API work.

