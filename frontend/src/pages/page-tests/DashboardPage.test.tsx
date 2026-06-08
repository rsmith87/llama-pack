import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../DashboardPage";

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

function renderDashboardPage(onOpenLogs?: Parameters<typeof DashboardPage>[0]["onOpenLogs"]) {
  return render(
    <MemoryRouter>
      <DashboardPage onOpenLogs={onOpenLogs} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockedNavigate.mockReset();
});

it("loads and renders health, local models, and nodes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 2, system: { cpu_percent: 11, memory_percent: 42, vram_percent: 73 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "running" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ node_id: "mac-mini", reachable: true, models: [{ name: "llama" }] }] }) }),
  );

  renderDashboardPage();

  expect(await screen.findByText("controller")).toBeInTheDocument();
  expect(screen.getByText("mistral")).toBeInTheDocument();
  expect(screen.getAllByText("mac-mini").length).toBeGreaterThan(0);
  expect(screen.getByText("73%")).toBeInTheDocument();
});

it("calls navigation when quick actions are clicked", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "agent" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [] }) }),
  );
  const user = userEvent.setup();

  renderDashboardPage();
  await screen.findByText("agent");
  await user.click(screen.getByRole("button", { name: /Open Chat/i }));

  expect(mockedNavigate).toHaveBeenCalledWith("/ui/chat");
});

it("navigates to Chat with selected model and node context from a model card", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "running", node: "mac-mini" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ name: "mac-mini", reachable: true, models: [{ name: "mistral" }] }] }) }),
  );
  const user = userEvent.setup();

  renderDashboardPage();
  await user.click(await screen.findByRole("button", { name: "Chat with mistral" }));

  expect(mockedNavigate).toHaveBeenCalledWith("/ui/chat?model=mistral&target=node%3Amac-mini&mode=thread&source=dashboard");
});

it("navigates to Benchmarks with selected model and node context from a model card", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "running", node: "mac-mini" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ name: "mac-mini", reachable: true, models: [{ name: "mistral" }] }] }) }),
  );
  const user = userEvent.setup();

  renderDashboardPage();
  await user.click(await screen.findByRole("button", { name: "Benchmark mistral" }));

  expect(mockedNavigate).toHaveBeenCalledWith("/ui/benchmarks?model=mistral&target=node%3Amac-mini&target_node=mac-mini&source=dashboard");
});

it("renders local models as GGUF-style cards with runtime actions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "stopped", path: "/models/mistral.gguf", node: "mac-mini" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ name: "mac-mini", reachable: true, models: [{ name: "mistral" }] }] }) }),
  );
  const onOpenLogs = vi.fn();
  const user = userEvent.setup();

  renderDashboardPage(onOpenLogs);
  const cardButton = await screen.findByRole("button", { name: "Open mistral" });

  expect(cardButton.closest(".library-card")).toBeInTheDocument();
  expect(screen.getByText("/models/mistral.gguf")).toBeInTheDocument();
  expect(screen.getAllByText("stopped").length).toBeGreaterThan(0);
  expect(screen.getAllByText("mac-mini").length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: "View logs for mistral" }));
  expect(onOpenLogs).toHaveBeenCalledWith(expect.objectContaining({
    source: "node-model",
    identifier: "mistral",
    node: "mac-mini",
    autoLoad: true,
  }));
});

it("renders rich model card runtime and configuration details", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "agent", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{
        name: "qwen-coder",
        status: "running",
        path: "/models/qwen-coder.gguf",
        port: 8081,
        pid: 4321,
        ctx: 16384,
        gpu_layers: 999,
        host: "127.0.0.1",
        reasoning: "auto",
        reasoning_budget: 2048,
        prompt_template: "chatml",
        file_id: "abc123",
        favorite: true,
        size_bytes: 4294967296,
      }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [] }) }),
  );

  renderDashboardPage();

  expect(await screen.findByText("qwen-coder")).toBeInTheDocument();
  expect(screen.getByText("Port")).toBeInTheDocument();
  expect(screen.getByText("8081")).toBeInTheDocument();
  expect(screen.getByText("PID")).toBeInTheDocument();
  expect(screen.getByText("4321")).toBeInTheDocument();
  expect(screen.getByText("Context")).toBeInTheDocument();
  expect(screen.getByText("16,384")).toBeInTheDocument();
  expect(screen.getByText("GPU Layers")).toBeInTheDocument();
  expect(screen.getByText("999")).toBeInTheDocument();
  expect(screen.getByText("Reasoning")).toBeInTheDocument();
  expect(screen.getByText("auto / 2,048")).toBeInTheDocument();
  expect(screen.getByText("Template")).toBeInTheDocument();
  expect(screen.getByText("chatml")).toBeInTheDocument();
  expect(screen.getByText("Size")).toBeInTheDocument();
  expect(screen.getByText("4.0 GB")).toBeInTheDocument();
  expect(screen.getByText("favorite")).toBeInTheDocument();
});

it("starts and stops local models from the Dashboard card", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "stopped", node: "mac-mini" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ name: "mac-mini", reachable: true, models: [{ name: "mistral" }] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "running", node: "mac-mini" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ name: "mac-mini", reachable: true, models: [{ name: "mistral" }] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "stopped", node: "mac-mini" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [{ name: "mac-mini", reachable: true, models: [{ name: "mistral" }] }] }) }),
  );
  const user = userEvent.setup();

  renderDashboardPage();
  await user.click(await screen.findByRole("button", { name: "Start mistral" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/mac-mini/models/mistral/start", expect.objectContaining({ method: "POST" })));
  await waitFor(() => expect(screen.getAllByText("running").length).toBeGreaterThan(0));

  await user.click(screen.getByRole("button", { name: "Stop mistral" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/mac-mini/models/mistral/stop", expect.objectContaining({ method: "POST" })));
});

it("sends dashboard local models to another reachable node", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "mistral", status: "stopped", path: "/models/mistral.gguf", node: "mac-mini", file_id: "file-1" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [
        { name: "mac-mini", reachable: true, models: [{ name: "mistral" }] },
        { name: "linux", reachable: true, models: [] },
        { name: "offline", reachable: false, models: [] },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "transfer-1", status: "queued", destination_node: "linux" }) }),
  );
  const user = userEvent.setup();

  renderDashboardPage();
  await user.click(await screen.findByRole("button", { name: "Send Model for mistral" }));

  expect(await screen.findByRole("heading", { name: "Send mistral" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "mac-mini" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "offline" })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Destination node"), "linux");
  await user.selectOptions(screen.getByLabelText("Include files"), "selected_only");
  await user.click(screen.getByRole("button", { name: "Send Model" }));

  expect(await screen.findByText("queued")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/mac-mini/transfers", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      destination_node: "linux",
      source_file_id: "file-1",
      include: "selected_only",
    }),
  }));
});

it("uses local model endpoints when no node mapping exists", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "gemma-4-E2B-it", status: "stopped" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "gemma-4-E2B-it", status: "running" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodes: [] }) }),
  );
  const user = userEvent.setup();

  renderDashboardPage();
  await user.click(await screen.findByRole("button", { name: "Start gemma-4-E2B-it" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/models/gemma-4-E2B-it/start", expect.objectContaining({ method: "POST" })));
});

it("shows a useful error when loading fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable", text: async () => "offline" }),
  );

  renderDashboardPage();

  await waitFor(() => expect(screen.getByText(/503 Service Unavailable: offline/)).toBeInTheDocument());
});

it("renders certificate alerts and per-node cert badges", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "controller", configured_models: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: [
            { name: "expired-node", reachable: true, models: [], cert_expires_in_seconds: -10 },
            { name: "expiring-node", reachable: true, models: [], cert_expires_in_seconds: 86400 },
            { name: "healthy-node", reachable: true, models: [], cert_expires_in_seconds: 60 * 60 * 24 * 90 },
          ],
        }),
      }),
  );

  renderDashboardPage();

  expect(await screen.findByText(/Expired:/)).toBeInTheDocument();
  expect(screen.getAllByText(/expired-node/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Expiring soon:/)).toBeInTheDocument();
  expect(screen.getByText(/expiring-node \(1d\)/)).toBeInTheDocument();
  expect(screen.getByText("cert expired")).toBeInTheDocument();
  expect(screen.getByText("cert 1d left")).toBeInTheDocument();
  expect(screen.getByText("cert valid")).toBeInTheDocument();
});
