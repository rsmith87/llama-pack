import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { PluginsPage } from "../PluginsPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders plugin status, health, frontend, and migration metadata", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({ ok: true, json: async () => ([
          {
            id: "hello_plugin",
            name: "Hello Plugin",
            version: "1.0",
            status: "enabled",
            frontend: { entry: "/plugin-assets/hello_plugin/hello-entry.js", style: null },
            navigation: [{ label: "Hello", path: "/ui/plugins/hello_plugin" }],
            ui_routes: [{ label: "Hello Plugin", path: "/ui/plugins/hello_plugin" }],
          },
        ]) });
      }
      if (url === "/lm-api/v1/plugins/status") {
        return Promise.resolve({ ok: true, json: async () => ({
          plugins: [
            {
              id: "hello_plugin",
              status: "enabled",
              version: "1.0",
              health: [{ level: "ok", message: "Hello plugin ready" }],
              warnings: [],
              errors: [],
              config: { reject_chat: false },
            },
            {
              id: "broken_plugin",
              status: "failed",
              version: "1.0",
              health: [],
              warnings: [],
              errors: ["import boom"],
              config: {},
            },
          ],
        }) });
      }
      if (url === "/lm-api/v1/plugins/hello_plugin/migrations/status") {
        return Promise.resolve({ ok: true, json: async () => ({
          plugin_id: "hello_plugin",
          targets: [{
            id: "hello_plugin",
            directory: "hello_plugin/migrations",
            database_url: null,
            current_revision: "001_hello",
            head_revision: "001_hello",
            status: "current",
            pending: false,
          }],
        }) });
      }
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
    }),
  );
  const user = userEvent.setup();

  render(<PluginsPage />);

  expect(await screen.findByRole("heading", { name: "Plugins" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Hello Plugin" }));
  expect(screen.getByText("/plugin-assets/hello_plugin/hello-entry.js")).toBeInTheDocument();
  expect(screen.getByText("Hello plugin ready")).toBeInTheDocument();
  expect(screen.getAllByText("001_hello").length).toBeGreaterThanOrEqual(2);

  await user.click(screen.getByRole("button", { name: "broken_plugin" }));

  const detail = screen.getByRole("heading", { name: "broken_plugin" }).closest("section");
  expect(detail).not.toBeNull();
  expect(within(detail as HTMLElement).getByText("import boom")).toBeInTheDocument();
});

it("shows an empty state when no plugins are configured", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/plugins/enabled") return Promise.resolve({ ok: true, json: async () => [] });
      if (url === "/lm-api/v1/plugins/status") return Promise.resolve({ ok: true, json: async () => ({ plugins: [] }) });
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
    }),
  );

  render(<PluginsPage />);

  expect(await screen.findByText("No plugins configured.")).toBeInTheDocument();
});

it("activates and deactivates the selected plugin", async () => {
  let enabled = false;
  const fetch = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/lm-api/v1/plugins/enabled") {
      return Promise.resolve({ ok: true, json: async () => enabled ? [{
        id: "business_plugin",
        name: "Business Plugin",
        version: "1.0",
        status: "enabled",
        frontend: { entry: "/plugin-assets/business_plugin/business-entry.js", style: null },
        navigation: [],
        ui_routes: [],
      }] : [] });
    }
    if (url === "/lm-api/v1/plugins/status") {
      return Promise.resolve({ ok: true, json: async () => ({
        plugins: [{
          id: "business_plugin",
          status: enabled ? "enabled" : "disabled",
          version: "1.0",
          health: [],
          warnings: [],
          errors: [],
          config: {},
        }],
      }) });
    }
    if (url === "/lm-api/v1/plugins/business_plugin/activate") {
      enabled = true;
      return Promise.resolve({ ok: true, json: async () => ({ id: "business_plugin", status: "enabled", version: "1.0", warnings: [], errors: [] }) });
    }
    if (url === "/lm-api/v1/plugins/business_plugin/deactivate") {
      enabled = false;
      return Promise.resolve({ ok: true, json: async () => ({ id: "business_plugin", status: "disabled", version: "1.0", warnings: [], errors: [] }) });
    }
    return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
  });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();

  render(<PluginsPage />);

  await screen.findByRole("heading", { name: "business_plugin" });
  await user.click(screen.getAllByRole("button", { name: "Activate" })[0]);

  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/plugins/business_plugin/activate", expect.objectContaining({ method: "POST" }));
  await screen.findByText("/plugin-assets/business_plugin/business-entry.js");
  await user.click(screen.getAllByRole("button", { name: "Deactivate" })[0]);
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/plugins/business_plugin/deactivate", expect.objectContaining({ method: "POST" }));
});

it("loads migration controls for a configured plugin that is not enabled", async () => {
  const fetch = vi.fn((url: string) => {
    if (url === "/lm-api/v1/plugins/enabled") {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    if (url === "/lm-api/v1/plugins/status") {
      return Promise.resolve({ ok: true, json: async () => ({
        plugins: [{
          id: "neuraxis_business",
          status: "disabled",
          version: "1.0",
          health: [],
          warnings: ["Plugin migration target main is pending"],
          errors: [],
          config: {},
        }],
      }) });
    }
    if (url === "/lm-api/v1/plugins/neuraxis_business/migrations/status") {
      return Promise.resolve({ ok: true, json: async () => ({
        plugin_id: "neuraxis_business",
        targets: [{
          id: "main",
          directory: "neuraxis_business/migrations",
          database_url: null,
          current_revision: "20260604_0003",
          head_revision: "20260604_0004",
          status: "pending",
          pending: true,
          last_error: null,
        }],
      }) });
    }
    return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
  });
  vi.stubGlobal("fetch", fetch);

  render(<PluginsPage />);

  await screen.findByRole("heading", { name: "neuraxis_business" });
  expect(screen.getByText("neuraxis_business/migrations")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/plugins/neuraxis_business/migrations/status", expect.anything());
});

it("upgrades a pending migration target and refreshes migration status", async () => {
  let upgraded = false;
  let resolveUpgrade: (() => void) | undefined;
  const fetch = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/lm-api/v1/plugins/enabled") {
      return Promise.resolve({ ok: true, json: async () => ([{
        id: "hello_plugin",
        name: "Hello Plugin",
        version: "1.0",
        status: "enabled",
        frontend: { entry: "/plugin-assets/hello_plugin/hello-entry.js", style: null },
        navigation: [],
        ui_routes: [],
      }]) });
    }
    if (url === "/lm-api/v1/plugins/status") {
      return Promise.resolve({ ok: true, json: async () => ({
        plugins: [{
          id: "hello_plugin",
          status: "enabled",
          version: "1.0",
          health: [],
          warnings: upgraded ? [] : ["Plugin migration target main is pending"],
          errors: [],
          config: {},
        }],
      }) });
    }
    if (url === "/lm-api/v1/plugins/hello_plugin/migrations/status") {
      return Promise.resolve({ ok: true, json: async () => ({
        plugin_id: "hello_plugin",
        targets: [{
          id: "main",
          directory: "hello_plugin/migrations",
          database_url: null,
          current_revision: upgraded ? "002_hello" : "001_hello",
          head_revision: "002_hello",
          status: upgraded ? "current" : "pending",
          pending: !upgraded,
          last_error: null,
        }],
      }) });
    }
    if (url === "/lm-api/v1/plugins/hello_plugin/migrations/main/upgrade") {
      return new Promise((resolve) => {
        resolveUpgrade = () => {
          upgraded = true;
          resolve({ ok: true, json: async () => ({
            plugin_id: "hello_plugin",
            target: {
              id: "main",
              directory: "hello_plugin/migrations",
              database_url: null,
              current_revision: "002_hello",
              head_revision: "002_hello",
              status: "current",
              pending: false,
              last_error: null,
            },
          }) });
        };
      });
    }
    return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
  });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();

  render(<PluginsPage />);

  await screen.findByRole("button", { name: "Upgrade" });
  const upgradeClick = user.click(screen.getByRole("button", { name: "Upgrade" }));
  expect(await screen.findByRole("button", { name: "Upgrading" })).toBeDisabled();
  resolveUpgrade?.();
  await upgradeClick;

  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/plugins/hello_plugin/migrations/main/upgrade", expect.objectContaining({ method: "POST" }));
  expect(await screen.findByText("Upgrade complete")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Upgrade" })).not.toBeInTheDocument();
  expect(screen.getAllByText("current").length).toBeGreaterThan(0);
});

it("shows last_error when a migration upgrade fails", async () => {
  const fetch = vi.fn((url: string) => {
    if (url === "/lm-api/v1/plugins/enabled") {
      return Promise.resolve({ ok: true, json: async () => ([{
        id: "hello_plugin",
        name: "Hello Plugin",
        version: "1.0",
        status: "enabled",
        frontend: { entry: "/plugin-assets/hello_plugin/hello-entry.js", style: null },
        navigation: [],
        ui_routes: [],
      }]) });
    }
    if (url === "/lm-api/v1/plugins/status") {
      return Promise.resolve({ ok: true, json: async () => ({
        plugins: [{
          id: "hello_plugin",
          status: "enabled",
          version: "1.0",
          health: [{ level: "error", message: "Plugin migration target main upgrade failed: migration boom" }],
          warnings: [],
          errors: ["Plugin migration target main upgrade failed: migration boom"],
          config: {},
        }],
      }) });
    }
    if (url === "/lm-api/v1/plugins/hello_plugin/migrations/status") {
      return Promise.resolve({ ok: true, json: async () => ({
        plugin_id: "hello_plugin",
        targets: [{
          id: "main",
          directory: "hello_plugin/migrations",
          database_url: null,
          current_revision: "001_hello",
          head_revision: "002_hello",
          status: "pending",
          pending: true,
          last_error: "migration boom",
        }],
      }) });
    }
    if (url === "/lm-api/v1/plugins/hello_plugin/migrations/main/upgrade") {
      return Promise.resolve({ ok: false, status: 500, statusText: "Internal Server Error", text: async () => "migration boom" });
    }
    return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
  });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();

  render(<PluginsPage />);

  await user.click(await screen.findByRole("button", { name: "Upgrade" }));

  const elementToFind = "Plugin migration target main upgrade failed: migration boom";
  const allElementsFound = await screen.findAllByText(elementToFind);
  expect(allElementsFound[0]).toBeInTheDocument();
  expect(screen.getByText("migration boom")).toBeInTheDocument();
});
