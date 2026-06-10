import { afterEach, describe, expect, it, vi } from "vitest";
import { apiDelete, apiGet, apiPost, apiRequest, apiStream, setAuthTokenProvider } from "../api/client";
import { loadDashboardData } from "../api/health";

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
        .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ node_id: "mac" }] }) }),
    );

    await expect(loadDashboardData()).resolves.toEqual({
      health: { mode: "controller" },
      localModels: [{ name: "llama" }],
      nodes: [{ node_id: "mac" }],
    });
  });
});
