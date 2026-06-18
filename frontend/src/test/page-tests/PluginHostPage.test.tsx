import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { PluginHostPage, type PluginFrontendModule } from "../../pages/PluginHostPage";

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

function stubEnabledPluginWithoutPages() {
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
            frontend: { style_entries: [], pages: [] },
            navigation: [{ label: "Hello", path: "/ui/plugins/hello_plugin" }],
            ui_routes: [{ label: "Hello Plugin", path: "/ui/plugins/hello_plugin" }],
          }]),
        });
      }
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
    }),
  );
}

function stubTemplatePlugin({ controller, styleEntries = [] }: { controller: string | null; styleEntries?: string[] }) {
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
            frontend: {
              style_entries: styleEntries,
              pages: [{
                route: "/ui/plugins/hello_plugin",
                template: "/plugin-assets/hello_plugin/templates/hello.html",
                controller,
                title: "Hello Plugin",
              }],
            },
            navigation: [],
            ui_routes: [],
          }]),
        });
      }
      if (url === "/plugin-assets/hello_plugin/templates/hello.html") {
        return Promise.resolve({
          ok: true,
          text: async () => "<section><h3>Hello Template</h3><span data-plugin-id></span></section>",
        });
      }
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
    }),
  );
}

it("loads the checked-in hello_plugin template, controller, and styles through plugin metadata", async () => {
  const helloTemplate = readFileSync(
    resolve(__dirname, "../../../../plugins/hello_plugin/hello_plugin/static/templates/hello.html"),
    "utf-8",
  );
  const helloControllerSource = readFileSync(
    resolve(__dirname, "../../../../plugins/hello_plugin/hello_plugin/static/controllers/hello.js"),
    "utf-8",
  );
  const helloStyle = readFileSync(
    resolve(__dirname, "../../../../plugins/hello_plugin/hello_plugin/static/hello.css"),
    "utf-8",
  );
  expect(helloStyle).toContain(".hello-plugin");
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
            frontend: {
              style_entries: ["/plugin-assets/hello_plugin/hello.css"],
              pages: [{
                route: "/ui/plugins/hello_plugin",
                template: "/plugin-assets/hello_plugin/templates/hello.html",
                controller: "/plugin-assets/hello_plugin/controllers/hello.js",
                title: "Hello Plugin",
              }],
            },
            navigation: [],
            ui_routes: [{ label: "Hello Plugin", path: "/ui/plugins/hello_plugin" }],
          }]),
        });
      }
      if (url === "/plugin-assets/hello_plugin/templates/hello.html") {
        return Promise.resolve({
          ok: true,
          text: async () => helloTemplate,
        });
      }
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", text: async () => "missing" });
    }),
  );
  const helloControllerUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(helloControllerSource)}`;
  const loadModule = vi.fn((entry: string) => import(/* @vite-ignore */ helloControllerUrl));

  renderPluginHost(loadModule);

  expect(await screen.findByRole("heading", { name: "Hello Plugin" })).toBeInTheDocument();
  expect(await screen.findByText("hello_plugin")).toBeInTheDocument();
  expect(await screen.findByText("/lm-api/v1/plugins/hello_plugin")).toBeInTheDocument();
  expect(loadModule).toHaveBeenCalledWith("/plugin-assets/hello_plugin/controllers/hello.js?v=1.0&r=0");
  const link = document.head.querySelector("link[data-plugin-style='hello_plugin']");
  expect(link).toHaveAttribute("href", "/plugin-assets/hello_plugin/hello.css?v=1.0&r=0");
});

it("loads a template-first plugin page and mounts its controller", async () => {
  stubTemplatePlugin({ controller: "/plugin-assets/hello_plugin/controllers/hello.js" });
  const cleanup = vi.fn();
  const loadModule = vi.fn().mockResolvedValue({
    mountPage(root: HTMLElement, host: { pluginId: string }) {
      const target = root.querySelector("[data-plugin-id]");
      if (target) target.textContent = host.pluginId;
      return cleanup;
    },
  });
  const { unmount } = renderPluginHost(loadModule);

  expect(await screen.findByRole("heading", { name: "Hello Template" })).toBeInTheDocument();
  expect(await screen.findByText("hello_plugin")).toBeInTheDocument();
  expect(loadModule).toHaveBeenCalledWith("/plugin-assets/hello_plugin/controllers/hello.js?v=1.0&r=0");

  unmount();
  expect(cleanup).toHaveBeenCalled();
});

it("renders a template-first plugin page without a controller", async () => {
  stubTemplatePlugin({ controller: null });
  const loadModule = vi.fn();

  renderPluginHost(loadModule);

  expect(await screen.findByRole("heading", { name: "Hello Template" })).toBeInTheDocument();
  expect(loadModule).not.toHaveBeenCalled();
});

it("loads and cleans up plugin style entries", async () => {
  stubTemplatePlugin({ controller: null, styleEntries: ["/plugin-assets/hello_plugin/hello.css"] });

  const { unmount } = renderPluginHost(vi.fn());

  expect(await screen.findByRole("heading", { name: "Hello Template" })).toBeInTheDocument();
  const link = document.head.querySelector("link[data-plugin-style='hello_plugin']");
  expect(link).toHaveAttribute("href", "/plugin-assets/hello_plugin/hello.css?v=1.0&r=0");

  unmount();
  expect(document.head.querySelector("link[data-plugin-style='hello_plugin']")).toBeNull();
});

it("shows a clear error when the page controller does not export mountPage", async () => {
  stubTemplatePlugin({ controller: "/plugin-assets/hello_plugin/controllers/hello.js" });
  renderPluginHost(vi.fn().mockResolvedValue({ registerPlugin: vi.fn() }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("controller does not export mountPage()");
});

it("requires plugin pages instead of legacy frontend modules", async () => {
  stubEnabledPluginWithoutPages();

  renderPluginHost(vi.fn());

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("does not declare a plugin page for /ui/plugins/hello_plugin");
});

it("passes navigation and refresh helpers to the page controller", async () => {
  stubTemplatePlugin({ controller: "/plugin-assets/hello_plugin/controllers/hello.js" });
  const loadModule = vi.fn().mockResolvedValue({
    mountPage(root: HTMLElement, host: { navigate(_path: string): void; refreshPluginStatus(): void }) {
      root.textContent = "ready";
    },
  });

  renderPluginHost(loadModule);

  expect(await screen.findByText("ready")).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(loadModule).toHaveBeenCalledTimes(1);
});

it("reloads the plugin module with a new cache-bust token", async () => {
  stubTemplatePlugin({ controller: "/plugin-assets/hello_plugin/controllers/hello.js" });
  const user = userEvent.setup();
  const loadModule = vi.fn().mockResolvedValue({
    mountPage(root: HTMLElement) {
      root.textContent = "ready";
    },
  });

  renderPluginHost(loadModule);

  expect(await screen.findByText("ready")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reload" }));
  await waitFor(() => expect(loadModule).toHaveBeenCalledTimes(2));
  expect(loadModule).toHaveBeenNthCalledWith(2, "/plugin-assets/hello_plugin/controllers/hello.js?v=1.0&r=1");
});

it("isolates plugin cleanup failures during reload", async () => {
  stubTemplatePlugin({ controller: "/plugin-assets/hello_plugin/controllers/hello.js" });
  const user = userEvent.setup();
  const loadModule = vi.fn()
    .mockResolvedValueOnce({
      mountPage(root: HTMLElement) {
        root.textContent = "first mount";
        return () => {
          throw new Error("cleanup failed");
        };
      },
    })
    .mockResolvedValueOnce({
      mountPage(root: HTMLElement) {
        root.textContent = "second mount";
      },
    });

  renderPluginHost(loadModule);

  expect(await screen.findByText("first mount")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reload" }));
  expect(await screen.findByText("second mount")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("cleanup failed");
});
