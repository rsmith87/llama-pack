import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPage } from "../../pages/SettingsPage";
import { AuthSessionProvider, AUTH_TOKEN_STORAGE_KEY } from "../../features/auth/authSession";
import { AppModeProvider, type AppMode } from "../../features/appMode/appModeContext";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

const SETUP_STATUS_RESPONSE = {
  mode: "controller",
  auth_bootstrap_required: false,
  auth_enabled: false,
  setup_recommended: false,
};

function mockFetch(
  responses: Array<() => ReturnType<typeof okJson>>,
  routeResponses: Record<string, () => ReturnType<typeof okJson>> = {},
) {
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    calls.push({ url, options });
    if (url === "/lm-api/v1/setup/status") {
      return Promise.resolve(okJson(SETUP_STATUS_RESPONSE));
    }
    const routed = routeResponses[url];
    if (routed) {
      return Promise.resolve(routed());
    }
    const next = responses.shift();
    if (next) return Promise.resolve(next());
    return Promise.resolve(okJson({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function renderWithAuth(token = "admin-token", appMode: AppMode = "controller") {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  return render(
    <AppModeProvider appMode={appMode}>
      <AuthSessionProvider><SettingsPage /></AuthSessionProvider>
    </AppModeProvider>,
  );
}

const COMPACTION_SETTINGS = {
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
};

const COMPACTION_SOURCES = {
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
};

function settingsRoutes(extra: Record<string, () => ReturnType<typeof okJson>> = {}) {
  return {
    "/lm-api/v1/settings/runtime": () => okJson({
      settings: {
        hf_models_dirs: ["/models/config"],
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
        ...COMPACTION_SETTINGS,
      },
      sources: {
        hf_models_dirs: "config",
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
        ...COMPACTION_SOURCES,
      },
    }),
    "/lm-api/v1/settings/disks": () => okJson([]),
    "/lm-api/v1/settings/node-auth": () => okJson([]),
    "/lm-api/v1/settings/tool-catalog": () => okJson({
      enabled: false,
      safe_roots: [],
      tool_count: 0,
      tools: [],
      definitions: {},
      profiles: {},
      active_profile: null,
      sources: {},
    }),
    ...extra,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps setup config tools out of settings", async () => {
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    settingsRoutes(),
  );

  renderWithAuth();
  await screen.findByText("admin (admin)");
  expect(screen.getByRole("heading", { name: "System Settings" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Config Tools" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Config Helper generates setup files/)).not.toBeInTheDocument();
});

it("shows local accounts on standalone agents", async () => {
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    settingsRoutes(),
  );
  const user = userEvent.setup();

  renderWithAuth("admin-token", "agent");
  await screen.findByText("admin (admin)");
  expect(screen.getByRole("button", { name: "Agent Runtime" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Chat Tools" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Storage" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Local Accounts" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Runtime Settings" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tool Catalog" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Config Tools" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Agent Runtime" })).toBeInTheDocument();
  expect(screen.getByLabelText("Agent Worker Enabled")).toBeInTheDocument();
  expect(screen.getByLabelText("Agent Worker Poll Interval Seconds")).toBeInTheDocument();
  expect(screen.getByLabelText("Agent Worker Max Jobs")).toBeInTheDocument();
  expect(screen.queryByLabelText("Controller Retention Days")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Routing Fanout Max")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Storage" }));
  expect(await screen.findByText("No configured model disks.")).toBeInTheDocument();
});

it("shows the read-only tool catalog and inspector", async () => {
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    settingsRoutes({
      "/lm-api/v1/settings/tool-catalog": () => okJson({
        enabled: true,
        safe_roots: ["/workspace"],
        tool_count: 2,
        definitions: {
          read_project_file: {
            type: "file_read_dynamic",
            description: "Read a project file.",
            path: "/workspace",
          },
          local_health: {
            type: "http",
            description: "Check local health.",
            method: "GET",
            url: "http://127.0.0.1:9137/health",
          },
        },
        profiles: {
          llama_pack: {
            description: "Llama Pack workspace.",
            safe_roots: ["/workspace"],
            tools: ["read_project_file"],
          },
        },
        active_profile: "llama_pack",
        sources: {
          read_project_file: "database",
          local_health: "config",
        },
        tools: [
          {
            name: "read_project_file",
            type: "file_read_dynamic",
            description: "Read a project file.",
            summary: { path: "/workspace" },
            limits: { max_file_bytes: 524288 },
            parameters: {
              type: "object",
              properties: { path: { type: "string", description: "Relative file path under the configured root." } },
              required: ["path"],
              additionalProperties: false,
            },
            safety: { status: "ok", message: "Path is under safe_roots." },
          },
          {
            name: "local_health",
            type: "http",
            description: "Check local health.",
            summary: { method: "GET", url: "http://127.0.0.1:9137/health" },
            limits: { max_response_bytes: 65536 },
            parameters: { type: "object", properties: {}, additionalProperties: false },
            safety: { status: "not_applicable", message: "No filesystem path safety check required." },
          },
        ],
      }),
    }),
  );
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Tool Catalog" }));

  await waitFor(() => expect(screen.getAllByText("read_project_file").length).toBeGreaterThan(0));
  expect(screen.getAllByText("file_read_dynamic").length).toBeGreaterThan(0);
  expect(screen.getByText("2 configured tools")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Inspect local_health" }));
  expect(screen.getByRole("heading", { name: "local_health" })).toBeInTheDocument();
  expect(screen.getByText("http://127.0.0.1:9137/health")).toBeInTheDocument();
  expect(screen.getByText(/No filesystem path safety check required/)).toBeInTheDocument();
});

it("edits and saves db-backed tool catalog profiles", async () => {
  const savedPayloads: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/settings/tool-catalog" && options?.method === "PATCH") {
      savedPayloads.push(JSON.parse(String(options.body)));
      return Promise.resolve(okJson({
        enabled: true,
        safe_roots: ["/workspace"],
        tool_count: 1,
        definitions: {
          read_project_file: {
            type: "file_read_dynamic",
            description: "Read project file.",
            path: "/workspace",
          },
        },
        profiles: {
          llama_pack: {
            description: "Llama Pack workspace.",
            safe_roots: ["/workspace"],
            tools: ["read_project_file"],
          },
        },
        active_profile: "llama_pack",
        sources: { read_project_file: "database" },
        tools: [
          {
            name: "read_project_file",
            type: "file_read_dynamic",
            description: "Read project file.",
            summary: { path: "/workspace" },
            limits: { max_file_bytes: 524288 },
            parameters: { type: "object", properties: {}, additionalProperties: false },
            safety: { status: "ok", message: "Path is under safe_roots." },
          },
        ],
      }) as Response);
    }
    if (url === "/lm-api/v1/setup/status") return Promise.resolve(okJson(SETUP_STATUS_RESPONSE) as Response);
    if (url === "/lm-api/v1/auth/me") return Promise.resolve(okJson({ username: "admin", role: "admin", created_at: "now" }) as Response);
    if (url === "/lm-api/v1/settings/disks" || url === "/lm-api/v1/settings/node-auth") return Promise.resolve(okJson([]) as Response);
    if (url === "/lm-api/v1/settings/runtime") return Promise.resolve(settingsRoutes()["/lm-api/v1/settings/runtime"]() as Response);
    if (url === "/lm-api/v1/settings/tool-catalog") {
      return Promise.resolve(okJson({
        enabled: true,
        safe_roots: [],
        tool_count: 0,
        tools: [],
        definitions: {},
        profiles: {},
        active_profile: null,
        sources: {},
      }) as Response);
    }
    return Promise.resolve(okJson({}) as Response);
  }));
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Tool Catalog" }));
  fireEvent.change(screen.getByLabelText("Tool Definitions JSON"), { target: { value: JSON.stringify({
    read_project_file: {
      type: "file_read_dynamic",
      description: "Read project file.",
      path: "/workspace",
    },
  }) } });
  fireEvent.change(screen.getByLabelText("Tool Profiles JSON"), { target: { value: JSON.stringify({
    llama_pack: {
      description: "Llama Pack workspace.",
      safe_roots: ["/workspace"],
      tools: ["read_project_file"],
    },
  }) } });
  await user.clear(screen.getByLabelText("Active Tool Profile"));
  await user.type(screen.getByLabelText("Active Tool Profile"), "llama_pack");
  await user.click(screen.getByRole("button", { name: "Save Tool Catalog" }));

  await waitFor(() => expect(savedPayloads).toContainEqual(expect.objectContaining({
    active_profile: "llama_pack",
    tools: expect.objectContaining({ read_project_file: expect.objectContaining({ type: "file_read_dynamic" }) }),
  })));
  expect(await screen.findByText("Tool catalog saved")).toBeInTheDocument();
  expect(screen.getByText("1 configured tools")).toBeInTheDocument();
});

it("creates and revokes admin auth keys", async () => {
  mockFetch([
    () => okJson({ username: "admin", role: "admin", created_at: "now" }),
    () => okJson([]),
    () => okJson({ id: "key-1", username: "service", role: "operator", key: "llm_secret" }),
    () => okJson([{ id: "key-1", username: "service", role: "operator", key_hint: "llm_...", revoked: false, created_at: "now" }]),
    () => okJson({ ok: true }),
    () => okJson([{ id: "key-1", username: "service", role: "operator", key_hint: "llm_...", revoked: true, created_at: "now" }]),
  ], settingsRoutes());
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Local Accounts" }));
  await user.click(screen.getByRole("button", { name: "Refresh Auth Keys" }));
  await user.type(screen.getByLabelText("Key username"), "service");
  await user.click(screen.getByRole("button", { name: "Create Auth Key" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/auth/keys", expect.objectContaining({ method: "POST", body: JSON.stringify({ username: "service", role: "operator" }) })));
  expect(await screen.findByText(/llm_secret/)).toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Revoke key-1" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/auth/keys/key-1/revoke", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText("true")).toBeInTheDocument();
});

it("renders configured model disks in settings", async () => {
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    settingsRoutes({ "/lm-api/v1/settings/disks": () => okJson([
      {
        node_name: "agent-a",
        path: "/models/fast",
        reachable: true,
        total_bytes: 1000,
        free_bytes: 250,
        used_bytes: 750,
        consumed_bytes: 500,
        available_percent: 25,
        used_percent: 75,
        status: "warning",
        warning: "Low space: less than 10 GB free headroom for model downloads.",
        error: null,
        headroom_bytes: 10737418240,
        required_free_bytes: 10737418240,
      },
      {
        node_name: "agent-b",
        path: "/models/slow",
        reachable: true,
        total_bytes: 2000,
        free_bytes: 1500,
        used_bytes: 500,
        consumed_bytes: 200,
        available_percent: 75,
        used_percent: 25,
        status: "warning",
        warning: "Low space: less than 10 GB free headroom for model downloads.",
        error: null,
        headroom_bytes: 10737418240,
        required_free_bytes: 10737418240,
      },
      {
        node_name: "agent-c",
        path: "",
        reachable: false,
        total_bytes: 0,
        free_bytes: 0,
        used_bytes: 0,
        consumed_bytes: 0,
        available_percent: 0,
        used_percent: 0,
        status: "error",
        warning: null,
        error: "agent offline",
        headroom_bytes: 10737418240,
        required_free_bytes: 10737418240,
      },
    ]) }),
  );
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Storage" }));

  expect(await screen.findByText("agent-a")).toBeInTheDocument();
  expect(screen.getByText("agent-b")).toBeInTheDocument();
  expect(screen.getByText("agent-c")).toBeInTheDocument();
  expect(await screen.findByText("/models/fast")).toBeInTheDocument();
  expect(screen.getByText("/models/slow")).toBeInTheDocument();
  expect(screen.getByText("agent offline")).toBeInTheDocument();
  expect(screen.getByText("25.0%")).toBeInTheDocument();
  expect(screen.getByText("75.0%")).toBeInTheDocument();
  expect(screen.getAllByText("500 B")).toHaveLength(2);
  expect(screen.getAllByText("low space")).toHaveLength(2);
  expect(screen.getByText("error")).toBeInTheDocument();
  expect(screen.getAllByText("Low space: less than 10 GB free headroom for model downloads.")).toHaveLength(2);
});

it("edits and saves db-backed model roots from storage", async () => {
  const savedPayloads: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/settings/runtime" && options?.method === "PATCH") {
      savedPayloads.push(JSON.parse(String(options.body)));
      return Promise.resolve(okJson({
        settings: {
          hf_models_dirs: ["/models/config", "/models/second"],
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
          ...COMPACTION_SETTINGS,
        },
        sources: {
          hf_models_dirs: "database",
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
          ...COMPACTION_SOURCES,
        },
      }) as Response);
    }
    if (url === "/lm-api/v1/setup/status") return Promise.resolve(okJson(SETUP_STATUS_RESPONSE) as Response);
    if (url === "/lm-api/v1/auth/me") return Promise.resolve(okJson({ username: "admin", role: "admin", created_at: "now" }) as Response);
    if (url === "/lm-api/v1/settings/disks" || url === "/lm-api/v1/settings/node-auth") return Promise.resolve(okJson([]) as Response);
    if (url === "/lm-api/v1/settings/runtime") {
      return Promise.resolve(okJson({
        settings: {
          hf_models_dirs: ["/models/config"],
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
          ...COMPACTION_SETTINGS,
        },
        sources: {
          hf_models_dirs: "config",
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
          ...COMPACTION_SOURCES,
        },
      }) as Response);
    }
    return Promise.resolve(okJson({}) as Response);
  }));
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Storage" }));
  expect(await screen.findByLabelText("Model Root 1")).toHaveValue("/models/config");
  await user.click(screen.getByRole("button", { name: "Add Model Root" }));
  await user.type(screen.getByLabelText("Model Root 2"), "/models/second");
  await user.click(screen.getByRole("button", { name: "Save Model Roots" }));

  await waitFor(() => expect(savedPayloads).toContainEqual({
    hf_models_dirs: ["/models/config", "/models/second"],
  }));
  expect(await screen.findByText("Model roots saved")).toBeInTheDocument();
});

it("edits and saves db-backed runtime settings", async () => {
  const savedPayloads: unknown[] = [];
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    settingsRoutes({
      "/lm-api/v1/settings/runtime": () => okJson({
        settings: {
          controller_retention_days: 45,
          controller_archive_retention_days: 120,
          controller_archive_dir: "logs/archive",
          routing_fanout_enabled: true,
          routing_fanout_max: 3,
          agent_worker_enabled: false,
          agent_worker_poll_interval_seconds: 4,
          agent_worker_max_jobs: 2,
          agent_worker_labels: { gpu: "metal" },
          agent_worker_capacity: { vram_gb: 48 },
          client_cors_origins: ["http://localhost:5173"],
          agent_tools_enabled: false,
          agent_tools_max_iterations: 4,
          agent_tools_tool_timeout_seconds: 10,
          agent_tools_answer_verification_mode: "warn",
          agent_tools_answer_verification_max_retries: 1,
          agent_tools_safe_roots: [],
          ...COMPACTION_SETTINGS,
        },
        sources: {
          controller_retention_days: "database",
          controller_archive_retention_days: "database",
          controller_archive_dir: "default",
          routing_fanout_enabled: "database",
          routing_fanout_max: "database",
          agent_worker_enabled: "default",
          agent_worker_poll_interval_seconds: "database",
          agent_worker_max_jobs: "database",
          agent_worker_labels: "database",
          agent_worker_capacity: "database",
          client_cors_origins: "database",
          agent_tools_enabled: "default",
          agent_tools_max_iterations: "default",
          agent_tools_tool_timeout_seconds: "default",
          agent_tools_answer_verification_mode: "default",
          agent_tools_answer_verification_max_retries: "default",
          agent_tools_safe_roots: "default",
          ...COMPACTION_SOURCES,
        },
      }),
    }),
  );
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/settings/runtime" && options?.method === "PATCH") {
      savedPayloads.push(JSON.parse(String(options.body)));
      return Promise.resolve(okJson({
        settings: {
          controller_retention_days: 45,
          controller_archive_retention_days: 120,
          controller_archive_dir: "logs/archive",
          routing_fanout_enabled: true,
          routing_fanout_max: 6,
          agent_worker_enabled: false,
          agent_worker_poll_interval_seconds: 4,
          agent_worker_max_jobs: 2,
          agent_worker_labels: { gpu: "metal" },
          agent_worker_capacity: { vram_gb: 48 },
          client_cors_origins: ["http://localhost:5173"],
          agent_tools_enabled: false,
          agent_tools_max_iterations: 4,
          agent_tools_tool_timeout_seconds: 10,
          agent_tools_answer_verification_mode: "warn",
          agent_tools_answer_verification_max_retries: 1,
          agent_tools_safe_roots: [],
          ...COMPACTION_SETTINGS,
        },
        sources: {
          controller_retention_days: "database",
          controller_archive_retention_days: "database",
          controller_archive_dir: "default",
          routing_fanout_enabled: "database",
          routing_fanout_max: "database",
          agent_worker_enabled: "default",
          agent_worker_poll_interval_seconds: "database",
          agent_worker_max_jobs: "database",
          agent_worker_labels: "database",
          agent_worker_capacity: "database",
          client_cors_origins: "database",
          agent_tools_enabled: "default",
          agent_tools_max_iterations: "default",
          agent_tools_tool_timeout_seconds: "default",
          agent_tools_answer_verification_mode: "default",
          agent_tools_answer_verification_max_retries: "default",
          agent_tools_safe_roots: "default",
          ...COMPACTION_SOURCES,
        },
      }) as Response);
    }
    if (url === "/lm-api/v1/setup/status") return Promise.resolve(okJson(SETUP_STATUS_RESPONSE) as Response);
    if (url === "/lm-api/v1/auth/me") return Promise.resolve(okJson({ username: "admin", role: "admin", created_at: "now" }) as Response);
    if (url === "/lm-api/v1/settings/disks" || url === "/lm-api/v1/settings/node-auth") return Promise.resolve(okJson([]) as Response);
    if (url === "/lm-api/v1/settings/runtime") {
      return Promise.resolve(okJson({
        settings: {
          controller_retention_days: 45,
          controller_archive_retention_days: 120,
          controller_archive_dir: "logs/archive",
          routing_fanout_enabled: true,
          routing_fanout_max: 3,
          agent_worker_enabled: false,
          agent_worker_poll_interval_seconds: 4,
          agent_worker_max_jobs: 2,
          agent_worker_labels: { gpu: "metal" },
          agent_worker_capacity: { vram_gb: 48 },
          client_cors_origins: ["http://localhost:5173"],
          agent_tools_enabled: false,
          agent_tools_max_iterations: 4,
          agent_tools_tool_timeout_seconds: 10,
          agent_tools_answer_verification_mode: "warn",
          agent_tools_answer_verification_max_retries: 1,
          agent_tools_safe_roots: [],
          ...COMPACTION_SETTINGS,
        },
        sources: {
          controller_retention_days: "database",
          controller_archive_retention_days: "database",
          controller_archive_dir: "default",
          routing_fanout_enabled: "database",
          routing_fanout_max: "database",
          agent_worker_enabled: "default",
          agent_worker_poll_interval_seconds: "database",
          agent_worker_max_jobs: "database",
          agent_worker_labels: "database",
          agent_worker_capacity: "database",
          client_cors_origins: "database",
          agent_tools_enabled: "default",
          agent_tools_max_iterations: "default",
          agent_tools_tool_timeout_seconds: "default",
          agent_tools_answer_verification_mode: "default",
          agent_tools_answer_verification_max_retries: "default",
          agent_tools_safe_roots: "default",
          ...COMPACTION_SOURCES,
        },
      }) as Response);
    }
    return Promise.resolve(okJson({}) as Response);
  });
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  expect(await screen.findByRole("heading", { name: "Runtime Settings" })).toBeInTheDocument();
  expect(screen.getAllByText("database").length).toBeGreaterThan(0);
  await user.clear(screen.getByLabelText("Routing Fanout Max"));
  await user.type(screen.getByLabelText("Routing Fanout Max"), "6");
  await user.click(screen.getByLabelText("Context Summarization Enabled"));
  await user.clear(screen.getByLabelText("Context Summarization Trigger Ratio"));
  await user.type(screen.getByLabelText("Context Summarization Trigger Ratio"), "0.8");
  await user.click(screen.getByLabelText("Thread History Compaction Enabled"));
  await user.clear(screen.getByLabelText("Thread History Min Prompt Tokens"));
  await user.type(screen.getByLabelText("Thread History Min Prompt Tokens"), "5000");
  await user.click(screen.getByRole("button", { name: "Save Runtime Settings" }));

  await waitFor(() => expect(savedPayloads).toContainEqual(expect.objectContaining({
    routing_fanout_max: 26,
    context_summarization_enabled: false,
    context_summarization_trigger_ratio: 0.8,
    thread_history_compaction_enabled: false,
    thread_history_min_prompt_tokens: 5000,
  })));
  expect(await screen.findByText("Runtime settings saved")).toBeInTheDocument();
});

it("edits and saves chat tool settings", async () => {
  const savedPayloads: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/lm-api/v1/settings/runtime" && options?.method === "PATCH") {
      savedPayloads.push(JSON.parse(String(options.body)));
      return Promise.resolve(okJson({
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
          agent_tools_enabled: true,
          agent_tools_max_iterations: 9,
          agent_tools_tool_timeout_seconds: 18,
          agent_tools_answer_verification_mode: "strict",
          agent_tools_answer_verification_max_retries: 2,
          agent_tools_safe_roots: ["/tmp/tools", "/var/log"],
          ...COMPACTION_SETTINGS,
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
          agent_tools_enabled: "database",
          agent_tools_max_iterations: "database",
          agent_tools_tool_timeout_seconds: "database",
          agent_tools_answer_verification_mode: "database",
          agent_tools_answer_verification_max_retries: "database",
          agent_tools_safe_roots: "database",
          ...COMPACTION_SOURCES,
        },
      }) as Response);
    }
    if (url === "/lm-api/v1/setup/status") return Promise.resolve(okJson(SETUP_STATUS_RESPONSE) as Response);
    if (url === "/lm-api/v1/auth/me") return Promise.resolve(okJson({ username: "admin", role: "admin", created_at: "now" }) as Response);
    if (url === "/lm-api/v1/settings/disks" || url === "/lm-api/v1/settings/node-auth") return Promise.resolve(okJson([]) as Response);
    if (url === "/lm-api/v1/settings/runtime") {
      return Promise.resolve(okJson({
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
          agent_tools_safe_roots: ["/tmp/tools"],
          ...COMPACTION_SETTINGS,
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
          agent_tools_enabled: "config",
          agent_tools_max_iterations: "config",
          agent_tools_tool_timeout_seconds: "config",
          agent_tools_answer_verification_mode: "config",
          agent_tools_answer_verification_max_retries: "config",
          agent_tools_safe_roots: "config",
          ...COMPACTION_SOURCES,
        },
      }) as Response);
    }
    return Promise.resolve(okJson({}) as Response);
  }));
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Chat Tools" }));
  expect(await screen.findByRole("heading", { name: "Chat Tools" })).toBeInTheDocument();
  await user.click(screen.getByLabelText("Agent Tools Enabled"));
  await user.clear(screen.getByLabelText("Agent Tools Max Iterations"));
  await user.type(screen.getByLabelText("Agent Tools Max Iterations"), "9");
  await user.clear(screen.getByLabelText("Agent Tools Timeout Seconds"));
  await user.type(screen.getByLabelText("Agent Tools Timeout Seconds"), "18");
  await user.selectOptions(screen.getByLabelText("Answer Verification Mode"), "strict");
  await user.clear(screen.getByLabelText("Answer Verification Max Retries"));
  await user.type(screen.getByLabelText("Answer Verification Max Retries"), "2");
  await user.clear(screen.getByLabelText("Agent Tools Safe Roots"));
  await user.type(screen.getByLabelText("Agent Tools Safe Roots"), "/tmp/tools\n/var/log");
  await user.click(screen.getByRole("button", { name: "Save Chat Tools" }));

  await waitFor(() => expect(savedPayloads).toContainEqual(expect.objectContaining({
    agent_tools_enabled: true,
    agent_tools_max_iterations: 9,
    agent_tools_tool_timeout_seconds: 18,
    agent_tools_answer_verification_mode: "strict",
    agent_tools_answer_verification_max_retries: 2,
    agent_tools_safe_roots: ["/tmp/tools", "/var/log"],
  })));
  expect(await screen.findByText("Chat tool settings saved")).toBeInTheDocument();
});
