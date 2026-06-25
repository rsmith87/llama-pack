import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { RuntimeOverviewPage } from "../../pages/RuntimeOverviewPage";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("starts the selected route preview model when startup is available", async () => {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/lm-api/v1/runtime/overview") {
      return Promise.resolve(okJson({
        mode: "controller",
        agent_tools: { enabled: false, tool_count: 0, tools: [], max_iterations: 4 },
        memory: { configured: false, available: false, path: "./logs/agent_memory", auto_inject: true, top_k: 3 },
        jobs: { available: true, counts: {} },
        threads: { available: true, count: 0 },
        nodes: { available: true, count: 1, items: [{ name: "mac", request_types: ["general"], heartbeat_fresh: true }] },
        node_runtimes: { available: true, items: [] },
      }));
    }
    if (url === "/lm-api/v1/runtime/route-preview" && options?.method === "POST") {
      return Promise.resolve(okJson({
        selected: {
          node: "mac",
          model: "qwen",
          reason: "highest_score",
          score: 101,
          startup_needed: true,
          startup_decision: "start_now",
        },
        candidates: [{
          node: "mac",
          model: "qwen",
          source: "runtime_model",
          eligible: true,
          running: false,
          available: true,
          score: 101,
          strengths: ["general"],
          cost_tier: "low",
          rejections: [],
          startup_needed: true,
          startup_decision: "start_now",
        }],
        explanation: "Selected qwen on mac from 1 candidate(s).",
      }));
    }
    if (url === "/lm-api/v1/nodes/mac/models/qwen/start" && options?.method === "POST") {
      return Promise.resolve(okJson({ running: true }));
    }
    return Promise.resolve(okJson({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<MemoryRouter><RuntimeOverviewPage /></MemoryRouter>);

  await user.click(await screen.findByRole("button", { name: "Preview Route" }));
  expect(await screen.findByText("Model is available but stopped.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Start qwen on mac" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/lm-api/v1/nodes/mac/models/qwen/start",
    expect.objectContaining({ method: "POST" }),
  ));
  expect(screen.getAllByText("runtime_model").length).toBeGreaterThan(0);
});

it("navigates to Benchmarks with the selected route preview model and node", async () => {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/lm-api/v1/runtime/overview") {
      return Promise.resolve(okJson({
        mode: "controller",
        agent_tools: { enabled: false, tool_count: 0, tools: [], max_iterations: 4 },
        memory: { configured: false, available: false, path: "./logs/agent_memory", auto_inject: true, top_k: 3 },
        jobs: { available: true, counts: {} },
        threads: { available: true, count: 0 },
        nodes: { available: true, count: 1, items: [{ name: "linux", request_types: ["coding"], heartbeat_fresh: true }] },
        node_runtimes: { available: true, items: [] },
      }));
    }
    if (url === "/lm-api/v1/runtime/route-preview" && options?.method === "POST") {
      return Promise.resolve(okJson({
        selected: {
          node: "linux",
          model: "qwen-coder",
          reason: "highest_score",
          score: 101,
          startup_needed: false,
          startup_decision: "already_running",
        },
        candidates: [],
        explanation: "Selected qwen-coder on linux.",
      }));
    }
    return Promise.resolve(okJson({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<MemoryRouter><RuntimeOverviewPage /></MemoryRouter>);

  await user.click(await screen.findByRole("button", { name: "Preview Route" }));
  await user.click(await screen.findByRole("button", { name: "Benchmark qwen-coder on linux" }));
});

it("renders the reduced agent runtime surface", async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/overview") {
      return Promise.resolve(okJson({
        mode: "agent",
        agent_tools: {
          enabled: true,
          tool_count: 1,
          tools: [{ name: "read_file", type: "file_read_dynamic", description: "Read a local file." }],
          max_iterations: 4,
        },
        memory: { configured: false, available: false, path: "./logs/agent_memory", auto_inject: true, top_k: 3 },
        jobs: { available: false, counts: {} },
        threads: { available: false, count: 0 },
        nodes: { available: false, count: 0, items: [] },
        node_runtimes: { available: false, items: [] },
        worker: {
          enabled: true,
          running: false,
          configured_enabled: true,
          controller_url: "http://controller",
          node_name: "agent-a",
          poll_interval_seconds: 2,
          max_jobs: 3,
          claim_url: "http://controller/lm-api/v1/nodes/agent-a/work/claim",
          labels: { os: "mac", transfer: "enabled" },
          capacity: { gpu: 1, disk_gb: 500 },
          executors: { chat: true, embeddings: false, model_transfer: true },
        },
        running_models: {
          available: true,
          count: 1,
          items: [{ name: "qwen", port: 8081, profile_label: "fast", profile_kind: "chat", resource_tier: "gpu" }],
        },
      }));
    }
    return Promise.resolve(okJson({}));
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<MemoryRouter><RuntimeOverviewPage /></MemoryRouter>);

  expect(await screen.findByRole("heading", { name: "Agent Runtime" })).toBeInTheDocument();
  expect(await screen.findByText("Worker")).toBeInTheDocument();
  expect(screen.getByText("Running Models")).toBeInTheDocument();
  expect(screen.getByText("Local Tools")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Capacity" })).toBeInTheDocument();
  expect(screen.getByText("agent-a")).toBeInTheDocument();
  expect(screen.getByText("Configured, idle")).toBeInTheDocument();
  expect(screen.getByText("chat, model transfer")).toBeInTheDocument();
  expect(screen.getByText("os=mac, transfer=enabled")).toBeInTheDocument();
  expect(screen.getByText("gpu=1, disk_gb=500")).toBeInTheDocument();
  expect(screen.getByText("http://controller/lm-api/v1/nodes/agent-a/work/claim")).toBeInTheDocument();
  expect(screen.getByText("qwen")).toBeInTheDocument();
  expect(screen.getByText("8081")).toBeInTheDocument();
  expect(screen.getByText("read_file")).toBeInTheDocument();
  expect(screen.queryByText("Semantic Memory")).not.toBeInTheDocument();
  expect(screen.queryByText("Route Preview")).not.toBeInTheDocument();
  expect(screen.queryByText("Jobs And Threads")).not.toBeInTheDocument();
  expect(screen.queryByText("Node Capabilities")).not.toBeInTheDocument();
});

it("renders agent running model errors without controller download errors", async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/overview") {
      return Promise.resolve(okJson({
        mode: "agent",
        agent_tools: { enabled: true, tool_count: 1, tools: [], max_iterations: 4 },
        memory: { configured: false, available: false, path: "./logs/agent_memory", auto_inject: true, top_k: 3 },
        jobs: { available: false, counts: {} },
        threads: { available: false, count: 0 },
        nodes: { available: false, count: 0, items: [] },
        node_runtimes: { available: false, items: [] },
        running_models: {
          available: false,
          count: 0,
          items: [],
          error: "Runtime model status unavailable: models database schema is missing",
        },
        downloads: {
          available: false,
          active_count: 0,
          error: "Download status unavailable: download history query failed",
        },
      }));
    }
    return Promise.resolve(okJson({}));
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<MemoryRouter><RuntimeOverviewPage /></MemoryRouter>);

  expect(await screen.findByText("Runtime model status unavailable: models database schema is missing")).toBeInTheDocument();
  expect(screen.queryByText("Download status unavailable: download history query failed")).not.toBeInTheDocument();
  expect(screen.getByText("Running Models")).toBeInTheDocument();
});
