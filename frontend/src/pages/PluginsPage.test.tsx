import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { PluginsPage } from "./PluginsPage";

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
