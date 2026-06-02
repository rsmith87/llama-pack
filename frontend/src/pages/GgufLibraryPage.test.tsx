import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GgufLibraryPage } from "./GgufLibraryPage";
import { AppModeProvider } from "../features/appMode/appModeContext";

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

  render(<GgufLibraryPage />);

  expect(await screen.findByRole("heading", { name: "Added Models" })).toBeInTheDocument();
  expect(screen.getByText("added.gguf")).toBeInTheDocument();
  expect(screen.getByText("available.gguf")).toBeInTheDocument();
  expect(screen.getAllByText("Directory").length).toBeGreaterThan(0);
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

  render(<GgufLibraryPage />);
  await user.click(await screen.findByRole("button", { name: "Open qwen-Q4.gguf" }));
  await user.click(screen.getByRole("button", { name: "Add Model" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/ggufs/file-1/add-model", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining('"name":"qwen-Q4"'),
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

  render(<GgufLibraryPage />);
  await user.click(await screen.findByRole("button", { name: "Open qwen.gguf" }));
  await user.click(screen.getByRole("button", { name: "Remove Model" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/library/models/qwen", expect.objectContaining({ method: "DELETE" })));

  await user.click(await screen.findByRole("button", { name: "Open qwen.gguf" }));
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

  render(<GgufLibraryPage />);
  await user.click(await screen.findByRole("button", { name: "Open qwen.gguf" }));
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

  render(
    <AppModeProvider appMode="controller">
      <GgufLibraryPage />
    </AppModeProvider>,
  );

  await user.click(await screen.findByRole("button", { name: "Open raw.gguf on mac-mini" }));
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

  render(
    <AppModeProvider appMode="agent">
      <GgufLibraryPage />
    </AppModeProvider>,
  );

  await screen.findByText("qwen.gguf");

  expect(screen.queryByRole("button", { name: "Send qwen" })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Open qwen.gguf" }));
  expect(screen.queryByRole("button", { name: "Send Model" })).not.toBeInTheDocument();
});

it("navigates to Chat from an added model card with the registered model selected", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "file-1", filename: "qwen.gguf", name: "qwen", registered: true, registered_as: "qwen-chat" },
  ])));
  const onNavigate = vi.fn();
  const user = userEvent.setup();

  render(<GgufLibraryPage onNavigate={onNavigate} />);
  await user.click(await screen.findByRole("button", { name: "Chat with qwen-chat" }));

  expect(onNavigate).toHaveBeenCalledWith("chat", {
    search: "model=qwen-chat&target=auto&mode=direct&source=gguf-library",
  });
});
