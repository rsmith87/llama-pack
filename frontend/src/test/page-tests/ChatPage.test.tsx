import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ChatPage } from "../../pages/ChatPage";

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

function conversationCreate(id = "thread-1") {
  return okJson({ id, metadata: { app: "ui", purpose: "chat", priority: "medium", request_type: "general" } });
}

function conversationEvents(userContent = "prompt", assistantContent = "reply", id = "thread-1") {
  return okJson({ events: [
    { event_type: "user_message", content: { text: userContent } },
    {
      event_type: "assistant_message",
      content: { text: assistantContent },
      route: { node: "local", model: "mistral", reason: "test" },
      agent_node: "local",
      model: "mistral",
    },
  ], id });
}

function stubChatPageFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
    if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
    if (url === "/lm-api/v1/threads") return conversationCreate();
    if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents();
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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

it("disables chat controls and warns when no model is loaded", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "stopped" }] });
    if (url === "/lm-api/v1/nodes/models") return okJson([]);
    return okJson({});
  }));

  render(<ChatPage />);

  expect(await screen.findByText("Load a model before using chat controls.")).toBeInTheDocument();
  expect(screen.getByLabelText("Model")).toBeDisabled();
  expect(screen.getByLabelText("Prompt")).not.toBeDisabled();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
});

it("saves slash remember commands to controller memory without sending chat", async () => {
  const fetchMock = stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/memory/write") return okJson({ ok: true, id: "mem-1" });
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") return streamResponse(['data: {"choices":[{"delta":{"content":"should not stream"}}]}\n\n']);
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);

  await screen.findByRole("option", { name: "mistral" });
  await user.type(screen.getByLabelText("Prompt"), "/remember User prefers concise answers.");
  await user.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/lm-api/v1/memory/write", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      text: "User prefers concise answers.",
      tier: "durable",
      topic: "chat",
      tags: ["chat-command"],
    }),
  })));
  expect(fetchMock).not.toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.anything());
  expect(await screen.findByText("Saved to controller memory (mem-1).")).toBeInTheDocument();
});

it("recalls controller memories from chat slash commands", async () => {
  const fetchMock = stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/memory/search") {
      return okJson({ ok: true, count: 1, results: [{ id: "mem-1", text: "User prefers concise answers.", tier: "durable", topic: "preferences", score: 0.94 }] });
    }
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);

  await screen.findByRole("option", { name: "mistral" });
  await user.type(screen.getByLabelText("Prompt"), "/recall answer style");
  await user.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/lm-api/v1/memory/search", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ query: "answer style", top_k: 5 }),
  })));
  expect(await screen.findByText(/Memory recall found 1 result/)).toBeInTheDocument();
  expect(screen.getByText(/0.9400 durable preferences User prefers concise answers./)).toBeInTheDocument();
});

it("previews forget matches without deleting memories", async () => {
  const fetchMock = stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/memory/search") {
      return okJson({ ok: true, count: 1, results: [{ id: "mem-old", text: "Old preference.", tier: "durable", topic: "preferences", score: 0.88 }] });
    }
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);

  await screen.findByRole("option", { name: "mistral" });
  await user.type(screen.getByLabelText("Prompt"), "/forget old preference");
  await user.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/lm-api/v1/memory/search", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ query: "old preference", top_k: 5 }),
  })));
  expect(await screen.findByText(/Forget preview found 1 candidate/)).toBeInTheDocument();
  expect(screen.getByText(/No memories were deleted./)).toBeInTheDocument();
});

it("shows context and switches model or target from slash commands", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }, { name: "qwen", status: "running", node: "mac" }] });
    if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
    if (url === "/lm-api/v1/chat/mistral/context-budget") {
      return okJson({
        model: "mistral",
        context_window_tokens: 32768,
        prompt_tokens_estimated: 1000,
        reserved_completion_tokens: 1024,
        available_input_tokens: 31744,
        remaining_context_tokens: 30744,
        usage_ratio: 0.061,
        status: "comfortable",
        estimation_method: "approx_chars_div_4",
        precision: "approximate",
        warnings: [],
      });
    }
    return okJson({});
  }));
  const user = userEvent.setup();

  render(<ChatPage />);

  await screen.findByRole("option", { name: "mistral" });
  await user.type(screen.getByLabelText("Prompt"), "/context");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect((await screen.findAllByText(/Context: 2.0k \/ 32.8k used/)).length).toBeGreaterThan(0);
  expect(screen.getByText(/Model mistral/)).toBeInTheDocument();

  await user.type(screen.getByLabelText("Prompt"), "/use qwen");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Using model qwen.")).toBeInTheDocument();
  expect(screen.getByLabelText("Model")).toHaveValue("qwen");

  await user.type(screen.getByLabelText("Prompt"), "/use node:mac");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Using target node:mac.")).toBeInTheDocument();
  expect(screen.getByLabelText("Target")).toHaveValue("node:mac");
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
    if (url === "/lm-api/v1/threads") return conversationCreate();
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") return stream;
    if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Use profile", "profile reply");
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
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"model_family":"gemma"'),
  }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.objectContaining({
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
  expect(screen.queryByLabelText("Chat Mode")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Conversation App")).toHaveValue("dashboard");
});

it("preselects the matching model family and default profile from a model card handoff", async () => {
  window.history.pushState({}, "", "/ui/chat?model=qwen-chat&target=auto&mode=direct&source=gguf-library");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/lm-api/v1/models") {
      return okJson({ models: [
        { name: "llama", status: "running" },
        { name: "qwen-chat", status: "running" },
      ] });
    }
    if (url === "/lm-api/v1/models/profiles") {
      return okJson({
        families: [
          { family: "llama", profiles: [{ profile: "default", label: "Default", identity: "llama:default" }] },
          { family: "qwen-chat", profiles: [{ profile: "default", label: "Default", identity: "qwen-chat:default" }] },
        ],
      });
    }
    return okJson({});
  }));

  render(<ChatPage />);

  expect(await screen.findByLabelText("Model")).toHaveValue("qwen-chat");
  await waitFor(() => expect(screen.getByLabelText("Model Family")).toHaveValue("qwen-chat"));
  expect(screen.getByLabelText("Context Profile")).toHaveValue("default");
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
      if (url === "/lm-api/v1/threads") return conversationCreate();
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
        return streamResponse([
          'data: {"choices":[{"delta":{"content":"node reply"}}]}\n\n',
        ], new Headers({ "X-Llama-Pack-Route": "node:mac-agent" }));
      }
      if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Hello remote model", "node reply");
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
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.objectContaining({
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

it("streams a conversation response and builds the request payload", async () => {
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
      return streamResponse([
        'data: {"type":"route","route":{"node":"local","model":"mistral","reason":"test"}}\n\n',
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
      ], new Headers({ "X-Llama-Pack-Route": "local:mistral" }));
    }
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Say hello");
  await user.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
  expect(screen.getByText("Resolved agent local")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"content":"Say hello"'),
  }));
});

it("shows context budget while composing", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/chat/mistral/context-budget") {
        return okJson({
          model: "mistral",
          context_window_tokens: 32768,
          prompt_tokens_estimated: 14500,
          reserved_completion_tokens: 1024,
          available_input_tokens: 31744,
          remaining_context_tokens: 17244,
          usage_ratio: 0.4737,
          status: "comfortable",
          estimation_method: "approx_chars_div_4",
          precision: "approximate",
          warnings: [],
        });
      }
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Budget this prompt");

  await waitFor(() => {
    expect(screen.getByTestId("context-budget-summary")).toHaveTextContent("Context: 15.5k / 32.8k used");
    expect(screen.getByTestId("context-budget-summary")).toHaveTextContent("17.2k left");
    expect(screen.getByTestId("context-budget-summary")).toHaveTextContent("47%");
    expect(screen.getByTestId("context-budget-summary")).toHaveTextContent("Prompt 14.5k");
    expect(screen.getByTestId("context-budget-summary")).toHaveTextContent("Reserved output 1.0k");
  });
  expect(screen.getByRole("progressbar", { name: "Context used" })).toHaveAttribute("aria-valuenow", "47");
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
      if (url === "/lm-api/v1/threads") return conversationCreate();
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
        return streamResponse(['data: {"choices":[{"delta":{"content":"image reply"}}]}\n\n']);
      }
      if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Describe it", "image reply");
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
  const streamCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => url === "/lm-api/v1/threads/thread-1/messages/stream");
  const body = JSON.parse(String(streamCall?.[1]?.body));
  expect(body.content).toMatchObject([
    { type: "text", text: "Describe it" },
    { type: "image_url", image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) } },
  ]);
});

it("does not expose direct agent tool runtime controls in conversation chat", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "gemma-4-E2B-it:fast", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      return okJson({});
    }),
  );

  render(<ChatPage />);

  expect(await screen.findByRole("option", { name: "gemma-4-E2B-it:fast" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Agent tools")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Chat Mode")).not.toBeInTheDocument();
});

it("streams reasoning deltas before assistant content", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/threads") return conversationCreate();
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") return streamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"thinking..."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
      ]);
      if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Think first", "answer");
      return okJson({});
    }),
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
      if (url === "/lm-api/v1/threads") return conversationCreate();
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
        return streamResponse(['data: {"choices":[{"delta":{"content":"enter reply"}}]}\n\n']);
      }
      if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Do not send\nSend now", "enter reply");
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  const promptInput = await screen.findByLabelText("Prompt");
  expect(screen.getByLabelText("Enter to send")).not.toBeChecked();

  await user.type(promptInput, "Do not send{Enter}");
  expect(fetch).not.toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.anything());

  await user.click(screen.getByLabelText("Enter to send"));
  await user.type(promptInput, "Send now{Enter}");

  expect(await screen.findByText("enter reply")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.objectContaining({
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
      if (url === "/lm-api/v1/threads") return conversationCreate();
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
        return streamResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n']);
      }
      if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Return JSON", "ok");
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
  const streamCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((call) => call[0] === "/lm-api/v1/threads/thread-1/messages/stream");
  const body = JSON.parse(String(streamCall?.[1]?.body));
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
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/chat/capabilities/mistral") return okJson({ supports: { structured_output: { json_schema: true, grammar: false }, kv_cache: true } });
    if (url === "/lm-api/v1/chat/mistral/inspect") return okJson({ rendered_prompt_preview: "rendered prompt" });
    if (url === "/lm-api/v1/chat/mistral/kv/slots?target=auto") return okJson({ slots: [{ id: 0, state: "used" }] });
    if (url === "/lm-api/v1/chat/mistral/kv/slots/0") return okJson({ ok: true });
    return okJson({});
  });
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
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") return streamResponse(['data: {"choices":[{"delta":{"content":"saved reply"}}]}\n\n']);
    if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Save this", "saved reply");
    if (url === "/lm-api/v1/chat/sessions") return okJson({ id: "session-1", name: "Work session", messages: [] });
    return okJson({});
  });
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
  const saveCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.findLast(
    ([url, init]) => url === "/lm-api/v1/chat/sessions" && init?.method === "POST" && typeof init.body === "string",
  );
  const body = JSON.parse(String(saveCall?.[1]?.body));
  expect(body.request_defaults).toMatchObject({
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 1,
    thread_id: "thread-1",
    thread_metadata: { app: "ui", purpose: "chat", priority: "medium", request_type: "general" },
  });
});

it("saves a selected session as new without reusing the old session id", async () => {
  localStorage.setItem("lm_active_chat_session_id", "session-old");
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") return streamResponse(['data: {"choices":[{"delta":{"content":"new reply"}}]}\n\n']);
    if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Fork this", "new reply");
    if (url === "/lm-api/v1/chat/sessions") return okJson({ id: "session-new", name: "Forked session", messages: [] });
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Fork this");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("new reply")).toBeInTheDocument();

  await user.type(screen.getByLabelText("Session name"), "Forked session");
  await user.click(screen.getByRole("button", { name: "Save As New" }));

  expect(await screen.findByText("Session saved")).toBeInTheDocument();
  expect(localStorage.getItem("lm_active_chat_session_id")).toBe("session-new");
  const saveCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.findLast(
    ([url, init]) => url === "/lm-api/v1/chat/sessions" && init?.method === "POST" && typeof init.body === "string",
  );
  const body = JSON.parse(String(saveCall?.[1]?.body));
  expect(body.id).toBeUndefined();
  expect(body.name).toBe("Forked session");
});

it("lists, loads, deletes, and resumes chat sessions", async () => {
  let sessionListRequests = 0;
  let sessionDetailRequests = 0;
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    if (url === "/lm-api/v1/models") {
      return okJson({ models: [{ name: "mistral", status: "running" }, { name: "qwen", status: "running" }] });
    }
    if (url === "/lm-api/v1/models/profiles") {
      return okJson({ families: [] });
    }
    if (url === "/lm-api/v1/chat/sessions" && init?.method === "GET") {
      sessionListRequests += 1;
      if (sessionListRequests === 1) {
        return okJson([
          { id: "session-1", name: "Older", updated_at: "2026-05-19T01:00:00Z" },
          { id: "session-2", name: "Recent", updated_at: new Date().toISOString() },
        ]);
      }
      return okJson([
        { id: "session-2", name: "Recent", updated_at: new Date().toISOString() },
      ]);
    }
    if (url === "/lm-api/v1/chat/sessions/session-2" && init?.method === "GET") {
      sessionDetailRequests += 1;
      if (sessionDetailRequests === 1) {
        return okJson({
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
            thread_id: "thread-loaded",
            thread_metadata: { app: "codex", purpose: "support", priority: "high", request_type: "analysis" },
            include_internal: true,
          },
        });
      }
      return okJson({
        id: "session-2",
        name: "Recent",
        model: "qwen",
        target_selector: "local",
        messages: [{ role: "user", content: "resume prompt" }, { role: "assistant", content: "resume reply" }],
        request_defaults: { temperature: 0.3, max_tokens: 300, top_p: 0.8 },
      });
    }
    if (url === "/lm-api/v1/chat/sessions/session-2" && init?.method === "DELETE") {
      return okJson({ deleted: true, id: "session-2" });
    }
    return okJson({});
  }));
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
  expect(screen.queryByLabelText("Chat Mode")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Conversation ID")).toHaveValue("thread-loaded");
  expect(screen.getByLabelText("Conversation App")).toHaveValue("codex");
  expect(screen.getByLabelText("Conversation Purpose")).toHaveValue("support");
  expect(screen.getByLabelText("Conversation Priority")).toHaveValue("high");
  expect(screen.getByLabelText("Conversation Request Type")).toHaveValue("analysis");
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
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
      return streamResponse([
        'data: {"choices":[{"delta":{"content":"Hi"}}],"usage":{"prompt_tokens":4,"completion_tokens":8},"timings":{"prompt_ms":20,"predicted_ms":200,"predicted_n":10}}\n\n',
      ]);
    }
    if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Telemetry", "Hi");
    return okJson({});
  });
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

it("shows a clear error when conversation streaming is unavailable", async () => {
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
      return { ok: false, status: 404, statusText: "Not Found", text: async () => "missing stream" };
    }
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Use fallback");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("404 Not Found");
});

it("does not fall back to direct chat when conversation streaming is unavailable", async () => {
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
      return { ok: false, status: 404, statusText: "Not Found", text: async () => "missing stream" };
    }
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Use fallback");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("404 Not Found");
  expect(fetch).not.toHaveBeenCalledWith("/lm-api/v1/chat/mistral", expect.objectContaining({ method: "POST" }));
});

it("stops an active stream and marks the assistant response stopped", async () => {
  let aborted = false;
  stubChatPageFetch((url, init) => {
    if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise(() => undefined);
    }
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Stop this");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await user.click(await screen.findByRole("button", { name: "Stop" }));

  expect(aborted).toBe(true);
  expect(await screen.findByText("(stopped)")).toBeInTheDocument();
});

it("regenerates the last prompt", async () => {
  let streamCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/threads") return conversationCreate();
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
        streamCount += 1;
        return streamResponse([`data: {"choices":[{"delta":{"content":"${streamCount === 1 ? "first" : "second"}"}}]}\n\n`]);
      }
      if (url === "/lm-api/v1/threads/thread-1/events") return conversationEvents("Again", streamCount === 1 ? "first" : "second");
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Again");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("first")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Regenerate" }));

  expect(await screen.findByText("second")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.objectContaining({
    body: expect.stringContaining('"content":"Again"'),
  }));
});

it("aborts an active stream on unmount", async () => {
  let aborted = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/threads") return conversationCreate();
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
        init?.signal?.addEventListener("abort", () => { aborted = true; });
        return new Promise(() => undefined);
      }
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  const view = render(<ChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Unmount");
  await user.click(screen.getByRole("button", { name: "Send" }));
  view.unmount();

  expect(aborted).toBe(true);
});

it("creates a conversation with metadata and shows route detail", async () => {
  stubChatPageFetch((url) => {
    if (url === "/lm-api/v1/threads") {
      return okJson({ id: "thread-1", default_model: "mistral", metadata: { app: "codex", purpose: "chat", priority: "high", request_type: "coding" } });
    }
    return okJson({});
  });
  const user = userEvent.setup();

  render(<ChatPage />);
  await screen.findByRole("option", { name: "mistral" });
  await user.clear(screen.getByLabelText("Conversation App"));
  await user.type(screen.getByLabelText("Conversation App"), "codex");
  await user.selectOptions(screen.getByLabelText("Conversation Priority"), "high");
  await user.selectOptions(screen.getByLabelText("Conversation Request Type"), "coding");
  await user.click(screen.getByRole("button", { name: "New Conversation" }));

  expect(await screen.findByDisplayValue("thread-1")).toBeInTheDocument();
  expect(screen.getByText(/"thread_id": "thread-1"/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"app":"codex"'),
  }));
});

it("sends conversation messages and refreshes transcript events", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/threads") return okJson({ id: "thread-1", default_model: "mistral", metadata: {} });
      if (url === "/lm-api/v1/threads/thread-1/messages/stream") {
        return streamResponse([
          'data: {"type":"route","route":{"node":"linux","model":"mistral","reason":"request_type"}}\n\n',
          'data: {"choices":[{"delta":{"content":"controller reply"}}]}\n\n',
        ]);
      }
      if (url === "/lm-api/v1/threads/thread-1/events") return okJson({ events: [
        { event_type: "user_message", content: { text: "Route this" }, public: true },
        { event_type: "assistant_message", content: { text: "controller reply" }, public: true, route: { node: "linux", model: "mistral", reason: "request_type" }, agent_node: "linux", model: "mistral" },
      ] });
      if (url === "/lm-api/v1/chat/sessions") return okJson({ id: "session-thread", name: "Thread save", messages: [] });
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await screen.findByRole("option", { name: "mistral" });
  await user.click(screen.getByRole("button", { name: "New Conversation" }));
  await user.type(screen.getByLabelText("Prompt"), "Route this");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("controller reply")).toBeInTheDocument();
  expect(screen.getByText("Resolved agent linux")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/messages/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"content":"Route this"'),
  }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/events", expect.objectContaining({ method: "GET" }));

  await user.click(screen.getByRole("button", { name: "Save Session" }));
  expect(await screen.findByText("Session saved")).toBeInTheDocument();
  const saveCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.findLast(
    ([url, init]) => url === "/lm-api/v1/chat/sessions" && init?.method === "POST" && typeof init.body === "string",
  );
  const body = JSON.parse(String(saveCall?.[1]?.body));
  expect(body.request_defaults).toMatchObject({
    thread_id: "thread-1",
    thread_metadata: { app: "ui", purpose: "chat", priority: "medium", request_type: "general" },
  });
  expect(body.messages[0]).toMatchObject({ role: "user", content: "Route this" });
  expect(body.messages[1]).toMatchObject({
    role: "assistant",
    content: "controller reply",
    route_meta: { resolved: "linux", reason: "request_type" },
  });
});

it("refreshes conversation events with the internal event toggle", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/models") return okJson({ models: [{ name: "mistral", status: "running" }] });
      if (url === "/lm-api/v1/models/profiles") return okJson({ families: [] });
      if (url === "/lm-api/v1/threads/thread-1/events?include_internal=true") return okJson({ events: [
        { event_type: "routing_decision", public: false, content: { candidates: [{ node: "linux" }] }, route: { node: "linux", model: "mistral", reason: "policy" }, agent_node: "linux", model: "mistral" },
      ] });
      return okJson({});
    }),
  );
  const user = userEvent.setup();

  render(<ChatPage />);
  await screen.findByRole("option", { name: "mistral" });
  await user.type(screen.getByLabelText("Conversation ID"), "thread-1");
  await user.click(screen.getByLabelText("Include internal events"));
  await user.click(screen.getByRole("button", { name: "Refresh Conversation" }));

  expect(await screen.findByText(/routing_decision node=linux/)).toBeInTheDocument();
  expect(screen.getByText(/"thread_id": "thread-1"/)).toHaveTextContent("routing_decision");
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thread-1/events?include_internal=true", expect.objectContaining({ method: "GET" }));
});
