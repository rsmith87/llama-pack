# Benchmarks

Benchmarks run repeatable chat prompts against configured models and store
per-sample latency, throughput, token, and response-excerpt telemetry. Benchmark
endpoints are available only in controller mode.

## Prerequisites

- Run the benchmarks migration before starting the controller:

```bash
alembic -x db=benchmarks upgrade benchmarks@head
```

- Configure controller routing and nodes so benchmark requests can reach the
  target model.
- For managed-load runs, the target node must be registered and reachable by
  the controller.

## Built-In Definitions

On startup, the benchmark store seeds a small preset suite:

- `factual-qa-mini`
- `instruction-following-mini`
- `reasoning-math-mini`
- `summarization-mini`

Legacy default definitions `short-response-latency` and
`sustained-generation` are archived automatically if present.

List active definitions:

```bash
curl -s \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/benchmarks/definitions
```

Add `?include_archived=true` to include archived definitions.

## Creating Definitions

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/benchmarks/definitions \
  -d '{
    "name": "Coding Smoke",
    "slug": "coding-smoke",
    "description": "Small deterministic coding prompt.",
    "system_prompt": "Be concise.",
    "prompt_text": "Write a Python function that reverses a string.",
    "request_defaults": {"temperature": 0.0},
    "sample_count": 3,
    "max_tokens": 256,
    "tags": ["coding", "smoke"]
  }'
```

Definition limits:

| Field | Limit |
|---|---|
| `name` | 1-120 characters |
| `slug` | lowercase alphanumeric words separated by hyphens |
| `prompt_text` | required |
| `sample_count` | 1-20 |
| `max_tokens` | 1-4096 |

If `slug` is omitted, it is derived from `name`.

## Starting Runs

Run one definition against one or more models:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs \
  -d '{
    "definition_id": "<definition-id>",
    "models": ["qwen-coder:fast", "qwen-coder:long"],
    "target_selector": "auto"
  }'
```

The API creates one run per model and schedules each run in the controller event
loop. Each run executes its samples sequentially. Multiple requested models can
run concurrently because each created run is scheduled independently.

Run statuses are:

| Status | Meaning |
|---|---|
| `pending` | Run was created and queued for execution. |
| `running` | Samples are executing. |
| `completed` | All samples succeeded. |
| `partial` | Some samples succeeded and some failed. |
| `failed` | No samples succeeded, or the run failed before sampling. |

## Managed Load

Managed-load runs isolate a model on one target node:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs \
  -d '{
    "definition_id": "<definition-id>",
    "models": ["qwen-coder:long"],
    "managed_load": true,
    "target_node": "linux-2080ti",
    "restore_after": true
  }'
```

When `managed_load` is true, `target_node` is required. The runner snapshots
currently running models on that node, stops them, starts the benchmark model,
waits up to the model start timeout, then runs samples with `target_selector`
set to `node:<target_node>`. If `restore_after` is true, it stops the benchmark
model and restarts the models that were running before the run.

## Results And Comparison

List recent runs:

```bash
curl -s \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  "http://127.0.0.1:9137/lm-api/v1/benchmarks/runs?limit=50"
```

Fetch a run and its samples:

```bash
curl -s \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs/<run-id>
```

Run aggregates include:

- `ttft_ms_median`
- `ttft_ms_p95`
- `tokens_per_second_median`
- `tokens_per_second_p95`
- `total_duration_ms_median`
- `success_rate`
- `sample_count`

Each sample records status, TTFT, tokens per second, total duration, prompt and
completion token counts, completion character count, a 200-character response
excerpt, and any error detail.

Compare runs from the same definition:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs/compare \
  -d '{"run_ids":["<run-a>","<run-b>"]}'
```

Comparison requires at least two run IDs and rejects runs from different
benchmark definitions.
