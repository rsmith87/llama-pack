import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TestChatPage } from "../../pages/TestChatPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function okJson(payload: unknown) {
  return { ok: true, headers: new Headers(), json: async () => payload, text: async () => JSON.stringify(payload) };
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

function streamResponse(chunks: string[]) {
  return { ok: true, headers: new Headers(), body: { getReader: () => streamReader(chunks) }, text: async () => "" };
}

function bootstrapMock() {
  return (url: string) => {
    if (url === "/lm-api/v1/test-chat/bootstrap") return Promise.resolve(okJson({ enabled: true, key_hint: "lmt_te...test" }));
    if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [{ name: "qwen" }] }));
    if (url === "/lm-api/v1/models/profiles") return Promise.resolve(okJson({ families: [] }));
    if (url === "/lm-api/v1/chat/sessions") return Promise.resolve(okJson({ sessions: [] }));
    return Promise.resolve(okJson({}));
  };
}

it("loads without UI login and uses server-scoped test chat session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url === "/lm-api/v1/test-chat/bootstrap") return Promise.resolve(okJson({ enabled: true, key_hint: "lmt_te...test" }));
      if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [] }));
      if (url === "/lm-api/v1/nodes/models") {
        expect(init?.headers).not.toMatchObject({ "X-Llama-Pack-Key": expect.any(String) });
        expect(init?.credentials).toBe("same-origin");
        return Promise.resolve(okJson([{ name: "linux-2080ti", reachable: true, models: [{ name: "qwen" }] }]));
      }
      if (url === "/lm-api/v1/chat/sessions") {
        expect(init?.headers).not.toMatchObject({ "X-Llama-Pack-Key": expect.any(String) });
        expect(init?.credentials).toBe("same-origin");
        return Promise.resolve(okJson({ sessions: [{ id: "s1", name: "Coding test", model: "qwen", updated_at: "now" }] }));
      }
      return Promise.resolve(okJson({}));
    }),
  );

  render(<TestChatPage />);

  expect(await screen.findByText("Test chat session active")).toBeInTheDocument();
  expect(screen.getByText("lmt_te...test")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Coding test" })).toBeInTheDocument();
  expect(await screen.findByRole("option", { name: "qwen on linux-2080ti" })).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("api key")).not.toBeInTheDocument();
});

it("renders model family and context profile selectors from catalog and sends them", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url === "/lm-api/v1/test-chat/bootstrap") return Promise.resolve(okJson({ enabled: true, key_hint: "lmt_te...test" }));
      if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [{ name: "gemma" }] }));
      if (url === "/lm-api/v1/models/profiles") {
        return Promise.resolve(okJson({
          families: [{
            family: "gemma",
            profiles: [
              { profile: "fast", label: "Fast", identity: "gemma:fast", ctx: 8192 },
              { profile: "long", label: "Long", identity: "gemma:long", ctx: 131072 },
            ],
          }],
        }));
      }
      if (url === "/lm-api/v1/chat/sessions") return Promise.resolve(okJson({ sessions: [] }));
      if (url === "/lm-api/v1/threads") return Promise.resolve(okJson({ id: "thd_profile", metadata: { request_type: "coding" }, default_model: "gemma" }));
      if (url === "/lm-api/v1/threads/thd_profile/messages/stream") {
        expect(String(init?.body)).toContain('"model_family":"gemma"');
        expect(String(init?.body)).toContain('"context_profile":"long"');
        return Promise.resolve(streamResponse([
          'data: {"type":"route","route":{"node":"mac","model":"gemma:long","reason":"profile"}}\n\n',
          'data: {"choices":[{"delta":{"content":"profile routed"}}]}\n\n',
          "data: [DONE]\n\n",
        ]));
      }
      return Promise.resolve(okJson({}));
    }),
  );
  const user = userEvent.setup();

  render(<TestChatPage />);

  expect(await screen.findByLabelText("Model Family")).toBeInTheDocument();
  expect(await screen.findByLabelText("Context Profile")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Long" })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Context Profile"), "long");
  await user.type(screen.getByLabelText("Prompt"), "Use profile");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("profile routed")).toBeInTheDocument();
});

it("sends a routed thread message via stream endpoint and displays route tokens", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url === "/lm-api/v1/test-chat/bootstrap") return Promise.resolve(okJson({ enabled: true, key_hint: "lmt_te...test" }));
      if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [{ name: "qwen" }] }));
      if (url === "/lm-api/v1/chat/sessions") return Promise.resolve(okJson({ sessions: [] }));
      if (url === "/lm-api/v1/threads") {
        expect(init?.credentials).toBe("same-origin");
        return Promise.resolve(okJson({ id: "thd_1", metadata: { request_type: "coding" }, default_model: "qwen" }));
      }
      if (url === "/lm-api/v1/threads/thd_1/messages/stream") {
        expect(init?.credentials).toBe("same-origin");
        return Promise.resolve(streamResponse([
          'data: {"type":"route","route":{"node":"linux-2080ti","model":"qwen","strategy":"request_type","reason":"request_type"}}\n\n',
          'data: {"choices":[{"delta":{"content":"routed answer"}}]}\n\n',
          "data: [DONE]\n\n",
        ]));
      }
      return Promise.resolve(okJson({}));
    }),
  );
  const user = userEvent.setup();

  render(<TestChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Where should this go?");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("routed answer")).toBeInTheDocument();
  expect(screen.getByText("agent: linux-2080ti")).toBeInTheDocument();
  expect(screen.getByText("model: qwen")).toBeInTheDocument();
  expect(screen.getByText("reason: request_type")).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/threads/thd_1/messages/stream", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining("Where should this go?"),
  })));
});

it("streams reasoning until answer content arrives and then renders a reasoning drawer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/test-chat/bootstrap") return Promise.resolve(okJson({ enabled: true, key_hint: "lmt_te...test" }));
      if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [{ name: "qwen" }] }));
      if (url === "/lm-api/v1/chat/sessions") return Promise.resolve(okJson({ sessions: [] }));
      if (url === "/lm-api/v1/threads") return Promise.resolve(okJson({ id: "thd_2", default_model: "qwen" }));
      if (url === "/lm-api/v1/threads/thd_2/messages/stream") {
        return Promise.resolve(streamResponse([
          'data: {"choices":[{"delta":{"reasoning_content":"thinking..."}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
          "data: [DONE]\n\n",
        ]));
      }
      return Promise.resolve(okJson({}));
    }),
  );
  const user = userEvent.setup();

  render(<TestChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Think hard");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("thinking...")).toBeInTheDocument();
  expect(await screen.findByText("answer")).toBeInTheDocument();

  const summary = screen.getByText("Reasoning");
  expect(summary).toBeInTheDocument();
  // After content arrived, the drawer should be collapsed (details element closed)
  const details = summary.closest("details");
  expect(details).not.toBeNull();
  expect(details).not.toHaveAttribute("open");
});

it("shows a route chip when stream starts with a route event", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/test-chat/bootstrap") return Promise.resolve(okJson({ enabled: true, key_hint: "lmt_te...test" }));
      if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [{ name: "qwen" }] }));
      if (url === "/lm-api/v1/chat/sessions") return Promise.resolve(okJson({ sessions: [] }));
      if (url === "/lm-api/v1/threads") return Promise.resolve(okJson({ id: "thd_3", default_model: "qwen" }));
      if (url === "/lm-api/v1/threads/thd_3/messages/stream") {
        return Promise.resolve(streamResponse([
          'data: {"type":"route","route":{"node":"gpu-node","model":"qwen","strategy":"request_type","reason":"request_type"}}\n\n',
          'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
          "data: [DONE]\n\n",
        ]));
      }
      return Promise.resolve(okJson({}));
    }),
  );
  const user = userEvent.setup();

  render(<TestChatPage />);
  await user.type(await screen.findByLabelText("Prompt"), "Route me");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("done")).toBeInTheDocument();
  expect(screen.getByText("agent: gpu-node")).toBeInTheDocument();
});

it("shows a controller launcher when opened on an agent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/test-chat/bootstrap") {
        return Promise.resolve(okJson({
          enabled: false,
          mode: "agent",
          controller_test_chat_url: "http://controller.local:9137/ui/test-chat",
        }));
      }
      return Promise.resolve(okJson({}));
    }),
  );

  render(<TestChatPage />);

  expect(await screen.findByRole("heading", { name: "Controller mode required" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open controller test chat" })).toHaveAttribute(
    "href",
    "http://controller.local:9137/ui/test-chat",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
