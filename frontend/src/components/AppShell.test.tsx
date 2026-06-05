import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import App from "../App";
import { AuthSessionProvider } from "../features/auth/authSession";
import { ThemeProvider } from "../features/theme/themeSession";
import { AppShell, pluginPagesForPlugin, pluginStatusIssuesFromPayload } from "./AppShell";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.body.classList.remove("nav-open");
  window.history.pushState({}, "", "/ui");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("maps enabled plugin metadata into shell page definitions", () => {
  const pages = pluginPagesForPlugin({
    id: "hello_plugin",
    name: "Hello Plugin",
    version: "1.0",
    status: "enabled",
    navigation: [{ label: "Hello", path: "/ui/plugins/hello_plugin" }],
    secondary_navigation: [{ label: "Settings", path: "/ui/plugins/hello_plugin/settings" }],
    ui_routes: [{ path: "/ui/plugins/hello_plugin", label: "Hello Plugin" }],
  });

  expect(pages.map((page) => [page.label, page.path, page.pluginId])).toContainEqual([
    "Hello Plugin",
    "/ui/plugins/hello_plugin",
    "hello_plugin",
  ]);
});

it("maps plugin status payloads into operator-facing issue summaries", () => {
  expect(pluginStatusIssuesFromPayload({
    plugins: [
      {
        id: "future_plugin",
        status: "incompatible",
        version: "1.0",
        health: [],
        warnings: ["Plugin requires core 2.0"],
        errors: [],
      },
      {
        id: "business_plugin",
        status: "enabled",
        version: "1.0",
        health: [{ level: "warning", message: "Plugin migration target usage is pending" }],
        warnings: [],
        errors: ["health check failed"],
      },
    ],
  })).toEqual([
    "future_plugin is incompatible",
    "future_plugin: Plugin requires core 2.0",
    "business_plugin: health check failed",
    "business_plugin: Plugin migration target usage is pending",
  ]);
});

function stubDashboardFetches() {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller" }) }),
  );
}

it("renders primary React navigation and defaults to dashboard", async () => {
  stubDashboardFetches();
  render(<App />);

  expect(screen.getByRole("heading", { name: "Neuraxis" })).toBeInTheDocument();
  expect(Array.from(document.querySelectorAll(".nav-section-label")).map((node) => node.textContent)).toEqual([
    "Gateway",
    "Operations",
    "Models",
    "Runtime",
    "Plugins",
    "System",
  ]);
  expect(screen.getByRole("button", { name: "Dashboard" })).toHaveClass("active");
  expect(await screen.findByRole("heading", { name: "System Snapshot" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  expect(screen.queryByText("Legacy Console")).not.toBeInTheDocument();
  expect(screen.queryByText("Legacy UI")).not.toBeInTheDocument();
});

it("routes first-run users to setup when auth bootstrap is required", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: true, auth_enabled: false, setup_recommended: true }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("heading", { name: "Setup Wizard" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Setup" })).toHaveClass("active");
});

it("does not block the dashboard when setup status fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: false, status: 500, statusText: "Error", text: async () => "error" });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: true, json: async () => ({ models: [] }) });
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("heading", { name: "System Snapshot" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Dashboard" })).toHaveClass("active");
});

it("hides controller navigation when the backend is running as an agent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "agent" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "agent" }) }),
  );

  render(<App />);

  expect(await screen.findByText("Agent runtime")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Nodes" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Controller Ops" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Audit" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
});

it("renders enabled plugin navigation and a generic hosted route", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "hello_plugin",
              name: "Hello Plugin",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Hello", path: "/ui/plugins/hello_plugin" }],
              secondary_navigation: [{ label: "Settings", path: "/ui/plugins/hello_plugin/settings" }],
              ui_routes: [{ path: "/ui/plugins/hello_plugin", label: "Hello Plugin" }],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const user = userEvent.setup();

  render(<App />);

  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/plugins/enabled", expect.anything()));
  expect(await screen.findByRole("button", { name: "Hello" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Hello" }));

  expect(screen.getByRole("heading", { name: "Hello Plugin" })).toBeInTheDocument();
  expect(await screen.findByText(/does not declare a frontend entry/)).toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Hello Plugin navigation" })).getByRole("button", { name: "Settings" })).toBeInTheDocument();
});

it("keeps a refreshed plugin URL on the plugin page after metadata loads", async () => {
  window.history.pushState({}, "", "/ui/plugins/neuraxis_business");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "neuraxis_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/neuraxis_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/neuraxis_business", label: "Business" }],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("button", { name: "Business" })).toHaveClass("active");
  expect(await screen.findByRole("heading", { name: "Business" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/ui/plugins/neuraxis_business");
});

it("resolves browser history navigation to plugin pages after shell mount", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "neuraxis_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/neuraxis_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/neuraxis_business", label: "Business" }],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("heading", { name: "System Snapshot" })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Business" })).toBeInTheDocument();

  window.history.pushState({}, "", "/ui/plugins/neuraxis_business");
  window.dispatchEvent(new PopStateEvent("popstate"));

  expect(await screen.findByRole("heading", { name: "Business" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Business" })).toHaveClass("active");
});

it("preserves plugin navigation when a metadata refresh fails", async () => {
  let enabledCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        enabledCalls += 1;
        if (enabledCalls > 1) {
          return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "neuraxis_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/neuraxis_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/neuraxis_business", label: "Business" }],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const renderPage = (page: { label: string }) => <h2>{page.label}</h2>;
  const renderShell = (authRefreshKey: string) => (
    <ThemeProvider>
      <AuthSessionProvider>
        <AppShell authRefreshKey={authRefreshKey} renderPage={renderPage} />
      </AuthSessionProvider>
    </ThemeProvider>
  );
  const { rerender } = render(renderShell("session-1"));

  expect(await screen.findByRole("button", { name: "Business" })).toBeInTheDocument();

  rerender(renderShell("session-2"));

  expect(await screen.findByRole("button", { name: "Business" })).toBeInTheDocument();
});

it("preserves plugin navigation when a later metadata refresh is unexpectedly empty", async () => {
  let enabledCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        enabledCalls += 1;
        return Promise.resolve({
          ok: true,
          json: async () => enabledCalls > 1 ? [] : [
            {
              id: "neuraxis_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/neuraxis_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/neuraxis_business", label: "Business" }],
            },
          ],
        });
      }
      if (url === "/lm-api/v1/plugins/status") {
        return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const renderPage = (page: { label: string }) => <h2>{page.label}</h2>;
  const renderShell = (authRefreshKey: string) => (
    <ThemeProvider>
      <AuthSessionProvider>
        <AppShell authRefreshKey={authRefreshKey} renderPage={renderPage} />
      </AuthSessionProvider>
    </ThemeProvider>
  );
  const { rerender } = render(renderShell("session-1"));

  expect(await screen.findByRole("button", { name: "Business" })).toBeInTheDocument();

  rerender(renderShell("session-2"));

  expect(await screen.findByRole("button", { name: "Business" })).toBeInTheDocument();
});

it("hydrates plugin navigation from the last known metadata cache", async () => {
  localStorage.setItem("neuraxis.pluginNavigation", JSON.stringify([
    {
      id: "neuraxis_business",
      name: "Business",
      version: "1.0",
      status: "enabled",
      frontend: { entry: null, style: null },
      navigation: [{ label: "Business", path: "/ui/plugins/neuraxis_business" }],
      secondary_navigation: [],
      ui_routes: [{ path: "/ui/plugins/neuraxis_business", label: "Business" }],
    },
  ]));
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("button", { name: "Business" })).toBeInTheDocument();
});

it("shows plugin status failures and warnings in the shell", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            plugins: [
              {
                id: "broken_plugin",
                status: "failed",
                version: "1.0",
                health: [],
                warnings: [],
                errors: ["import boom"],
              },
              {
                id: "business_plugin",
                status: "enabled",
                version: "1.0",
                health: [{ level: "warning", message: "Plugin migration target usage is pending" }],
                warnings: [],
                errors: [],
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  const alert = await screen.findByRole("alert", { name: "Plugin status" });
  expect(alert).toHaveTextContent("Plugin attention needed");
  expect(alert).toHaveTextContent("broken_plugin is failed");
  expect(alert).toHaveTextContent("broken_plugin: import boom");
  expect(alert).toHaveTextContent("business_plugin: Plugin migration target usage is pending");
});

it("hides plugin navigation when no plugin metadata is enabled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("heading", { name: "System Snapshot" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Hello" })).not.toBeInTheDocument();
});

it("toggles dark mode from the shell header", async () => {
  stubDashboardFetches();
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
});

it("opens migrated pages and the React logs modal", async () => {
  stubDashboardFetches();
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "Chat" }));
  expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Logs" }));
  expect(screen.getByRole("dialog", { name: "Recent Logs" })).toBeInTheDocument();
});

it("opens and closes the mobile menu after navigation", async () => {
  stubDashboardFetches();
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
  expect(screen.getByRole("button", { name: "Close navigation menu" })).toBeInTheDocument();
  expect(document.body).toHaveClass("nav-open");

  await user.click(screen.getByRole("button", { name: "Chat" }));

  expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
  expect(document.body).not.toHaveClass("nav-open");
});

it("shows global health status and refreshes the active page", async () => {
  let modelCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", system: { cpu_percent: 20 } }) });
      if (url === "/lm-api/v1/models") {
        modelCalls += 1;
        return Promise.resolve({ ok: true, json: async () => ({ models: [{ name: modelCalls > 1 ? "after" : "before" }] }) });
      }
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }),
  );
  const user = userEvent.setup();

  render(<App />);
  expect(await screen.findByText("before")).toBeInTheDocument();
  expect(await screen.findByText("Backend online")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Global Refresh" }));

  expect(await screen.findByText("after")).toBeInTheDocument();
  expect(screen.getByText("Backend online")).toBeInTheDocument();
});

it("refreshes the active page after login so protected data reloads with the session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const token = (init?.headers as Record<string, string> | undefined)?.["X-UI-Session"];
      if (url === "/lm-api/v1/health" && token === "token-1") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
      if (url === "/lm-api/v1/models" && token === "token-1") return Promise.resolve({ ok: true, json: async () => ({ models: [{ name: "authorized-model" }] }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
      if (url === "/lm-api/v1/nodes" && token === "token-1") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
      if (url === "/lm-api/v1/auth/login") return Promise.resolve({ ok: true, json: async () => ({ token: "token-1", username: "admin", role: "admin", expires_at: "later" }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }),
  );
  const user = userEvent.setup();

  render(<App />);
  expect(await screen.findByText(/401 Unauthorized/)).toBeInTheDocument();

  await user.type(screen.getByPlaceholderText("username"), "admin");
  await user.type(screen.getByPlaceholderText("api key"), "secret");
  await user.click(screen.getByRole("button", { name: "Login" }));

  expect(await screen.findByText("authorized-model")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/models", expect.objectContaining({
    headers: expect.objectContaining({ "X-UI-Session": "token-1" }),
  }));
});
