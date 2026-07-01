import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NodesPage } from "../../pages/NodesPage";
import { getNodeModels, invalidateNodeModelsCache } from "../../api/nodes";

const { mockedNavigate } = vi.hoisted(() => ({
  mockedNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

function renderNodesPage() {
  return render(
    <MemoryRouter>
      <NodesPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  invalidateNodeModelsCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockedNavigate.mockReset();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

it("renders cached node model inventory immediately while refreshing", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(okJson([{ name: "cached-agent", reachable: true, models: [{ name: "cached-model" }] }])),
  );
  await getNodeModels();
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

  renderNodesPage();

  expect(screen.getByText("1/1 reachable nodes, 1 reported models")).toBeInTheDocument();
  expect(screen.getAllByText("cached-agent").length).toBeGreaterThan(0);
  expect(screen.getByText("cached-model")).toBeInTheDocument();
});

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

  renderNodesPage();

  expect(await screen.findByText("1/2 reachable nodes, 1 reported models")).toBeInTheDocument();
  expect(screen.getAllByText("mac-agent").length).toBeGreaterThan(0);
  expect(screen.getAllByText("win-agent").length).toBeGreaterThan(0);

  await user.selectOptions(screen.getByLabelText("Status"), "reachable");

  expect(screen.getAllByText("mac-agent").length).toBeGreaterThan(0);
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

  renderNodesPage();
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

  renderNodesPage();
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

  renderNodesPage();
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

  renderNodesPage();

  expect(await screen.findByRole("button", { name: "Send qwen on source" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send llama on dest" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send mistral on offline" })).not.toBeInTheDocument();
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

  renderNodesPage();
  await user.click(await screen.findByRole("button", { name: "Send qwen on source" }));

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

it("navigates to GGUF Library from a node model card with dashboard-style handoff", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", url: "http://mac:9000" }]))
      .mockResolvedValueOnce(okJson([{ name: "mac-agent", reachable: true, models: [{ name: "qwen", file_id: "file-qwen", favorite: true, status: "running" }] }])),
  );
  const user = userEvent.setup();

  renderNodesPage();
  await user.click(await screen.findByRole("button", { name: "Open qwen" }));

  expect(mockedNavigate).toHaveBeenCalledWith("/ui/gguf-library?source=dashboard&model=qwen&node=mac-agent&file_id=file-qwen");
  expect(screen.getByText("favorite")).toBeInTheDocument();
});
