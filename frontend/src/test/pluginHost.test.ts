import { afterEach, describe, expect, it, vi } from "vitest";
import { createPluginHostApi } from "../api/pluginHost";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createPluginHostApi", () => {
  it("scopes API helpers to the plugin namespace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    const host = createPluginHostApi({
      pluginId: "llama_pack_business",
      navigate: vi.fn(),
      refreshPluginStatus: vi.fn(),
    });

    await host.apiGet("/usage/status");
    await host.apiPost("identity/users", { email: "alice@example.com" });
    await host.apiFormPost("documents/uploads", new FormData());

    expect(fetch).toHaveBeenNthCalledWith(1, "/lm-api/v1/plugins/llama_pack_business/usage/status", expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(2, "/lm-api/v1/plugins/llama_pack_business/identity/users", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com" }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(3, "/lm-api/v1/plugins/llama_pack_business/documents/uploads", expect.objectContaining({
      method: "POST",
      body: expect.any(FormData),
    }));
  });
});
