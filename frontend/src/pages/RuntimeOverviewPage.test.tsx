import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { RuntimeOverviewPage } from "./RuntimeOverviewPage";

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

  render(<RuntimeOverviewPage />);

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
  const onNavigate = vi.fn();
  const user = userEvent.setup();

  render(<RuntimeOverviewPage onNavigate={onNavigate} />);

  await user.click(await screen.findByRole("button", { name: "Preview Route" }));
  await user.click(await screen.findByRole("button", { name: "Benchmark qwen-coder on linux" }));

  expect(onNavigate).toHaveBeenCalledWith("benchmarks", {
    search: "model=qwen-coder&target=node%3Alinux&target_node=linux&source=runtime-preview",
  });
});

it("renders agent worker status fields for transfer debugging", async () => {
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
      }));
    }
    return Promise.resolve(okJson({}));
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<RuntimeOverviewPage />);

  expect(await screen.findByText("Worker")).toBeInTheDocument();
  expect(screen.getByText("agent-a")).toBeInTheDocument();
  expect(screen.getByText("Configured, idle")).toBeInTheDocument();
  expect(screen.getByText("chat, model transfer")).toBeInTheDocument();
  expect(screen.getByText("os=mac, transfer=enabled")).toBeInTheDocument();
  expect(screen.getByText("gpu=1, disk_gb=500")).toBeInTheDocument();
  expect(screen.getByText("http://controller/lm-api/v1/nodes/agent-a/work/claim")).toBeInTheDocument();
});
