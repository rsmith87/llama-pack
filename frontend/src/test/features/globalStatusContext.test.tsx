import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AuthSessionProvider } from "../../features/auth/authSession";
import { GlobalStatusProvider, useGlobalStatus } from "../../features/globalStatus/globalStatusContext";

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

function setupStatusPayload(): object {
  return {
    mode: "controller",
    auth_bootstrap_required: false,
    auth_enabled: false,
    setup_recommended: false,
  };
}

function fetchUrl(call: unknown[]): string {
  return String(call[0]);
}

function GlobalStatusProbe() {
  const { appMode, refreshGlobal } = useGlobalStatus();
  return (
    <>
      <span data-testid="app-mode">{appMode}</span>
      <button type="button" onClick={() => void refreshGlobal(true)}>Refresh</button>
    </>
  );
}

function renderProviders() {
  return render(
    <AuthSessionProvider>
      <GlobalStatusProvider>
        <GlobalStatusProbe />
      </GlobalStatusProvider>
    </AuthSessionProvider>,
  );
}

it("only fetches health for global status during controller startup", async () => {
  const fetchMock = vi.fn((url: string) => Promise.resolve(okJson(url === "/lm-api/v1/setup/status" ? setupStatusPayload() : {
      mode: "controller",
      configured_models: 2,
      controller_url: null,
    })));
  vi.stubGlobal("fetch", fetchMock);

  renderProviders();

  await waitFor(() => expect(screen.getByTestId("app-mode")).toHaveTextContent("controller"));
  const urls = fetchMock.mock.calls.map(fetchUrl).sort();
  expect(urls).toEqual(["/lm-api/v1/health", "/lm-api/v1/setup/status"]);
});

it("loads richer controller details on explicit global refresh", async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === "/lm-api/v1/setup/status") {
      return Promise.resolve(okJson(setupStatusPayload()));
    }
    if (url === "/lm-api/v1/nodes") {
      return Promise.resolve(okJson({
      nodes: [{ name: "mac-agent", url: "http://mac:9000", heartbeat_fresh: true }],
      }));
    }
    return Promise.resolve(okJson({
      mode: "controller",
      configured_models: 2,
      controller_url: null,
    }));
  });
  vi.stubGlobal("fetch", fetchMock);

  renderProviders();

  await waitFor(() => expect(screen.getByTestId("app-mode")).toHaveTextContent("controller"));
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/lm-api/v1/nodes", expect.anything()));

  const urls = fetchMock.mock.calls.map(fetchUrl).sort();
  expect(urls).toEqual([
    "/lm-api/v1/health",
    "/lm-api/v1/health",
    "/lm-api/v1/nodes",
    "/lm-api/v1/setup/status",
  ]);
});

it("only fetches health for global status during agent startup", async () => {
  const fetchMock = vi.fn((url: string) => Promise.resolve(okJson(url === "/lm-api/v1/setup/status" ? {
      ...setupStatusPayload(),
      mode: "agent",
    } : {
      mode: "agent",
      configured_models: 1,
      controller_url: "http://controller:9000",
    })));
  vi.stubGlobal("fetch", fetchMock);

  renderProviders();

  await waitFor(() => expect(screen.getByTestId("app-mode")).toHaveTextContent("agent"));
  const urls = fetchMock.mock.calls.map(fetchUrl).sort();
  expect(urls).toEqual(["/lm-api/v1/health", "/lm-api/v1/setup/status"]);
});
