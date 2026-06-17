import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPage } from "../../pages/SettingsPage";
import { AuthSessionProvider, AUTH_TOKEN_STORAGE_KEY } from "../../features/auth/authSession";

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

function renderWithAuth(token = "admin-token") {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  return render(<AuthSessionProvider><SettingsPage /></AuthSessionProvider>);
}

function settingsRoutes(extra: Record<string, () => ReturnType<typeof okJson>> = {}) {
  return {
    "/lm-api/v1/settings/runtime": () => okJson({
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
        agent_tools_safe_roots: [],
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
        agent_tools_safe_roots: "default",
      },
    }),
    "/lm-api/v1/settings/disks": () => okJson([]),
    "/lm-api/v1/settings/node-auth": () => okJson([]),
    ...extra,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("generates config and env exports from settings fields", async () => {
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    settingsRoutes(),
  );
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  expect(screen.getByRole("heading", { name: "System Settings" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Config Tools" }));
  expect(screen.getByText(/Config Helper generates setup files/)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Mode"), "agent");
  await user.clear(screen.getByLabelText("Controller URL"));
  await user.type(screen.getByLabelText("Controller URL"), "http://controller:9137");
  await user.clear(screen.getByLabelText("Registration Key (Agent)"));
  await user.type(screen.getByLabelText("Registration Key (Agent)"), "reg-key");
  await user.click(screen.getByRole("button", { name: "Update Preview" }));

  expect(screen.getByText(/mode: agent/)).toBeInTheDocument();
  expect(screen.getByText(/controller_url: "http:\/\/controller:9137"/)).toBeInTheDocument();
  expect(screen.getByText(/LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND='reg-key'/)).toBeInTheDocument();
});

it("copies and downloads generated config utilities", async () => {
  const createObjectURL = vi.fn(() => "blob:settings");
  const revokeObjectURL = vi.fn();
  const click = vi.fn();
  const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tagName: string, options?: ElementCreationOptions) => (
    tagName === "a" ? anchor : createElement(tagName, options)
  ));
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    settingsRoutes(),
  );
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Config Tools" }));
  await user.click(screen.getByRole("button", { name: "Copy Config YAML" }));
  expect(await screen.findByText("Config YAML copied")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Download config.yaml" }));
  expect(anchor.download).toBe("config.yaml");
  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Copy Env Exports" }));
  expect(await screen.findByText("Env exports copied")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Download env.sh" }));
  expect(anchor.download).toBe("llama-pack.env.sh");
});

it("generates helper keys and applies the first generated key", async () => {
  mockFetch([
    () => okJson({ username: "admin", role: "admin", created_at: "now" }),
    () => okJson({ keys: ["llm_generated"], count: 1 }),
  ], settingsRoutes());
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Access" }));
  await user.click(screen.getByRole("button", { name: "Generate with Script" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/settings/api-keys/generate", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText(/llm_generated/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Apply First Key" }));
  await user.click(screen.getByRole("button", { name: "Config Tools" }));
  expect(screen.getByLabelText("Controller API Key (Optional)")).toHaveValue("llm_generated");
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
  await user.click(screen.getByRole("button", { name: "Access" }));
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

it("renders effective node auth diagnostics in settings", async () => {
  mockFetch(
    [() => okJson({ username: "admin", role: "admin", created_at: "now" })],
    {
      ...settingsRoutes({
        "/lm-api/v1/settings/disks": () => okJson([]),
        "/lm-api/v1/settings/node-auth": () => okJson([
        {
          node_name: "pi",
          effective_url: "https://pi-override.local",
          effective_api_key_source: "config",
          effective_api_key_present: true,
          configured_api_key_present: true,
          override_api_key_present: false,
          override_present: true,
          verify_tls: false,
        },
        {
          node_name: "mac",
          effective_url: "https://mac.local",
          effective_api_key_source: "missing",
          effective_api_key_present: false,
          configured_api_key_present: false,
          override_api_key_present: false,
          override_present: false,
          verify_tls: true,
        },
        ]),
      }),
    },
  );
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Config Tools" }));

  expect(await screen.findByText("Node Auth Diagnostics")).toBeInTheDocument();
  expect(screen.getByText("pi")).toBeInTheDocument();
  expect(screen.getByText("https://pi-override.local")).toBeInTheDocument();
  expect(screen.getByText("config")).toBeInTheDocument();
  expect(screen.getByText("missing")).toBeInTheDocument();
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
          agent_tools_safe_roots: [],
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
          agent_tools_safe_roots: "default",
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
          agent_tools_safe_roots: [],
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
          agent_tools_safe_roots: "default",
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
          agent_tools_safe_roots: [],
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
          agent_tools_safe_roots: "default",
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
  await user.click(screen.getByRole("button", { name: "Save Runtime Settings" }));

  await waitFor(() => expect(savedPayloads).toContainEqual(expect.objectContaining({ routing_fanout_max: 6 })));
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
          agent_tools_safe_roots: ["/tmp/tools", "/var/log"],
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
          agent_tools_safe_roots: "database",
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
          agent_tools_safe_roots: ["/tmp/tools"],
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
          agent_tools_safe_roots: "config",
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
  await user.clear(screen.getByLabelText("Agent Tools Safe Roots"));
  await user.type(screen.getByLabelText("Agent Tools Safe Roots"), "/tmp/tools\n/var/log");
  await user.click(screen.getByRole("button", { name: "Save Chat Tools" }));

  await waitFor(() => expect(savedPayloads).toContainEqual(expect.objectContaining({
    agent_tools_enabled: true,
    agent_tools_max_iterations: 9,
    agent_tools_tool_timeout_seconds: 18,
    agent_tools_safe_roots: ["/tmp/tools", "/var/log"],
  })));
  expect(await screen.findByText("Chat tool settings saved")).toBeInTheDocument();
});
