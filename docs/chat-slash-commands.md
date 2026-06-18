# Chat Slash Commands

Chat slash commands are explicit operator shortcuts typed into the chat
composer. They should handle local UI or controller actions before a prompt is
sent to the model. Commands are for actions the user intends to perform, not
natural-language hints for the model to infer.

Commands should be portable across Llama Pack chat and Spitball where the
underlying capability exists. The parser, command metadata, usage text, and
tests for command matching should be shared. Handlers should stay app-specific
because Llama Pack and Spitball use different state, auth, storage, and backend
capability checks.

## Principles

- Commands start with `/` and are parsed by the frontend before normal chat
  submission.
- Commands should not be sent to the LLM unless the command explicitly says so.
- Successful commands should add a short system-style transcript message.
- Failed commands should show a clear error in the transcript and page error
  banner.
- Commands should map to existing typed APIs where possible.
- Destructive commands must require a confirmation step.
- Command handlers should live in a small registry so `/help` can be generated
  from command metadata later.
- Command availability should be capability-gated. Unsupported commands should
  return a clear message instead of silently falling back to normal chat.

## Portability Model

The command system should separate command recognition from command execution.

```text
shared command parser and metadata
  /remember
  /recall
  /context
  /route
  /target
  /clear
  /save
        |
        v
Llama Pack handlers       Spitball handlers
```

Shared pieces:

- Exact command parsing.
- Usage strings.
- Descriptions.
- `/help` metadata.
- Parser tests.

App-specific pieces:

- API calls.
- Auth headers and session handling.
- Transcript updates.
- Local or server-side persistence.
- Capability checks.
- UI state mutations such as selected target or selected model.

Examples:

- `/clear` can be supported in both apps because it only mutates local
  transcript state.
- `/context` can be supported in both apps because both chat flows already use
  context budget APIs.
- `/remember` should be enabled in Llama Pack when controller memory is
  available. Spitball should enable it only when the connected backend exposes
  memory endpoints and the current key can call them.
- `/save` can be supported in both apps, but Llama Pack saves through the
  server chat-session API while Spitball saves to local app storage.
- `/route` should be capability-gated because not every connected backend or
  app surface exposes route preview.

## Current Commands

### `/remember <text>`

Save text to controller semantic memory.

Behavior:

- Trim the text after `/remember`.
- Reject empty text with a usage error.
- Write to `/lm-api/v1/memory/write`.
- Use `tier: "durable"`, `topic: "chat"`, and `tags: ["chat-command"]`.
- Add a user command message and a system confirmation message to the
  transcript.
- Do not send the command to the chat completion stream.

Example:

```text
/remember User prefers concise answers with code examples.
```

### `/recall <query>`

Search controller memory and show matching memories in the transcript. This is
for debugging and intentional retrieval, not normal auto-injection.

Behavior:

- Call `/lm-api/v1/memory/search`.
- Use `top_k: 5`.
- Show result text, score, tier, and topic.
- Do not send retrieved results to the LLM automatically.

### `/forget <query-or-id>`

Preview memory entries that may need deletion. This command is intentionally
non-destructive until the backend exposes a delete API and the UI has a
confirmation flow.

Behavior:

- Call `/lm-api/v1/memory/search`.
- Use `top_k: 5`.
- Show matching candidate memories.
- Add a transcript note that no memories were deleted.

### `/context`

Show the current chat context status for the selected model.

Behavior:

- Reuse the existing context budget endpoint.
- Show estimated prompt tokens, reserved completion tokens, remaining tokens,
  context window, selected model, selected target, model family, and context
  profile when available.
- Do not send a chat message to the LLM.

### `/use <model-or-target>`

Switch the selected model or route target.

Behavior:

- Accept model names from the current running model list.
- Accept route targets such as `auto`, `local`, or `node:name`.
- Update the matching chat control.
- Add a system transcript message confirming the switch.

## Recommended Next Commands

### `/route <task>`

Preview router selection for a task without sending a chat message.

Suggested behavior:

- Reuse the runtime route preview endpoint.
- Show selected node/model, reason, running/startup status, and rejected
  candidates.
- Do not start models automatically.

### `/target <auto|local|node:name>`

Switch the chat route target.

Suggested behavior:

- Validate the target against known local and node targets.
- Update the chat target selector.
- Add a system transcript message confirming the new target.

### `/clear`

Clear the visible transcript.

Suggested behavior:

- Run the same action as the Clear button.
- Reject while a response is streaming.
- Do not delete saved sessions or thread history.

### `/save [name]`

Save the current chat session.

Suggested behavior:

- If a name is provided, use it as the session name.
- If no name is provided, use the current session name logic.
- Reuse the existing chat session save API.

## Later Commands

### `/forget confirm <id>`

Delete a specific memory entry after the preview step shows candidate IDs. This
needs a backend delete API and explicit confirmation because deletion is
destructive.

### `/embed <text>`

Generate an embedding for text and show model, dimensions, usage, and a short
vector preview. This is mostly useful for education and debugging.

### `/similar <left> | <right>`

Embed two snippets and show cosine similarity. The separator should be explicit
so parsing remains simple.

### `/models`

Show running chat-capable models and their targets.

### `/nodes`

Show reachable nodes and basic runtime capability status.

### `/capabilities`

Show selected model capabilities such as tools, embeddings, vision, KV slots,
and structured output support.

### `/slots`

List KV slots for the selected model and target.

### `/slot clear <id>`

Clear one KV slot. This should require confirmation because it changes runtime
state.

### `/eval <name>`

Run a named evaluation against the selected model/profile. This should integrate
with the tool-loop evals workflow when that workflow exposes a stable API.

## Registry Shape

Command parsing should eventually move out of `ChatPage` and into a small
frontend registry.

```ts
type ChatSlashCommand = {
  name: string;
  usage: string;
  description: string;
  run: (args: string, context: ChatCommandContext) => Promise<void>;
};
```

The registry should support:

- Exact command matching so `/remembered` does not trigger `/remember`.
- A generated `/help` list.
- Unit tests for command parsing separate from `ChatPage`.
- Handler tests for side effects such as API calls, transcript messages, and
  state updates.
