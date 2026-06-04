import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PluginHostPage } from "./PluginHostPage";
import type { PageDefinition } from "../routes/pages";

const page: PageDefinition = {
  key: "plugin:hello_plugin:/ui/plugins/hello_plugin",
  label: "Hello Plugin",
  path: "/ui/plugins/hello_plugin",
  icon: "settings",
  section: "plugins",
  pluginId: "hello_plugin",
  pluginName: "Hello Plugin",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubEnabledPlugin(entry = "/plugin-assets/hello_plugin/hello-entry.js") {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/plugins/enabled") {
        return Promise.resolve({
          ok: true,
          json: async () => ([{
            id: "hello_plugin",
            name: "Hello Plugin",
            version: "1.0",
            status: "enabled",
            frontend: { entry, style: null },
            navigation: [{ label: "Hello", path: "/ui/plugins/hello_plugin" }],
            ui_routes: [{ label: "Hello Plugin", path: "/ui/plugins/hello_plugin" }],
          }]),
        });
      }
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
    }),
  );
}

it("loads a plugin frontend module and mounts it into the host container", async () => {
  stubEnabledPlugin();
  const cleanup = vi.fn();
  const loadModule = vi.fn().mockResolvedValue({
    mount(container: HTMLElement, host: { pluginId: string }) {
      container.textContent = `mounted ${host.pluginId}`;
      return cleanup;
    },
  });
  const { unmount } = render(<PluginHostPage page={page} onNavigate={vi.fn()} loadModule={loadModule} />);

  expect(await screen.findByText("mounted hello_plugin")).toBeInTheDocument();
  expect(loadModule).toHaveBeenCalledWith("/plugin-assets/hello_plugin/hello-entry.js");

  unmount();
  expect(cleanup).toHaveBeenCalled();
});

it("shows a clear error when the module does not export mount", async () => {
  stubEnabledPlugin();
  render(<PluginHostPage page={page} onNavigate={vi.fn()} loadModule={vi.fn().mockResolvedValue({ registerPlugin: vi.fn() })} />);

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("frontend does not export mount()");
});

it("passes navigation and refresh helpers to the plugin module", async () => {
  stubEnabledPlugin();
  const navigate = vi.fn();
  const loadModule = vi.fn().mockResolvedValue({
    mount(container: HTMLElement, host: { navigate(path: string): void; refreshPluginStatus(): void }) {
      host.navigate("/ui/plugins/hello_plugin/settings");
      host.refreshPluginStatus();
      container.textContent = "ready";
    },
  });

  render(<PluginHostPage page={page} onNavigate={navigate} loadModule={loadModule} />);

  expect(await screen.findByText("ready")).toBeInTheDocument();
  expect(navigate).toHaveBeenCalledWith("/ui/plugins/hello_plugin/settings");
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
});
