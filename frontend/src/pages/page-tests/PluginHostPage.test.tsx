import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { PluginHostPage, type PluginFrontendModule } from "../PluginHostPage";

type PluginModuleLoader = (entry: string) => Promise<PluginFrontendModule>;

vi.mock("../../features/globalStatus/globalStatusContext", () => ({
  useGlobalStatus: () => ({ refreshKey: 0 }),
}));

vi.mock("../../features/plugins/pluginNavContext", () => ({
  usePluginNav: () => ({ pluginPages: [], enabledPlugins: [], pluginStatusIssues: [] }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPluginHost(loadModule: PluginModuleLoader) {
  return render(
    <MemoryRouter initialEntries={["/ui/plugins/hello_plugin"]}>
      <Routes>
        <Route path="/ui/plugins/:pluginId" element={<PluginHostPage loadModule={loadModule} />} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  const { unmount } = renderPluginHost(loadModule);

  expect(await screen.findByText("mounted hello_plugin")).toBeInTheDocument();
  expect(loadModule).toHaveBeenCalledWith("/plugin-assets/hello_plugin/hello-entry.js?v=1.0&r=0");

  unmount();
  expect(cleanup).toHaveBeenCalled();
});

it("loads the checked-in hello_plugin frontend bundle through plugin metadata", async () => {
  stubEnabledPlugin();
  const helloEntrySource = readFileSync(
    resolve(__dirname, "../../../../plugins/hello_plugin/hello_plugin/static/hello-entry.js"),
    "utf-8",
  );
  const helloEntryUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(helloEntrySource)}`;
  const loadModule = vi.fn((entry: string) => import(/* @vite-ignore */ helloEntryUrl));

  renderPluginHost(loadModule);

  expect(await screen.findByRole("heading", { name: "Hello Plugin" })).toBeInTheDocument();
  expect(await screen.findByText("hello_plugin")).toBeInTheDocument();
  expect(loadModule).toHaveBeenCalledWith("/plugin-assets/hello_plugin/hello-entry.js?v=1.0&r=0");
});

it("shows a clear error when the module does not export mount", async () => {
  stubEnabledPlugin();
  renderPluginHost(vi.fn().mockResolvedValue({ registerPlugin: vi.fn() }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("frontend does not export mount()");
});

it("passes navigation and refresh helpers to the plugin module", async () => {
  stubEnabledPlugin();
  const loadModule = vi.fn().mockResolvedValue({
    mount(container: HTMLElement, host: { navigate(_path: string): void; refreshPluginStatus(): void }) {
      container.textContent = "ready";
    },
  });

  renderPluginHost(loadModule);

  expect(await screen.findByText("ready")).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(loadModule).toHaveBeenCalledTimes(1);
});

it("reloads the plugin module with a new cache-bust token", async () => {
  stubEnabledPlugin();
  const user = userEvent.setup();
  const loadModule = vi.fn().mockResolvedValue({
    mount(container: HTMLElement) {
      container.textContent = "ready";
    },
  });

  renderPluginHost(loadModule);

  expect(await screen.findByText("ready")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reload" }));
  await waitFor(() => expect(loadModule).toHaveBeenCalledTimes(2));
  expect(loadModule).toHaveBeenNthCalledWith(2, "/plugin-assets/hello_plugin/hello-entry.js?v=1.0&r=1");
});

it("isolates plugin cleanup failures during reload", async () => {
  stubEnabledPlugin();
  const user = userEvent.setup();
  const loadModule = vi.fn()
    .mockResolvedValueOnce({
      mount(container: HTMLElement) {
        container.textContent = "first mount";
        return () => {
          throw new Error("cleanup failed");
        };
      },
    })
    .mockResolvedValueOnce({
      mount(container: HTMLElement) {
        container.textContent = "second mount";
      },
    });

  renderPluginHost(loadModule);

  expect(await screen.findByText("first mount")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reload" }));
  expect(await screen.findByText("second mount")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("cleanup failed");
});