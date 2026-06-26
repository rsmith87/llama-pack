import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function unauthorizedJson(payload: unknown) {
  return {
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    text: async () => JSON.stringify(payload),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.pushState({}, "", "/");
});

function stubReactSmokeFetches() {
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    if (url === "/lm-api/v1/setup/status") return Promise.resolve(okJson({ mode: "controller", auth_bootstrap_required: false, auth_enabled: false, setup_recommended: false }));
    if (url === "/lm-api/v1/health") return Promise.resolve(okJson({ mode: "controller", configured_models: 1, system: { cpu_percent: 10 } }));
    if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [{ name: "qwen" }] }));
    if (url === "/lm-api/v1/nodes") return Promise.resolve(okJson([{ name: "mac", url: "http://mac" }]));
    if (url === "/lm-api/v1/nodes/models") return Promise.resolve(okJson([{ name: "mac", reachable: true, models: [{ name: "qwen" }] }]));
    if (url === "/lm-api/v1/library/ggufs") return Promise.resolve(okJson([{ id: "gguf-1", filename: "qwen.gguf", model_dir: "Qwen", registered: true }]));
    if (url.startsWith("/lm-api/v1/downloads/history")) return Promise.resolve(okJson([{ id: "download-1", repo_id: "owner/model", status: "complete" }]));
    if (url === "/lm-api/v1/conversions") return Promise.resolve(okJson([{ name: "Qwen", status: "ready", ggufs: ["qwen.gguf"] }]));
    if (url === "/lm-api/v1/quantizations/files") return Promise.resolve(okJson([{ id: "file-1", model_dir: "Qwen", filename: "qwen.gguf", supported_types: ["Q4_K_M"] }]));
    if (url.startsWith("/lm-api/v1/jobs")) return Promise.resolve(okJson([{ id: "job-1", status: "succeeded", type: "chat", target_selector: "auto" }]));
    if (url === "/lm-api/v1/controller/stats") return Promise.resolve(okJson({ job_counts: { succeeded: 1 } }));
    if (url === "/lm-api/v1/controller/retention-policy") return Promise.resolve(okJson({ retention_days: 7 }));
    if (url.startsWith("/lm-api/v1/audit/events")) return Promise.resolve(okJson([{ id: "evt-1", event_type: "auth_login", actor: "admin", dry_run: false }]));
    if (url === "/lm-api/v1/runtime/overview") return Promise.resolve(okJson({
      mode: "controller",
      agent_tools: { enabled: false, tool_count: 0, tools: [], max_iterations: 4 },
      memory: { configured: false, available: false, path: "./logs/agent_memory", auto_inject: true, top_k: 3 },
      jobs: { available: true, counts: { succeeded: 1 } },
      threads: { available: true, count: 2 },
      nodes: { available: true, count: 1, items: [{ name: "mac", request_types: ["general"], heartbeat_fresh: true }] },
      node_runtimes: { available: true, items: [{ name: "mac", reachable: true, tools_enabled: true, tool_count: 4, memory_configured: false, memory_available: false }] },
    }));
    if (url === "/lm-api/v1/runtime/route-preview" && options?.method === "POST") return Promise.resolve(okJson({
      selected: { node: "mac", model: "qwen", reason: "highest_score", score: 111 },
      candidates: [{ node: "mac", model: "qwen", eligible: true, running: true, score: 111, strengths: ["coding"], cost_tier: "low", rejections: [] }],
      explanation: "Selected qwen on mac from 1 candidate(s).",
    }));
    if (url === "/lm-api/v1/auth/me") return Promise.resolve(okJson({ username: "admin", role: "admin", created_at: "now" }));
    if (url === "/lm-api/v1/settings/runtime") return Promise.resolve(okJson({
      settings: {
        controller_retention_days: 30,
        controller_archive_retention_days: 90,
        controller_archive_dir: "logs/archive",
        routing_fanout_enabled: false,
        routing_fanout_max: 2,
        agent_worker_enabled: false,
        agent_worker_poll_interval_seconds: 2,
        agent_worker_max_jobs: 1,
        agent_worker_labels: {},
        agent_worker_capacity: {},
        client_cors_origins: [],
        agent_tools_enabled: false,
        agent_tools_max_iterations: 4,
        agent_tools_tool_timeout_seconds: 10,
        agent_tools_answer_verification_mode: "warn",
        agent_tools_answer_verification_max_retries: 1,
        agent_tools_safe_roots: [],
        context_summarization_enabled: true,
        context_summarization_trigger_ratio: 0.75,
        context_summarization_target_ratio: 0.55,
        context_summarization_recent_messages: 4,
        context_summarization_max_tokens: 768,
        thread_history_compaction_enabled: true,
        thread_history_context_ratio: 0.55,
        thread_history_min_prompt_tokens: 6000,
        thread_history_recent_messages: 4,
        thread_history_summary_max_chars: 2000,
        thread_history_summary_item_max_chars: 240,
      },
      sources: {
        controller_retention_days: "default",
        controller_archive_retention_days: "default",
        controller_archive_dir: "default",
        routing_fanout_enabled: "default",
        routing_fanout_max: "default",
        agent_worker_enabled: "default",
        agent_worker_poll_interval_seconds: "default",
        agent_worker_max_jobs: "default",
        agent_worker_labels: "default",
        agent_worker_capacity: "default",
        client_cors_origins: "default",
        agent_tools_enabled: "default",
        agent_tools_max_iterations: "default",
        agent_tools_tool_timeout_seconds: "default",
        agent_tools_answer_verification_mode: "default",
        agent_tools_answer_verification_max_retries: "default",
        agent_tools_safe_roots: "default",
        context_summarization_enabled: "default",
        context_summarization_trigger_ratio: "default",
        context_summarization_target_ratio: "default",
        context_summarization_recent_messages: "default",
        context_summarization_max_tokens: "default",
        thread_history_compaction_enabled: "default",
        thread_history_context_ratio: "default",
        thread_history_min_prompt_tokens: "default",
        thread_history_recent_messages: "default",
        thread_history_summary_max_chars: "default",
        thread_history_summary_item_max_chars: "default",
      },
    }));
    if (url === "/lm-api/v1/settings/disks") return Promise.resolve(okJson([]));
    if (url === "/lm-api/v1/settings/node-auth") return Promise.resolve(okJson([]));
    if (url === "/lm-api/v1/settings/tool-catalog") return Promise.resolve(okJson({
      enabled: false,
      safe_roots: [],
      tool_count: 0,
      tools: [],
      definitions: {},
      profiles: {},
      active_profile: null,
      sources: {},
    }));
    return Promise.resolve(okJson({}));
  }));
}

it("smoke tests migrated React pages and logs modal", async () => {
  stubReactSmokeFetches();
  localStorage.setItem("lm_ui_token", "admin-token");
  const user = userEvent.setup();

  render(<App />);

  expect(await screen.findByText("Backend online")).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Nodes" }));
  expect(await screen.findByRole("heading", { name: "Nodes" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Chat" }));
  expect(await screen.findByRole("heading", { name: "Chat" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Models" }));
  expect(await screen.findByRole("heading", { name: "GGUF Library" })).toBeInTheDocument();
  const modelNav = screen.getByRole("navigation", { name: "Library navigation" });
  await user.click(within(modelNav).getByRole("link", { name: "Library" }));
  expect(await screen.findByRole("heading", { name: "GGUF Library" })).toBeInTheDocument();
  await user.click(within(screen.getByRole("navigation", { name: "Library navigation" })).getByRole("link", { name: "Acquire" }));
  expect(await screen.findByRole("heading", { name: "HF Downloads" })).toBeInTheDocument();
  await user.click(within(screen.getByRole("navigation", { name: "Acquire navigation" })).getByRole("link", { name: "Quantize" }));
  expect(await screen.findByRole("heading", { name: "Quantization" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Audit" }));
  expect(await screen.findByRole("heading", { name: "Audit" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Overview" }));
  expect(await screen.findByRole("heading", { name: "Runtime Overview" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Preview Route" }));
  expect((await screen.findAllByText("mac / qwen")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("coding")).length).toBeGreaterThan(1);
  await user.click(screen.getByRole("link", { name: "Settings"}));
  await user.click(screen.getByRole("button", { name: "Logs" }));
  expect(screen.getByRole("dialog", { name: "Recent Logs" })).toBeInTheDocument();
});

it("shows the login screen when auth is enabled and protected requests return unauthorized", async () => {
  window.history.pushState({}, "", "/ui/");
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/setup/status") {
      return Promise.resolve(okJson({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }));
    }
    if (url === "/lm-api/v1/health") {
      return Promise.resolve(okJson({ mode: "controller", configured_models: 1, system: { cpu_percent: 10 } }));
    }
    return Promise.resolve(unauthorizedJson({ detail: "Unauthorized" }));
  }));

  render(<App />);

  await waitFor(() => {
    expect(screen.getByPlaceholderText("username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("api key")).toBeInTheDocument();
  });
});
