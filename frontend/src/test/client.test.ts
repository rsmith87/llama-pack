import { afterEach, describe, expect, it, vi } from "vitest";
import { apiDelete, apiGet, apiPost, apiRequest, apiStream, setAuthTokenProvider } from "../api/client";
import { clearKvSlot, getChatCapabilities, getChatSession, listChatSessions, listKvSlots, saveChatSession } from "../api/chat";
import { cancelDownload, deleteDownload, discoverQuants, listDownloadHistory, listDownloadRecommendations, startDownload } from "../api/downloads";
import { getControllerStatus, getHealth, loadDashboardData } from "../api/health";
import { getCachedNodeModels, getNodeGgufs, getNodeModels, invalidateNodeModelsCache, listNodeSummaries, listNodes } from "../api/nodes";

afterEach(() => {
  setAuthTokenProvider(() => "");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("returns parsed JSON for successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await expect(apiGet<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/health", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: undefined,
    });
  });

  it("throws response detail for failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "boom",
      }),
    );

    await expect(apiGet("/health")).rejects.toThrow("500 Internal Server Error: boom");
  });

  it("attaches auth token and preserves caller headers", async () => {
    setAuthTokenProvider(() => "session-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await apiRequest("/protected", { headers: { "X-Trace": "abc" } });

    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/protected", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-UI-Session": "session-token",
        "X-Trace": "abc",
      },
      signal: undefined,
    });
  });

  it("serializes POST JSON bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ created: true }),
      }),
    );

    await apiPost("/items", { name: "llama" });

    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/items", {
      method: "POST",
      body: JSON.stringify({ name: "llama" }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: undefined,
    });
  });

  it("supports DELETE requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await apiDelete("/items/1");

    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/items/1", {
      method: "DELETE",
      headers: { Accept: "application/json" },
      signal: undefined,
    });
  });
});

describe("apiStream", () => {
  it("returns a readable stream reader", async () => {
    const reader = {} as ReadableStreamDefaultReader<Uint8Array>;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }),
    );

    await expect(apiStream("/logs/stream")).resolves.toBe(reader);
    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/logs/stream", {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      signal: undefined,
    });
  });
});

describe("loadDashboardData", () => {
  it("loads health, local models, and nodes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "llama" }] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ node_id: "mac" }] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ([{ name: "mac", reachable: true }]) }),
    );

    await expect(loadDashboardData()).resolves.toEqual({
      health: { mode: "controller" },
      localModels: [{ name: "llama" }],
      nodes: [{ node_id: "mac" }],
      nodeSummaries: [{ name: "mac", reachable: true }],
    });
  });

  it("rejects model payloads without a models array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ models: "invalid" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => [] }),
    );

    await expect(loadDashboardData()).rejects.toThrow("/models response must be an array or include a models array.");
  });

  it("rejects node inventory payloads without a nodes array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: null }) })
        .mockResolvedValueOnce({ ok: true, json: async () => [] }),
    );

    await expect(loadDashboardData()).rejects.toThrow("/nodes/models response must be an array or include a nodes array.");
  });
});

describe("getHealth", () => {
  it("shares one in-flight health request across concurrent callers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mode: "controller" }),
      }),
    );

    await expect(Promise.all([getHealth(), getHealth()])).resolves.toEqual([
      { mode: "controller" },
      { mode: "controller" },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/health", expect.anything());
  });
});

describe("getControllerStatus", () => {
  it("rejects controller status payloads without a reachable boolean", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reachable: "yes" }),
      }),
    );

    await expect(getControllerStatus()).rejects.toThrow("/health/controller response must include a reachable boolean.");
  });
});

describe("node API responses", () => {
  afterEach(() => {
    invalidateNodeModelsCache();
  });

  it("loads configured node arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ name: "mac-agent", url: "http://mac:9000" }],
      }),
    );

    await expect(listNodes()).resolves.toEqual([{ name: "mac-agent", url: "http://mac:9000" }]);
  });

  it("loads node summary arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ name: "mac-agent", reachable: true, models_total: 2 }],
      }),
    );

    await expect(listNodeSummaries()).resolves.toEqual([{ name: "mac-agent", reachable: true, models_total: 2 }]);
    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/summary", expect.anything());
  });

  it("rejects configured node payloads without node arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: "invalid" }),
      }),
    );

    await expect(listNodes()).rejects.toThrow("/nodes response must be an array or include a nodes array.");
  });

  it("rejects node model payload items that are not objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ name: "mac-agent" }, "invalid"],
      }),
    );

    await expect(getNodeModels()).rejects.toThrow("/nodes/models nodes[1] must be an object.");
  });

  it("shares one in-flight node model request across concurrent callers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: [{ name: "mac-agent", models: [{ name: "llama" }] }] }),
      }),
    );

    await expect(Promise.all([getNodeModels(), getNodeModels()])).resolves.toEqual([
      [{ name: "mac-agent", models: [{ name: "llama" }] }],
      [{ name: "mac-agent", models: [{ name: "llama" }] }],
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/models", expect.anything());
  });

  it("keeps the last successful node model inventory available for immediate reuse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: [{ name: "mac-agent", models: [{ name: "llama" }] }] }),
      }),
    );

    expect(getCachedNodeModels()).toBeNull();
    await getNodeModels();

    expect(getCachedNodeModels()).toEqual([{ name: "mac-agent", models: [{ name: "llama" }] }]);
  });

  it("rejects node GGUF payloads without node arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ nodes: null }),
      }),
    );

    await expect(getNodeGgufs()).rejects.toThrow("/nodes/ggufs response must be an array or include a nodes array.");
  });
});

describe("chat API responses", () => {
  it("loads chat session arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "session-1", updated_at: "later" }],
      }),
    );

    await expect(listChatSessions()).resolves.toEqual([{ id: "session-1", updated_at: "later" }]);
  });

  it("rejects chat session list payloads without session arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: "invalid" }),
      }),
    );

    await expect(listChatSessions()).rejects.toThrow("/chat/sessions response must be an array or include a sessions array.");
  });

  it("rejects malformed chat session records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "session-1" }, null],
      }),
    );

    await expect(listChatSessions()).rejects.toThrow("/chat/sessions sessions[1] must be an object.");
  });

  it("rejects individual chat session payloads that are not objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    await expect(getChatSession("session-1")).rejects.toThrow("/chat/sessions/session-1 response must be an object.");
  });

  it("rejects chat utility payloads that are not objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    await expect(getChatCapabilities("mistral")).rejects.toThrow("/chat/capabilities/mistral response must be an object.");
    await expect(listKvSlots("mistral")).rejects.toThrow("/chat/mistral/kv/slots?target=auto response must be an object.");
    await expect(clearKvSlot("mistral", 0)).rejects.toThrow("/chat/mistral/kv/slots/0 response must be an object.");
    await expect(saveChatSession({ target: "auto", messages: [], request_defaults: {} })).rejects.toThrow("/chat/sessions response must be an object.");
  });
});

describe("download API responses", () => {
  it("loads download history arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "download-1", status: "running" }],
      }),
    );

    await expect(listDownloadHistory()).resolves.toEqual([{ id: "download-1", status: "running" }]);
  });

  it("rejects download history payloads without download arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ downloads: "invalid" }),
      }),
    );

    await expect(listDownloadHistory()).rejects.toThrow("/downloads/history response must be an array or include a downloads array.");
  });

  it("rejects malformed download history items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "download-1" }, "invalid"],
      }),
    );

    await expect(listDownloadHistory()).rejects.toThrow("/downloads/history downloads[1] must be an object.");
  });

  it("loads quant discovery arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ filename: "model-Q4.gguf" }],
      }),
    );

    await expect(discoverQuants("owner/model")).resolves.toEqual([{ filename: "model-Q4.gguf" }]);
  });

  it("rejects quant discovery payloads without quant arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files: null }),
      }),
    );

    await expect(discoverQuants("owner/model")).rejects.toThrow("/downloads/quants response must be an array or include a files or quants array.");
  });

  it("rejects non-object recommendations and mutation responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    await expect(listDownloadRecommendations()).rejects.toThrow("/downloads/recommendations response must be an object.");
    await expect(startDownload("owner/model", {})).rejects.toThrow("/downloads/owner/model/start response must be an object.");
    await expect(cancelDownload("download-1")).rejects.toThrow("/downloads/download-1/cancel response must be an object.");
    await expect(deleteDownload("download-1")).rejects.toThrow("/downloads/download-1 response must be an object.");
  });
});
