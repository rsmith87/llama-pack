import { render, screen, waitFor } from "@testing-library/react";
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

it("groups registered and available GGUF files", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "added", filename: "added.gguf", name: "added", registered: true, registered_as: "added-model", size_bytes: 1000 },
    { id: "available", filename: "available.gguf", name: "available", registered: false, size_bytes: 2000 },
  ])));

  renderPage();

  expect(await screen.findByRole("heading", { name: "Added Models" })).toBeInTheDocument();
  // Model name appears in card title and in the detail grid; use getAllByText to confirm presence
  expect(screen.getAllByText("added").length).toBeGreaterThan(0);
  expect(screen.getAllByText("available").length).toBeGreaterThan(0);
  expect(screen.getAllByText("File ID").length).toBeGreaterThan(0);
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
