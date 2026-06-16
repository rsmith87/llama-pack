import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import App from "../App";
import { pluginStatusIssuesFromPayload } from "../features/plugins/pluginNavContext";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.body.classList.remove("nav-open");
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Pure-function tests (plugin helpers, no component rendering)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Integration tests (full App rendering via new Route-based layout)
// ---------------------------------------------------------------------------

it("renders primary React navigation and defaults to dashboard", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: true, json: async () => ({ models: [] }) });
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  render(<App />);

  expect(screen.getByRole("heading", { name: "Llama Pack" })).toBeInTheDocument();
  expect(Array.from(document.querySelectorAll(".nav-section-label")).map((node) => node.textContent)).toEqual([
    "Gateway",
    "Operations",
    "Models",
    "Runtime",
    "Plugins",
    "System",
  ]);
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass("active");
  expect(await screen.findByText("System Snapshot")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  expect(screen.queryByText("Legacy Console")).not.toBeInTheDocument();
  expect(screen.queryByText("Legacy UI")).not.toBeInTheDocument();
});

it("routes to the tool-loop evals page from the runtime navigation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") return Promise.resolve({ ok: true, json: async () => ({ available: false, path: "/tmp/tool_loop_eval_latest.json", generated_at: null, suite_count: 0, models: [], suites: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole("link", { name: "Tool Loop Evals" }));

  expect(await screen.findByRole("heading", { name: "Tool Loop Evals" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Tool Loop Evals" })).toHaveClass("active");
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
  expect(screen.getByRole("link", { name: "Setup" })).toHaveClass("active");
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

  expect(await screen.findByText("System Snapshot")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass("active");
});

it("hides controller navigation when the backend is running as an agent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "agent" }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: true, json: async () => ({ models: [] }) });
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByText("Agent runtime")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Nodes" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Controller Ops" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
});

it("renders enabled plugin navigation and a generic hosted route", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
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
  expect(await screen.findByRole("link", { name: "Hello" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Hello" }));

  expect(await screen.findByText(/does not declare a frontend entry/)).toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Hello Plugin navigation" })).getByRole("link", { name: "Settings" })).toBeInTheDocument();
});

it("renders plugin navigation from frontend pages", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "page_plugin",
              name: "Page Plugin",
              version: "1.0",
              status: "enabled",
              frontend: {
                entry: null,
                style: null,
                style_entries: ["/plugin-assets/page_plugin/plugin.css"],
                pages: [
                  {
                    route: "/ui/plugins/page_plugin",
                    template: "/plugin-assets/page_plugin/templates/index.html",
                    controller: "/plugin-assets/page_plugin/controllers/index.js",
                    title: "Page Plugin",
                  },
                  {
                    route: "/ui/plugins/page_plugin/settings",
                    template: "/plugin-assets/page_plugin/templates/settings.html",
                    controller: null,
                    title: "Settings",
                  },
                ],
              },
              navigation: [],
              secondary_navigation: [],
              ui_routes: [],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const user = userEvent.setup();

  render(<App />);

  await user.click(await screen.findByRole("link", { name: "Page Plugin" }));

  expect(within(screen.getByRole("navigation", { name: "Page Plugin navigation" })).getByRole("link", { name: "Settings" })).toBeInTheDocument();
});

it("keeps a refreshed plugin URL on the plugin page after metadata loads", async () => {
  window.history.pushState({}, "", "/ui/plugins/llama_pack_business");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "llama_pack_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/llama_pack_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/llama_pack_business", label: "Business" }],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("link", { name: "Business" })).toHaveClass("active");
  expect(await screen.findByRole("heading", { name: "Business" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/ui/plugins/llama_pack_business");
});

it("resolves browser history navigation to plugin pages after shell mount", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "llama_pack_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/llama_pack_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/llama_pack_business", label: "Business" }],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByText("System Snapshot")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "Business" })).toBeInTheDocument();

  window.history.pushState({}, "", "/ui/plugins/llama_pack_business");
  window.dispatchEvent(new PopStateEvent("popstate"));

  expect(await screen.findByRole("heading", { name: "Business" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Business" })).toHaveClass("active");
});

it("preserves plugin navigation when a metadata refresh fails", async () => {
  let enabledCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        enabledCalls += 1;
        if (enabledCalls > 1) {
          return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "llama_pack_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/llama_pack_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/llama_pack_business", label: "Business" }],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("link", { name: "Business" })).toBeInTheDocument();
});

it("preserves plugin navigation when a later metadata refresh is unexpectedly empty", async () => {
  let enabledCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") {
        enabledCalls += 1;
        return Promise.resolve({
          ok: true,
          json: async () => enabledCalls > 1 ? [] : [
            {
              id: "llama_pack_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/llama_pack_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/llama_pack_business", label: "Business" }],
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

  render(<App />);

  expect(await screen.findByRole("link", { name: "Business" })).toBeInTheDocument();
});

it("hydrates plugin navigation from the last known metadata cache", async () => {
  localStorage.setItem("llama-pack.pluginNavigation", JSON.stringify([
    {
      id: "llama_pack_business",
      name: "Business",
      version: "1.0",
      status: "enabled",
      frontend: { entry: null, style: null },
      navigation: [{ label: "Business", path: "/ui/plugins/llama_pack_business" }],
      secondary_navigation: [],
      ui_routes: [{ path: "/ui/plugins/llama_pack_business", label: "Business" }],
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

  // When auth is enabled but the user has no session, the full shell is
  // hidden and only the login screen is shown.
  expect(await screen.findByText("Log in to continue")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Business" })).not.toBeInTheDocument();
});

it("loads plugin navigation on document refresh with the persisted UI session", async () => {
  localStorage.setItem("lm_ui_token", "persisted-session");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const token = (init?.headers as Record<string, string> | undefined)?.["X-UI-Session"];
      if (url === "/lm-api/v1/auth/me" && token === "persisted-session") {
        return Promise.resolve({ ok: true, json: async () => ({ username: "admin", role: "admin" }) });
      }
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled" && token === "persisted-session") {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: "llama_pack_business",
              name: "Business",
              version: "1.0",
              status: "enabled",
              frontend: { entry: null, style: null },
              navigation: [{ label: "Business", path: "/ui/plugins/llama_pack_business" }],
              secondary_navigation: [],
              ui_routes: [{ path: "/ui/plugins/llama_pack_business", label: "Business" }],
            },
          ]),
        });
      }
      if (url === "/lm-api/v1/plugins/status" && token === "persisted-session") {
        return Promise.resolve({ ok: true, json: async () => ({ plugins: [{ id: "llama_pack_business", status: "enabled", version: "1.0", health: [], warnings: [], errors: [] }] }) });
      }
      if (url === "/lm-api/v1/plugins/enabled" || url === "/lm-api/v1/plugins/status" || url === "/lm-api/v1/auth/me") {
        return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
      }
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("link", { name: "Business" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/plugins/enabled", expect.objectContaining({
    headers: expect.objectContaining({ "X-UI-Session": "persisted-session" }),
  }));
});

it("keeps cached plugin navigation when the persisted UI session is stale", async () => {
  localStorage.setItem("llama-pack.pluginNavigation", JSON.stringify([
    {
      id: "llama_pack_business",
      name: "Business",
      version: "1.0",
      status: "enabled",
      frontend: { entry: null, style: null },
      navigation: [{ label: "Business", path: "/ui/plugins/llama_pack_business" }],
      secondary_navigation: [],
      ui_routes: [{ path: "/ui/plugins/llama_pack_business", label: "Business" }],
    },
  ]));
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized", text: async () => '{"detail":"Unauthorized"}' });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );

  render(<App />);

  expect(await screen.findByRole("link", { name: "Business" })).toBeInTheDocument();
});

it("shows plugin status failures and warnings in the shell", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
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

  expect(await screen.findByText("System Snapshot")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Hello" })).not.toBeInTheDocument();
});

it("toggles dark mode from the shell header", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: true, json: async () => ({ models: [] }) });
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
});

it("opens migrated pages and the React logs modal", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: true, json: async () => ({ models: [] }) });
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("link", { name: "Chat" }));
  expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Logs" }));
  expect(screen.getByRole("dialog", { name: "Recent Logs" })).toBeInTheDocument();
});

it("opens and closes the mobile menu after navigation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: true, json: async () => ({ models: [] }) });
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ models: [], nodes: [] }) });
    }),
  );
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
  expect(screen.getByRole("button", { name: "Close navigation menu" })).toBeInTheDocument();
  expect(document.body).toHaveClass("nav-open");

  await user.click(screen.getByRole("link", { name: "Chat" }));

  expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
  expect(document.body).not.toHaveClass("nav-open");
});

it("shows global health status and refreshes the active page", async () => {
  let modelCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }) });
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
