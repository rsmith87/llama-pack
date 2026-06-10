import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { NodesPage } from "../../pages/NodesPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

it("loads, merges, filters, and summarizes nodes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([
        { name: "mac-agent", url: "http://mac:9000", registration: "static" },
        { name: "win-agent", url: "http://win:9000", registration: "dynamic" },
      ]))
      .mockResolvedValueOnce(okJson([
        { name: "mac-agent", reachable: true, models: [{ name: "qwen", favorite: true }] },
        { name: "win-agent", reachable: false, models: [] },
      ])),
  );
  const user = userEvent.setup();

  render(<NodesPage />);

  expect(await screen.findByText("1/2 reachable nodes, 1 reported models")).toBeInTheDocument();
  expect(screen.getByText("mac-agent")).toBeInTheDocument();
  expect(screen.getByText("win-agent")).toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("Status"), "reachable");

  expect(screen.getByText("mac-agent")).toBeInTheDocument();
  expect(screen.queryByText("win-agent")).not.toBeInTheDocument();
});

it("saves node edits with PUT payload", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", url: "http://mac:9000", registration: "static", verify_tls: true }]))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", reachable: true, models: [] }]))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", url: "http://new:9000", registration: "static", verify_tls: false }]))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", reachable: true, models: [] }])),
  );
  const user = userEvent.setup();

  render(<NodesPage />);
  await screen.findByText("mac-agent");
  await user.click(screen.getByRole("button", { name: "Edit mac-agent" }));
  await user.clear(screen.getByLabelText("URL"));
  await user.type(screen.getByLabelText("URL"), "http://new:9000");
  await user.click(screen.getByLabelText("Verify TLS"));
  await user.click(screen.getByRole("button", { name: "Save Node" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/mac-agent", expect.objectContaining({
    method: "PUT",
    body: JSON.stringify({ url: "http://new:9000", api_key: "", verify_tls: false }),
  })));
});

it("sends remote model actions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", url: "http://mac:9000" }]))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", reachable: true, models: [{ name: "qwen" }] }]))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", url: "http://mac:9000" }]))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", reachable: true, models: [{ name: "qwen" }] }])),
  );
  const user = userEvent.setup();

  render(<NodesPage />);
  await screen.findByText("qwen");
  await user.click(screen.getByRole("button", { name: "Start qwen on mac-agent" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/mac-agent/models/qwen/start", expect.objectContaining({ method: "POST" })));
});

it("opens node model logs from each model card", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", url: "http://mac:9000" }]))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", reachable: true, models: [{ name: "qwen" }] }])),
  );
  const user = userEvent.setup();

  render(<NodesPage />);
  await user.click(await screen.findByRole("button", { name: "View logs for qwen on mac-agent" }));
});

it("offers Send only for reachable source GGUF models", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([
        { name: "source", url: "http://source:9000" },
        { name: "dest", url: "http://dest:9000" },
        { name: "offline", url: "http://offline:9000" },
      ]))
      .mockResolvedValueOnce(okJson([
        { name: "source", reachable: true, models: [{ name: "qwen", model_path: "/models/qwen.gguf", file_id: "file-qwen" }] },
        { name: "dest", reachable: true, models: [{ name: "llama", model_path: "/models/llama.bin", file_id: "file-llama" }] },
        { name: "offline", reachable: false, models: [{ name: "mistral", model_path: "/models/mistral.gguf", file_id: "file-mistral" }] },
      ])),
  );

  render(<NodesPage />);

  expect(await screen.findByRole("button", { name: "Send qwen from source" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send llama from dest" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send mistral from offline" })).not.toBeInTheDocument();
});

it("submits a model transfer from a reachable source to another reachable node", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([
        { name: "source", url: "http://source:9000" },
        { name: "dest", url: "http://dest:9000" },
        { name: "offline", url: "http://offline:9000" },
      ]))
      .mockResolvedValueOnce(okJson([
        { name: "source", reachable: true, models: [{ name: "qwen", model_path: "/models/qwen.gguf", file_id: "file-qwen" }] },
        { name: "dest", reachable: true, models: [] },
        { name: "offline", reachable: false, models: [] },
      ]))
      .mockResolvedValueOnce(okJson({ id: "transfer-1", status: "queued" }))
      .mockResolvedValueOnce(okJson({
        id: "transfer-1",
        status: "running",
        source_node: "source",
        destination_node: "dest",
        files_total: 2,
        files_copied: 1,
        files_skipped: 0,
      })),
  );
  const user = userEvent.setup();

  render(<NodesPage />);
  await user.click(await screen.findByRole("button", { name: "Send qwen from source" }));

  expect(screen.getByRole("heading", { name: "Send qwen" })).toBeInTheDocument();
  const destinationSelect = screen.getByLabelText("Destination node");
  expect(within(destinationSelect).queryByRole("option", { name: "source" })).not.toBeInTheDocument();
  expect(within(destinationSelect).queryByRole("option", { name: "offline" })).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("Destination node"), "dest");
  await user.click(screen.getByRole("button", { name: "Send Model" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/source/transfers", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      destination_node: "dest",
      source_file_id: "file-qwen",
      include: "selected_with_sidecars",
    }),
  })));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/transfers/transfer-1", expect.objectContaining({ method: "GET" })));
  expect(await screen.findByText("running")).toBeInTheDocument();
  expect(screen.getByText("1/2 files copied, 0 skipped")).toBeInTheDocument();
});
