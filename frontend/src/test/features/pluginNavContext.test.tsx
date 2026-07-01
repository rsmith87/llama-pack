import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthSessionProvider, AUTH_TOKEN_STORAGE_KEY } from "../../features/auth/authSession";
import { PluginNavProvider, usePluginNav } from "../../features/plugins/pluginNavContext";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: object): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function PluginProbe() {
  const { enabledPlugins } = usePluginNav();
  return <span data-testid="plugin-count">{enabledPlugins.length}</span>;
}

function renderProviders() {
  return render(
    <AuthSessionProvider>
      <PluginNavProvider>
        <PluginProbe />
      </PluginNavProvider>
    </AuthSessionProvider>,
  );
}

it("does not fetch plugin metadata or current user for logged-out auth-enabled startup", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    okJson({
      mode: "controller",
      auth_bootstrap_required: false,
      auth_enabled: true,
      setup_recommended: false,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  renderProviders();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledWith("/lm-api/v1/setup/status", expect.anything());
  expect(fetchMock).not.toHaveBeenCalledWith("/lm-api/v1/auth/me", expect.anything());
  expect(fetchMock).not.toHaveBeenCalledWith("/lm-api/v1/plugins/enabled", expect.anything());
  expect(fetchMock).not.toHaveBeenCalledWith("/lm-api/v1/plugins/status", expect.anything());
});

it("loads plugin metadata after a persisted authenticated session is checked", async () => {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "persisted-token");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(okJson({
      mode: "controller",
      auth_bootstrap_required: false,
      auth_enabled: true,
      setup_recommended: false,
    }))
    .mockResolvedValueOnce(okJson({ username: "admin", role: "admin", created_at: "now" }))
    .mockResolvedValueOnce(okJson([{
      id: "example",
      name: "Example",
      version: "1.0.0",
      status: "enabled",
      navigation: [{ label: "Example", path: "/ui/plugins/example" }],
    }]))
    .mockResolvedValueOnce(okJson({ plugins: [] }));
  vi.stubGlobal("fetch", fetchMock);

  renderProviders();

  await waitFor(() => expect(screen.getByTestId("plugin-count")).toHaveTextContent("1"));
  expect(fetchMock).toHaveBeenNthCalledWith(1, "/lm-api/v1/setup/status", expect.anything());
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/lm-api/v1/auth/me", expect.objectContaining({
    headers: expect.objectContaining({ "X-UI-Session": "persisted-token" }),
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(3, "/lm-api/v1/plugins/enabled", expect.objectContaining({
    headers: expect.objectContaining({ "X-UI-Session": "persisted-token" }),
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(4, "/lm-api/v1/plugins/status", expect.objectContaining({
    headers: expect.objectContaining({ "X-UI-Session": "persisted-token" }),
  }));
});

it("loads plugin metadata without a session when auth is disabled", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(okJson({
      mode: "controller",
      auth_bootstrap_required: false,
      auth_enabled: false,
      setup_recommended: false,
    }))
    .mockResolvedValueOnce(okJson([]))
    .mockResolvedValueOnce(okJson({ plugins: [] }));
  vi.stubGlobal("fetch", fetchMock);

  renderProviders();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock).toHaveBeenNthCalledWith(1, "/lm-api/v1/setup/status", expect.anything());
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/lm-api/v1/plugins/enabled", expect.anything());
  expect(fetchMock).toHaveBeenNthCalledWith(3, "/lm-api/v1/plugins/status", expect.anything());
});
