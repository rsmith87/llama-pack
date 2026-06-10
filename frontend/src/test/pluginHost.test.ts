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
      pluginId: "neuraxis_business",
      navigate: vi.fn(),
      refreshPluginStatus: vi.fn(),
    });

    await host.apiGet("/usage/status");
    await host.apiPost("identity/users", { email: "alice@example.com" });

    expect(fetch).toHaveBeenNthCalledWith(1, "/lm-api/v1/plugins/neuraxis_business/usage/status", expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(2, "/lm-api/v1/plugins/neuraxis_business/identity/users", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com" }),
    }));
  });
});
