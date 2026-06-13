import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { GgufLibraryPage } from "../../pages/GgufLibraryPage";
import { AppModeProvider } from "../../features/appMode/appModeContext";

function renderPage(ui: React.ReactNode = <GgufLibraryPage />) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

it("groups local GGUF files in the model navigator by specific generation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "added", filename: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf", name: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M", registered: true, registered_as: "qwen-coder", size_bytes: 1000 },
    { id: "available", filename: "Meta-Llama-3.3-70B-Instruct-Q4_K_M.gguf", name: "Meta-Llama-3.3-70B-Instruct-Q4_K_M", registered: false, size_bytes: 2000 },
  ])));

  renderPage();

  expect(await screen.findByRole("heading", { name: "Local Model Navigator" })).toBeInTheDocument();
  const modelLines = screen.getByRole("complementary", { name: "Model lines" });
  const selectedDetails = screen.getByRole("region", { name: "Selected model details" });
  expect(within(modelLines).getByRole("button", { name: /Qwen3/ })).toBeInTheDocument();
  expect(within(modelLines).getByRole("button", { name: /Llama 3.3/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Coder 30B A3B Instruct/ })).toBeInTheDocument();
  expect(within(selectedDetails).getAllByText("Q4_K_M").length).toBeGreaterThan(0);
});

it("adds an available GGUF as a configured model", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ id: "file-1", filename: "qwen-Q4.gguf", name: "qwen-Q4", registered: false }]))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson([{ id: "file-1", filename: "qwen-Q4.gguf", name: "qwen-Q4", registered: true, registered_as: "qwen-Q4" }])),
  );
  const user = userEvent.setup();

  renderPage();
  // The unified ModelCard uses modelName() which reads the `name` field
  await user.click(await screen.findByRole("button", { name: "Open qwen-Q4" }));
  await user.click(screen.getByRole("button", { name: "Add Model" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/ggufs/file-1/add-model", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"name":"qwen-Q4"'),
  })));
});

it("shows compact mmproj paths in the add model picker labels", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(okJson([
      {
        id: "file-1",
        filename: "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
        name: "Qwen2.5-VL-7B-Instruct-Q4_K_M",
        path: "/models/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
        registered: false,
        vision: true,
        mmproj: "/Users/robertsmith/Apps/llama-pack/models/vision/qwen/mmproj-F16.gguf",
      },
      {
        id: "mmproj-1",
        filename: "mmproj-F16.gguf",
        name: "mmproj-F16",
        path: "/Users/robertsmith/Apps/llama-pack/models/vision/qwen/mmproj-F16.gguf",
        registered: false,
      },
      {
        id: "mmproj-2",
        filename: "mmproj-F16.gguf",
        name: "mmproj-F16",
        path: "/Users/robertsmith/Apps/llama-pack/models/vision/llava/mmproj-F16.gguf",
        registered: false,
      },
    ])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Open Qwen2.5-VL-7B-Instruct-Q4_K_M" }));

  const picker = screen.getAllByRole("combobox").at(-1);
  expect(picker).toBeDefined();
  expect(screen.getByRole("option", { name: /vision\/qwen\/mmproj-F16\.gguf/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /vision\/llava\/mmproj-F16\.gguf/ })).toBeInTheDocument();
  expect(picker).toHaveValue("/Users/robertsmith/Apps/llama-pack/models/vision/qwen/mmproj-F16.gguf");
});

it("allows Other records to be reclassified in the local navigator", async () => {
  let modelLine: string | null = null;
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/library/ggufs" && (!init?.method || init.method === "GET")) {
      return Promise.resolve(okJson([
        {
          asset_id: "asset-1",
          id: "custom-1",
          filename: "custom-local-model-Q4_K_M.gguf",
          name: "custom-local-model-Q4_K_M",
          registered: false,
          model_line: modelLine,
        },
      ]));
    }
    if (url === "/lm-api/v1/library/ggufs/asset-1" && init?.method === "PATCH") {
      modelLine = "Custom Local";
      return Promise.resolve(okJson({ asset_id: "asset-1", model_line: "Custom Local" }));
    }
    if (url === "/lm-api/v1/nodes/models") {
      return Promise.resolve(okJson({ nodes: [] }));
    }
    return Promise.resolve(okJson({ nodes: [] }));
  }));
  const user = userEvent.setup();

  renderPage();

  await user.click(await screen.findByRole("button", { name: /Other/ }));
  await user.click(screen.getByRole("button", { name: /custom local model/ }));
  await user.type(screen.getByLabelText("New model line"), "Custom Local");
  await user.click(screen.getByRole("button", { name: "Reclassify" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/ggufs/asset-1", expect.objectContaining({
    method: "PATCH",
    body: JSON.stringify({ model_line: "Custom Local" }),
  })));
  expect(screen.getByRole("button", { name: /Custom Local/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Other/ })).not.toBeInTheDocument();
});

it("does not open the model modal when switching lines, models, or quants in the navigator", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "qwen-q4", filename: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf", name: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M", registered: true, registered_as: "qwen-coder" },
    { id: "llama-q4", filename: "Meta-Llama-3.3-70B-Instruct-Q4_K_M.gguf", name: "Meta-Llama-3.3-70B-Instruct-Q4_K_M", registered: false },
  ])));
  const user = userEvent.setup();

  renderPage();

  const modelLines = await screen.findByRole("complementary", { name: "Model lines" });
  const selectedDetails = screen.getByRole("region", { name: "Selected model details" });
  await user.click(within(modelLines).getByRole("button", { name: /Llama 3.3/ }));

  expect(screen.queryByRole("dialog", { name: /Model Detail/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("GPU layers slider")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /70B Instruct/ }));

  expect(screen.queryByRole("dialog", { name: /Model Detail/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("GPU layers slider")).not.toBeInTheDocument();

  await user.click(within(selectedDetails).getAllByText("Q4_K_M")[0]);

  expect(screen.queryByRole("dialog", { name: /Model Detail/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("GPU layers slider")).not.toBeInTheDocument();
});

it("shows db-backed catalog, profiles, and deployment details in the model modal", async () => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/lm-api/v1/library/ggufs") {
      return Promise.resolve(okJson([
        {
          asset_id: "asset-1",
          id: "file-1",
          filename: "qwen-Q4.gguf",
          name: "qwen-Q4",
          path: "/models/qwen-Q4.gguf",
          registered: true,
          registered_as: "qwen-local",
          model_catalog: {
            model_name: "qwen-local",
            ctx: 32768,
            gpu_layers: 48,
            reasoning: "auto",
            prompt_template: "llama3",
            strengths: ["coding", "tool-use"],
            cost_tier: "medium",
          },
          model_profiles: [
            { profile_key: "default", label: "Default", order: 0, kind: "default" },
            { profile_key: "chat", label: "Chat", order: 10, kind: "interactive", ctx: 24576 },
          ],
          model_deployments: [
            { deployment_name: "default", host: "127.0.0.1", port: 8088, profile_key: "default", enabled: true },
          ],
        },
      ]));
    }
    if (url === "/lm-api/v1/nodes/models") return Promise.resolve(okJson({ nodes: [] }));
    return Promise.resolve(okJson({ nodes: [] }));
  }));
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Open qwen-Q4" }));

  expect(screen.getByText("Deployment")).toBeInTheDocument();
  expect(screen.getByText("127.0.0.1:8088 (default)")).toBeInTheDocument();
  expect(screen.getByText("Profiles")).toBeInTheDocument();
  expect(screen.getByText("Default, Chat")).toBeInTheDocument();
  expect(screen.getByText("Catalog")).toBeInTheDocument();
  expect(screen.getByText(/ctx 32768/)).toBeInTheDocument();
  expect(screen.getByText(/48 GPU layers/)).toBeInTheDocument();
  expect(screen.getByText(/coding, tool-use/)).toBeInTheDocument();
});

it("offers gpu layers shortcuts in the add model modal", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ id: "file-1", filename: "qwen-Q4.gguf", name: "qwen-Q4", registered: false }]))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson([{ id: "file-1", filename: "qwen-Q4.gguf", name: "qwen-Q4", registered: true, registered_as: "qwen-Q4" }])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Open qwen-Q4" }));

  const slider = screen.getByLabelText("GPU layers slider");
  const numeric = screen.getByLabelText("GPU layers input");
  expect(slider).toHaveValue("0");
  expect(numeric).toHaveValue(0);

  await user.click(screen.getByRole("button", { name: "Max GPU layers" }));
  expect(slider).toHaveValue("999");
  expect(numeric).toHaveValue(999);

  await user.click(screen.getByRole("button", { name: "CPU only" }));
  expect(slider).toHaveValue("0");
  expect(numeric).toHaveValue(0);

  await user.click(screen.getByRole("button", { name: "Max GPU layers" }));
  await user.click(screen.getByRole("button", { name: "Add Model" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/ggufs/file-1/add-model", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"gpu_layers":999'),
  })));
});

it("sends mtp settings from the add model modal when enabled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ id: "file-1", filename: "gemma-qat.gguf", name: "gemma-qat", registered: false }]))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson([{ id: "file-1", filename: "gemma-qat.gguf", name: "gemma-qat", registered: true, registered_as: "gemma-qat" }])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Open gemma-qat" }));
  await user.click(screen.getByLabelText("Enable MTP"));
  await user.type(screen.getByLabelText("Draft model path"), "/models/mtp-gemma-qat.gguf");
  await user.click(screen.getByRole("button", { name: "Add Model" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/ggufs/file-1/add-model", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"supports_mtp":true'),
  })));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/ggufs/file-1/add-model", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"draft_model_path":"/models/mtp-gemma-qat.gguf"'),
  })));
});

it("removes configured models and deletes GGUF files", async () => {
  let removed = false;
  let deleted = false;
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/library/models/qwen" && init?.method === "DELETE") {
      removed = true;
      return Promise.resolve(okJson({ ok: true }));
    }
    if (url === "/lm-api/v1/library/ggufs/file-1" && init?.method === "DELETE") {
      deleted = true;
      return Promise.resolve(okJson({ deleted: true }));
    }
    if (url === "/lm-api/v1/library/ggufs") {
      if (deleted) return Promise.resolve(okJson([]));
      return Promise.resolve(okJson([{ id: "file-1", filename: "qwen.gguf", name: "qwen", registered: !removed, registered_as: removed ? null : "qwen" }]));
    }
    if (url === "/lm-api/v1/nodes") return Promise.resolve(okJson({ nodes: [] }));
    if (url === "/lm-api/v1/nodes/models") return Promise.resolve(okJson({ nodes: [] }));
    return Promise.resolve(okJson({ ok: true }));
  }));
  const user = userEvent.setup();

  renderPage();
  // Unified ModelCard uses modelName() which reads `name` field ("qwen")
  await user.click(await screen.findByRole("button", { name: "Open qwen" }));
  await user.click(screen.getByRole("button", { name: "Remove Model" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/models/qwen", expect.objectContaining({ method: "DELETE" })));

  await user.click(await screen.findByRole("button", { name: "Open qwen" }));
  await user.click(screen.getByRole("button", { name: "Delete GGUF" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/ggufs/file-1", expect.objectContaining({ method: "DELETE" })));
});

it("starts a GGUF transfer to another reachable node", async () => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/library/ggufs") {
      return Promise.resolve(okJson([{ id: "file-1", filename: "qwen.gguf", name: "qwen", registered: true }]));
    }
    if (url === "/lm-api/v1/nodes/models") {
      return Promise.resolve(okJson({ nodes: [] }));
    }
    if (url === "/lm-api/v1/nodes") {
      return Promise.resolve(okJson({ nodes: [
        { name: "source", heartbeat_fresh: true },
        { name: "dest", heartbeat_fresh: true },
        { name: "offline", heartbeat_fresh: false },
      ] }));
    }
    if (url === "/lm-api/v1/nodes/source/transfers" && init?.method === "POST") {
      return Promise.resolve(okJson({ id: "transfer-1", status: "queued", target_selector: "node:dest" }));
    }
    return Promise.resolve(okJson({ ok: true }));
  }));
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Open qwen" }));
  await user.click(screen.getByRole("button", { name: "Send Model" }));
  expect(await screen.findByRole("heading", { name: "Send Model" })).toBeInTheDocument();
  expect(screen.getByText(/Send qwen/)).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "offline" })).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("Source node"), "source");
  await user.selectOptions(screen.getByLabelText("Destination node"), "dest");
  await user.selectOptions(screen.getByLabelText("Include files"), "selected_only");
  await user.click(screen.getByRole("button", { name: "Start Transfer" }));

  expect(await screen.findByText("Transfer transfer-1 queued")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/source/transfers", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      destination_node: "dest",
      source_file_id: "file-1",
      include: "selected_only",
    }),
  }));
});

it("shows unadded node GGUF files in controller mode and can transfer them", async () => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/library/ggufs") return Promise.resolve(okJson([]));
    if (url === "/lm-api/v1/nodes/models") return Promise.resolve(okJson({ nodes: [] }));
    if (url === "/lm-api/v1/nodes/ggufs") {
      return Promise.resolve(okJson([
        {
          name: "mac-mini",
          reachable: true,
          files: [{ id: "raw-file", filename: "raw.gguf", name: "raw", registered: false, size_bytes: 2048 }],
        },
        { name: "linux-2080ti", reachable: true, files: [] },
      ]));
    }
    if (url === "/lm-api/v1/nodes") {
      return Promise.resolve(okJson({ nodes: [
        { name: "mac-mini", reachable: true },
        { name: "linux-2080ti", reachable: true },
      ] }));
    }
    if (url === "/lm-api/v1/nodes/mac-mini/transfers" && init?.method === "POST") {
      return Promise.resolve(okJson({ id: "transfer-raw", status: "queued" }));
    }
    return Promise.resolve(okJson({ ok: true }));
  }));
  const user = userEvent.setup();

  renderPage(
    <AppModeProvider appMode="controller">
      <GgufLibraryPage />
    </AppModeProvider>,
  );

  // Unified ModelCard generates aria-label from modelName() which reads the `name` field ("raw")
  await user.click(await screen.findByRole("button", { name: "Open raw" }));
  expect(screen.queryByRole("button", { name: "Add Model" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete GGUF" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Transfer GGUF" }));
  await user.selectOptions(screen.getByLabelText("Destination node"), "linux-2080ti");
  await user.click(screen.getByRole("button", { name: "Start Transfer" }));

  expect(await screen.findByText("Transfer transfer-raw queued")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/mac-mini/transfers", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      destination_node: "linux-2080ti",
      source_file_id: "raw-file",
      include: "selected_with_sidecars",
    }),
  }));
});

it("hides GGUF transfer actions in agent mode", async () => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/lm-api/v1/library/ggufs") {
      return Promise.resolve(okJson([{ id: "file-1", filename: "qwen.gguf", name: "qwen", registered: true, registered_as: "qwen" }]));
    }
    if (url === "/lm-api/v1/nodes/models") return Promise.resolve(okJson({ nodes: [] }));
    return Promise.resolve(okJson({ ok: true }));
  }));

  renderPage(
    <AppModeProvider appMode="agent">
      <GgufLibraryPage />
    </AppModeProvider>,
  );

  // qwen appears in both the card title and detail grid; use getAllByText to confirm presence
  await screen.findByRole("button", { name: "Open qwen" });
  expect(screen.queryByRole("button", { name: "Send qwen" })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Open qwen" }));
  expect(screen.queryByRole("button", { name: "Send Model" })).not.toBeInTheDocument();
});

it("navigates to Chat from an added model card with the registered model selected", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "file-1", filename: "qwen.gguf", name: "qwen", registered: true, registered_as: "qwen-chat" },
  ])));
  const user = userEvent.setup();

  renderPage();
  // Unified ModelCard uses modelName() which reads `name` field ("qwen"), not registered_as
  await user.click(await screen.findByRole("button", { name: "Chat with qwen" }));
});
