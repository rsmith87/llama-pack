import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ChatPage } from "./ChatPage";

afterEach(() => {
  window.history.pushState({}, "", "/ui/chat");
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown, headers = new Headers()) {
  return { ok: true, headers, json: async () => payload, text: async () => JSON.stringify(payload) };
}

function streamReader(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    read: vi.fn(async () => {
      if (index >= chunks.length) return { done: true, value: undefined };
      return { done: false, value: encoder.encode(chunks[index++]) };
    }),
  };
}

function streamResponse(chunks: string[], headers = new Headers()) {
  return { ok: true, headers, body: { getReader: () => streamReader(chunks) } };
}

it("loads models and preserves chat localStorage keys", async () => {
  localStorage.setItem("lm_chat_preset", "creative");
  localStorage.setItem("lm_active_chat_session_id", "session-1");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson({ models: [{ name: "mistral", status: "running" }] })));

  render(<ChatPage />);

  expect(await screen.findByRole("option", { name: "mistral" })).toBeInTheDocument();
  expect(screen.getByLabelText("Preset")).toHaveValue("creative");
  expect(localStorage.getItem("lm_active_chat_session_id")).toBe("session-1");
});

it("renders model family and context profile selectors from catalog and sends them", async () => {
  const stream = streamResponse(['data: {"choices":[{"delta":{"content":"profile reply"}}]}\n\n']);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "gemma", status: "running" }] });
    if (url === "/lm-api/v1/models/profiles") {
      return okJson({
        families: [{
          family: "gemma",
          profiles: [
            { profile: "fast", label: "Fast", identity: "gemma:fast", ctx: 8192 },
            { profile: "long", label: "Long", identity: "gemma:long", ctx: 131072 },
          ],
        }],
      });
    }
    if (url === "/lm-api/v1/chat/gemma/stream") return stream;
    return okJson({});
  }));
  const user = userEvent.setup();

  render(<ChatPage />);

  expect(await screen.findByLabelText("Model Family")).toBeInTheDocument();
  expect(await screen.findByLabelText("Context Profile")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Long" })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Context Profile"), "long");
  await user.type(screen.getByLabelText("Prompt"), "Use profile");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("profile reply")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/gemma/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"model_family":"gemma"'),
  }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/gemma/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"context_profile":"long"'),
  }));
});

it("preselects model and route target from chat handoff query parameters", async () => {
  window.history.pushState({}, "", "/ui/chat?model=mistral&target=node%3Amac-mini&mode=thread&source=dashboard");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson({ models: [
    { name: "llama", status: "running" },
    { name: "mistral", status: "running" },
  ] })));

  render(<ChatPage />);

  expect(await screen.findByLabelText("Model")).toHaveValue("mistral");
  expect(screen.getByLabelText("Target")).toHaveValue("node:mac-mini");
  expect(screen.getByLabelText("Chat Mode")).toHaveValue("thread");
  expect(screen.getByLabelText("Thread App")).toHaveValue("dashboard");
});

it("loads controller node models into chat controls and sends to the selected node target", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [] });
      if (url === "/lm-api/v1/nodes/models") return okJson([
        { name: "mac-agent", reachable: true, models: [{ name: "qwen", status: "running" }] },
      ]);
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/chat/qwen/stream") {
        return streamResponse([
          'data: {"choices":[{"delta":{"content":"node reply"}}]}\n\n',
        ], new Headers({ "X-Llama-Manager-Route": "node:mac-agent" }));
      }
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  expect(await screen.findByRole("option", { name: "qwen on mac-agent" })).toBeInTheDocument();
  expect(screen.getByLabelText("Model")).toHaveValue("qwen");
  expect(screen.getByLabelText("Target")).toHaveValue("node:mac-agent");

  await user.type(screen.getByLabelText("Prompt"), "Hello remote model");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("node reply")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/qwen/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"target":"node:mac-agent"'),
  }));
});

it("renders session controls above the transcript", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson({ models: [{ name: "mistral", status: "running" }] })));

  render(<ChatPage />);

  expect(await screen.findByRole("option", { name: "mistral" })).toBeInTheDocument();
  const sessionName = screen.getByLabelText("Session name");
  const transcriptHeading = screen.getByRole("heading", { name: "Transcript" });
  const controlsHeading = screen.getByRole("heading", { name: "Controls" });
  expect(sessionName.compareDocumentPosition(transcriptHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(transcriptHeading.compareDocumentPosition(controlsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("streams a direct chat response and builds the request payload", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(streamResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
      ], new Headers({ "X-Llama-Manager-Route": "local:mistral" }))),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Say hello");
  await user.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
  expect(screen.getByText("resolved: local:mistral")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/mistral/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"content":"Say hello"'),
  }));
});

it("shows image upload for vision models and sends image content blocks", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") {
        return okJson({ models: [
          { name: "mistral", status: "running", vision: false },
          { name: "llava", status: "running", vision: true, mmproj: "/models/mmproj.gguf" },
        ] });
      }
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/chat/llava/stream") {
        return streamResponse(['data: {"choices":[{"delta":{"content":"image reply"}}]}\n\n']);
      }
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  expect(await screen.findByRole("option", { name: "mistral" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Image")).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("Model"), "llava");
  const file = new File(["tiny"], "sample.png", { type: "image/png" });
  await user.upload(await screen.findByLabelText("Image"), file);
  await user.type(screen.getByLabelText("Prompt"), "Describe it");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("image reply")).toBeInTheDocument();
  expect(screen.getByText("image: sample.png")).toBeInTheDocument();
  const streamCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => url === "/lm-api/v1/chat/llava/stream");
  const body = JSON.parse(String(streamCall?.[1]?.body));
  expect(body.messages[0].content).toMatchObject([
    { type: "text", text: "Describe it" },
    { type: "image_url", image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) } },
  ]);
});

it("sends direct chat through the agent tool runtime when enabled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "gemma-4-E2B-it:fast", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/v1/chat/completions") {
        return okJson({
          choices: [{ message: { role: "assistant", content: "tool summary" } }],
        });
      }
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.click(await screen.findByLabelText("Agent tools"));
  await user.type(screen.getByLabelText("Prompt"), "Use list_runtime_status");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("tool summary")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/v1/chat/completions", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"tool_runtime":"agent"'),
  }));
  expect(fetch).toHaveBeenCalledWith("/v1/chat/completions", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"stream":false'),
  }));
  expect(fetch).not.toHaveBeenCalledWith("/lm-api/v1/chat/gemma-4-E2B-it:fast/stream", expect.anything());
});

it("streams reasoning deltas before assistant content", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(streamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"thinking..."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
      ])),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Think first");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("thinking...")).toBeInTheDocument();
  expect(screen.getByText("Reasoning")).toBeInTheDocument();
  expect(await screen.findByText("answer")).toBeInTheDocument();
});

it("sends the prompt with Enter only when the checkbox is enabled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/chat/mistral/stream") {
        return streamResponse(['data: {"choices":[{"delta":{"content":"enter reply"}}]}\n\n']);
      }
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  const promptInput = await screen.findByLabelText("Prompt");
  expect(screen.getByLabelText("Enter to send")).not.toBeChecked();

  await user.type(promptInput, "Do not send{Enter}");
  expect(fetch).not.toHaveBeenCalledWith("/lm-api/v1/chat/mistral/stream", expect.anything());

  await user.click(screen.getByLabelText("Enter to send"));
  await user.type(promptInput, "Send now{Enter}");

  expect(await screen.findByText("enter reply")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/mistral/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"content":"Do not send\\nSend now"'),
  }));
});

it("sends advanced sampling, structured JSON schema, cache prompt, reasoning, and slot settings", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/chat/capabilities/mistral") {
        return okJson({
          supports: { structured_output: { json_schema: true, grammar: true }, kv_cache: true },
          supports_json_schema: true,
          supports_grammar: true,
        });
      }
      if (url === "/lm-api/v1/chat/mistral/stream") {
        return streamResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n']);
      }
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await screen.findByRole("option", { name: "mistral" });
  await user.click(screen.getByRole("button", { name: "Advanced" }));
  await user.clear(screen.getByLabelText("Top K"));
  await user.type(screen.getByLabelText("Top K"), "50");
  await user.clear(screen.getByLabelText("Min P"));
  await user.type(screen.getByLabelText("Min P"), "0.05");
  await user.clear(screen.getByLabelText("Repeat penalty"));
  await user.type(screen.getByLabelText("Repeat penalty"), "1.15");
  await user.clear(screen.getByLabelText("Seed"));
  await user.type(screen.getByLabelText("Seed"), "123");
  await user.type(screen.getByLabelText("Stop tokens"), "</s>, User:");
  await user.click(screen.getByLabelText("Reasoning"));
  await user.click(screen.getByLabelText("Cache prompt"));
  await user.clear(screen.getByLabelText("KV slot"));
  await user.type(screen.getByLabelText("KV slot"), "2");
  await user.selectOptions(screen.getByLabelText("Structured mode"), "json_schema");
  fireEvent.change(screen.getByLabelText("JSON schema"), { target: { value: '{"type":"object"}' } });
  await user.type(screen.getByLabelText("Prompt"), "Return JSON");
  await user.click(screen.getByRole("button", { name: "Send" }));

  await screen.findByText("ok");
  const body = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body));
  expect(body).toMatchObject({
    top_k: 50,
    min_p: 0.05,
    repeat_penalty: 1.15,
    seed: 123,
    stop: ["</s>", "User:"],
    reasoning: true,
    cache_prompt: true,
    slot_id: 2,
    json_schema: { type: "object" },
  });
  expect(body.grammar).toBeUndefined();
});

it("validates structured JSON schema before sending", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(okJson({ supports: { structured_output: { json_schema: true, grammar: true } } })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await screen.findByRole("option", { name: "mistral" });
  await user.click(screen.getByRole("button", { name: "Advanced" }));
  await user.selectOptions(screen.getByLabelText("Structured mode"), "json_schema");
  fireEvent.change(screen.getByLabelText("JSON schema"), { target: { value: "{bad" } });
  await user.type(screen.getByLabelText("Prompt"), "Return JSON");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("JSON schema is not valid JSON");
  expect(fetch).not.toHaveBeenCalledWith("/lm-api/v1/chat/mistral", expect.anything());
});

it("shows capabilities, copies capability JSON, inspects prompts, and clears KV slots", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(okJson({ supports: { structured_output: { json_schema: true, grammar: false }, kv_cache: true } }))
      .mockResolvedValueOnce(okJson({ rendered_prompt_preview: "rendered prompt" }))
      .mockResolvedValueOnce(okJson({ slots: [{ id: 0, state: "used" }] }))
      .mockResolvedValueOnce(okJson({ ok: true })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await screen.findByRole("option", { name: "mistral" });
  await user.click(screen.getByRole("button", { name: "Advanced" }));

  expect(await screen.findByText(/"kv_cache": true/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Copy Capabilities JSON" }));
  expect(await screen.findByText("Capabilities copied")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Inspect prompt/template" }));
  expect(await screen.findByText("rendered prompt")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Refresh KV slots" }));
  expect(await screen.findByText(/"state": "used"/)).toBeInTheDocument();

  await user.clear(screen.getByLabelText("KV slot action id"));
  await user.type(screen.getByLabelText("KV slot action id"), "0");
  await user.click(screen.getByRole("button", { name: "Clear slot" }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/mistral/kv/slots/0", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ action: "clear", target: "auto" }),
  }));
});

it("saves the current chat session and remembers the saved session id", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(streamResponse(['data: {"choices":[{"delta":{"content":"saved reply"}}]}\n\n']))
      .mockResolvedValueOnce(okJson({ id: "session-1", name: "Work session", messages: [] })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Save this");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("saved reply")).toBeInTheDocument();

  await user.type(screen.getByLabelText("Session name"), "Work session");
  await user.click(screen.getByRole("button", { name: "Save Session" }));

  expect(await screen.findByText("Session saved")).toBeInTheDocument();
  expect(localStorage.getItem("lm_active_chat_session_id")).toBe("session-1");
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/sessions", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"name":"Work session"'),
  }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/sessions", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"content":"Save this"'),
  }));
  const body = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body));
  expect(body.request_defaults).toMatchObject({
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 1,
    chat_mode: "direct",
    thread_metadata: { app: "ui", purpose: "chat", priority: "medium", request_type: "general" },
  });
});

it("saves a selected session as new without reusing the old session id", async () => {
  localStorage.setItem("lm_active_chat_session_id", "session-old");
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(streamResponse(['data: {"choices":[{"delta":{"content":"new reply"}}]}\n\n']))
      .mockResolvedValueOnce(okJson({ id: "session-new", name: "Forked session", messages: [] })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Fork this");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("new reply")).toBeInTheDocument();

  await user.type(screen.getByLabelText("Session name"), "Forked session");
  await user.click(screen.getByRole("button", { name: "Save As New" }));

  expect(await screen.findByText("Session saved")).toBeInTheDocument();
  expect(localStorage.getItem("lm_active_chat_session_id")).toBe("session-new");
  const body = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body));
  expect(body.id).toBeUndefined();
  expect(body.name).toBe("Forked session");
});

it("lists, loads, deletes, and resumes chat sessions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }, { name: "qwen", status: "running" }] }))
      .mockResolvedValueOnce(okJson([
        { id: "session-1", name: "Older", updated_at: "2026-05-19T01:00:00Z" },
        { id: "session-2", name: "Recent", updated_at: new Date().toISOString() },
      ]))
      .mockResolvedValueOnce(okJson({
        id: "session-2",
        name: "Recent",
        model: "qwen",
        target_selector: "local",
        messages: [{ role: "user", content: "loaded prompt" }, { role: "assistant", content: "loaded reply" }],
        request_defaults: {
          temperature: 0.2,
          max_tokens: 256,
          top_p: 0.9,
          advanced: { top_k: 55, reasoning: true, stop: "END" },
          chat_mode: "thread",
          thread_id: "thread-loaded",
          thread_metadata: { app: "codex", purpose: "support", priority: "high", request_type: "analysis" },
          include_internal: true,
        },
      }))
      .mockResolvedValueOnce(okJson({ deleted: true, id: "session-2" }))
      .mockResolvedValueOnce(okJson([
        { id: "session-2", name: "Recent", updated_at: new Date().toISOString() },
      ]))
      .mockResolvedValueOnce(okJson({
        id: "session-2",
        name: "Recent",
        model: "qwen",
        target_selector: "local",
        messages: [{ role: "user", content: "resume prompt" }, { role: "assistant", content: "resume reply" }],
        request_defaults: { temperature: 0.3, max_tokens: 300, top_p: 0.8 },
      })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await screen.findByRole("option", { name: "mistral" });
  await user.click(screen.getByRole("button", { name: "Refresh Sessions" }));
  await user.selectOptions(await screen.findByLabelText("Saved sessions"), "session-2");
  await user.click(screen.getByRole("button", { name: "Load Session" }));

  expect(await screen.findByText("loaded reply")).toBeInTheDocument();
  expect(screen.getByLabelText("Model")).toHaveValue("qwen");
  expect(screen.getByLabelText("Target")).toHaveValue("local");
  expect(screen.getByLabelText("Temperature")).toHaveValue(0.2);
  expect(screen.getByLabelText("Chat Mode")).toHaveValue("thread");
  expect(screen.getByLabelText("Thread ID")).toHaveValue("thread-loaded");
  expect(screen.getByLabelText("Thread App")).toHaveValue("codex");
  expect(screen.getByLabelText("Thread Purpose")).toHaveValue("support");
  expect(screen.getByLabelText("Thread Priority")).toHaveValue("high");
  expect(screen.getByLabelText("Thread Request Type")).toHaveValue("analysis");
  expect(screen.getByLabelText("Include internal events")).toBeChecked();
  expect(localStorage.getItem("lm_active_chat_session_id")).toBe("session-2");

  await user.click(screen.getByRole("button", { name: "Delete Session" }));
  expect(await screen.findByText("Session deleted")).toBeInTheDocument();
  expect(localStorage.getItem("lm_active_chat_session_id")).toBe("");

  await user.click(screen.getByRole("button", { name: "Resume Recent" }));
  expect(await screen.findByText("resume reply")).toBeInTheDocument();
  expect(localStorage.getItem("lm_active_chat_session_id")).toBe("session-2");
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/sessions/session-2", expect.objectContaining({ method: "GET" }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/sessions/session-2", expect.objectContaining({ method: "DELETE" }));
});

it("renders telemetry chips from streamed chunks after finalization", async () => {
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(100)
    .mockReturnValueOnce(160)
    .mockReturnValueOnce(500);
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(streamResponse([
        'data: {"choices":[{"delta":{"content":"Hi"}}],"usage":{"prompt_tokens":4,"completion_tokens":8},"timings":{"prompt_ms":20,"predicted_ms":200,"predicted_n":10}}\n\n',
      ])),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Telemetry");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("Hi")).toBeInTheDocument();
  expect(screen.getByText("tok/s: 50.00")).toBeInTheDocument();
  expect(screen.getByText(/ttft: \d+ms/)).toBeInTheDocument();
  expect(screen.getByText(/total: \d+ms/)).toBeInTheDocument();
  expect(screen.getByText("prompt_toks: 4")).toBeInTheDocument();
  expect(screen.getByText("gen_toks: 8")).toBeInTheDocument();
});

it("renders telemetry chips from fallback chat responses", async () => {
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(100)
    .mockReturnValueOnce(350);
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing stream" })
      .mockResolvedValueOnce(okJson({
        choices: [{ message: { role: "assistant", content: "fallback reply" } }],
        usage: { completion_tokens: 5, completion_time_ms: 100 },
      })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Use fallback");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("fallback reply")).toBeInTheDocument();
  expect(screen.getByText("tok/s: 50.00")).toBeInTheDocument();
  expect(screen.getByText(/total: \d+ms/)).toBeInTheDocument();
});

it("falls back to standard chat when streaming is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing stream" })
      .mockResolvedValueOnce(okJson({ choices: [{ message: { role: "assistant", content: "fallback reply" } }] })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Use fallback");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("fallback reply")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/mistral", expect.objectContaining({ method: "POST" }));
});

it("stops an active stream and marks the assistant response stopped", async () => {
  let aborted = false;
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockImplementationOnce((_path, init: RequestInit) => {
        init.signal?.addEventListener("abort", () => { aborted = true; });
        return new Promise(() => undefined);
      }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Stop this");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await user.click(await screen.findByRole("button", { name: "Stop" }));

  expect(aborted).toBe(true);
  expect(await screen.findByText("(stopped)")).toBeInTheDocument();
});

it("regenerates the last prompt", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(streamResponse(['data: {"choices":[{"delta":{"content":"first"}}]}\n\n']))
      .mockResolvedValueOnce(streamResponse(['data: {"choices":[{"delta":{"content":"second"}}]}\n\n'])),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Again");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("first")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Regenerate" }));

  expect(await screen.findByText("second")).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith("/lm-api/v1/chat/mistral/stream", expect.objectContaining({
    body: expect.stringContaining('"content":"Again"'),
  }));
});

it("aborts an active stream on unmount", async () => {
  let aborted = false;
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockImplementationOnce((_path, init: RequestInit) => {
        init.signal?.addEventListener("abort", () => { aborted = true; });
        return new Promise(() => undefined);
      }),
  );
  const user = userEvent.setup();

  const view = render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Unmount");
  await user.click(screen.getByRole("button", { name: "Send" }));
  view.unmount();

  expect(aborted).toBe(true);
});

it("creates a thread with metadata and shows route detail", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(okJson({ id: "thread-1", default_model: "mistral", metadata: { app: "codex", purpose: "chat", priority: "high", request_type: "coding" } })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.selectOptions(await screen.findByLabelText("Chat Mode"), "thread");
  await user.clear(screen.getByLabelText("Thread App"));
  await user.type(screen.getByLabelText("Thread App"), "codex");
  await user.selectOptions(screen.getByLabelText("Thread Priority"), "high");
  await user.selectOptions(screen.getByLabelText("Thread Request Type"), "coding");
  await user.click(screen.getByRole("button", { name: "New Thread" }));

  expect(await screen.findByDisplayValue("thread-1")).toBeInTheDocument();
  expect(screen.getByText(/"id": "thread-1"/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"app":"codex"'),
  }));
});

it("sends thread messages and refreshes transcript events", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(okJson({ id: "thread-1", default_model: "mistral", metadata: {} }))
      .mockResolvedValueOnce(okJson({ message: { content: "controller reply" }, route: { node: "linux", model: "mistral", reason: "request_type" } }))
      .mockResolvedValueOnce(okJson({ events: [
        { event_type: "user_message", content: { text: "Route this" }, public: true },
        { event_type: "assistant_message", content: { text: "controller reply" }, public: true, route: { node: "linux", model: "mistral", reason: "request_type" }, agent_node: "linux", model: "mistral" },
      ] }))
      .mockResolvedValueOnce(okJson({ id: "session-thread", name: "Thread save", messages: [] })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.selectOptions(await screen.findByLabelText("Chat Mode"), "thread");
  await user.click(screen.getByRole("button", { name: "New Thread" }));
  await user.type(screen.getByLabelText("Prompt"), "Route this");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("controller reply")).toBeInTheDocument();
  expect(screen.getByText("resolved: linux")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"content":"Route this"'),
  }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/events", expect.objectContaining({ method: "GET" }));

  await user.click(screen.getByRole("button", { name: "Save Session" }));
  expect(await screen.findByText("Session saved")).toBeInTheDocument();
  const body = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body));
  expect(body.request_defaults).toMatchObject({
    chat_mode: "thread",
    thread_id: "thread-1",
    thread_metadata: { app: "ui", purpose: "chat", priority: "medium", request_type: "general" },
  });
  expect(body.messages[0]).toMatchObject({ role: "user", content: "Route this", thread_event_type: "user_message" });
  expect(body.messages[1]).toMatchObject({
    role: "assistant",
    content: "controller reply",
    thread_event_type: "assistant_message",
    route_meta: { resolved: "linux", reason: "request_type" },
  });
});

it("refreshes thread events with the internal event toggle", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "mistral", status: "running" }] }))
      .mockResolvedValueOnce(okJson({ events: [
        { event_type: "routing_decision", public: false, content: { candidates: [{ node: "linux" }] }, route: { node: "linux", model: "mistral", reason: "policy" }, agent_node: "linux", model: "mistral" },
      ] })),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.selectOptions(await screen.findByLabelText("Chat Mode"), "thread");
  await user.type(screen.getByLabelText("Thread ID"), "thread-1");
  await user.click(screen.getByLabelText("Include internal events"));
  await user.click(screen.getByRole("button", { name: "Refresh Thread" }));

  expect(await screen.findByText(/routing_decision node=linux/)).toBeInTheDocument();
  expect(screen.getByText(/"thread_id": "thread-1"/)).toHaveTextContent("routing_decision");
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/events?include_internal=true", expect.objectContaining({ method: "GET" }));
});
