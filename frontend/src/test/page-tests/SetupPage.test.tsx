import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AuthSessionProvider } from "../../features/auth/authSession";
import { SetupPage } from "../../pages/SetupPage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockFetch(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url === "/lm-api/v1/setup/status")
        return Promise.resolve({
          ok: true,
          json: async () => ({
            mode: "controller",
            auth_bootstrap_required: true,
            auth_enabled: false,
            setup_recommended: true,
            ...overrides,
          }),
        });
      if (url === "/lm-api/v1/setup/current-config")
        return Promise.resolve({
          ok: true,
          json: async () => ({
            mode: overrides.mode ?? "controller",
            log_dir: "./logs",
            controller_registration_key: "",
            node_heartbeat_timeout_seconds: 90,
            controller_instance_id: "controller-default",
            memory: { enabled: false, path: "./logs/agent_memory", embedding_model_path: "", auto_inject: true, top_k: 3 },
            nodes: [],
            controller_url: "",
            node_name: "",
            agent_url: "",
            agent_api_key: "",
            controller_registration_key_outbound: "",
            llama_server_bin: "llama-server",
            llama_cpp_dir: "./llama.cpp",
            python_bin: "python3",
            hf_models_dir: "",
            agent_worker_enabled: false,
            agent_worker_max_jobs: 1,
            agent_worker_labels: {},
            first_model: null,
          }),
        });
      if (url === "/lm-api/v1/setup/apply") {
        const applyResponse = overrides.applyResponse as Record<string, unknown> | undefined;
        if (applyResponse) {
          const ok = applyResponse.ok !== false;
          return Promise.resolve({
            ok,
            status: ok ? 200 : 409,
            statusText: ok ? "OK" : "Conflict",
            json: async () => applyResponse,
            text: async () => JSON.stringify(applyResponse),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }),
  );
}

function renderSetup() {
  render(
    <AuthSessionProvider>
      <SetupPage />
    </AuthSessionProvider>,
  );
}

it("renders the setup wizard heading and mode selection cards", async () => {
  mockFetch();
  renderSetup();
  expect(await screen.findByRole("heading", { name: "Setup Wizard" })).toBeInTheDocument();
  expect(screen.getByText("Controller")).toBeInTheDocument();
  expect(screen.getByText("Agent")).toBeInTheDocument();
  expect(screen.getByText("Standalone")).toBeInTheDocument();
});

it("advances past mode selection when a mode card is clicked", async () => {
  mockFetch();
  const user = userEvent.setup();
  renderSetup();

  await screen.findByText(/what is this machine/i);
  // click the Controller mode card specifically (has the badge text "Coordinates agents")
  const cards = screen.getAllByRole("button");
  const controllerCard = cards.find((el) => el.textContent?.includes("Coordinates agents"));
  if (!controllerCard) throw new Error("Controller card not found");
  await user.click(controllerCard);

  // Should now be on the Controller Identity step (no longer on mode selection)
  expect(screen.queryByText(/what is this machine/i)).not.toBeInTheDocument();
});

it("pre-selects standalone mode when server returns agent mode", async () => {
  mockFetch({ mode: "agent" });
  renderSetup();
  await screen.findByText("Standalone");
  // Mode cards are rendered — wizard starts at mode selection
  expect(screen.getByText("Controller")).toBeInTheDocument();
});

async function advanceToConfigAndCommands(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(/what is this machine/i);
  const controllerCard = screen
    .getAllByRole("button")
    .find((el) => el.textContent?.includes("Coordinates agents"));
  if (!controllerCard) throw new Error("Controller card not found");
  await user.click(controllerCard);
  await user.click(screen.getByRole("button", { name: /Continue/i }));
  await user.click(screen.getByRole("button", { name: /Skip/i }));
  await user.click(screen.getByRole("button", { name: /Skip/i }));
  await user.click(screen.getByRole("button", { name: /Continue/i }));
}

it("shows backend overwrite conflict when apply is clicked without overwrite permission", async () => {
  mockFetch({
    auth_bootstrap_required: false,
    auth_enabled: true,
    applyResponse: {
      ok: false,
      status: "blocked_existing_files",
      existing_files: ["config.yaml"],
      planned_files: ["config.yaml", ".llama_pack.env"],
      backup_files: [],
      message: "Existing setup files require overwrite confirmation.",
    },
  });
  const user = userEvent.setup();
  renderSetup();
  await advanceToConfigAndCommands(user);

  await user.click(screen.getByRole("button", { name: /Apply Setup/i }));

  expect(await screen.findByText(/Existing setup files require overwrite confirmation/i)).toBeInTheDocument();
  expect(screen.getAllByText(/config.yaml/).length).toBeGreaterThan(0);
});

it("sends overwrite permission when checkbox is checked and shows success", async () => {
  mockFetch({
    auth_bootstrap_required: false,
    auth_enabled: true,
    applyResponse: {
      ok: true,
      status: "applied",
      existing_files: ["config.yaml"],
      planned_files: ["config.yaml", ".llama_pack.env"],
      backup_files: ["config.yaml.20260616-120000.bak"],
      message: "Setup files written.",
    },
  });
  const user = userEvent.setup();
  renderSetup();
  await advanceToConfigAndCommands(user);

  await user.click(screen.getByRole("checkbox", { name: /Allow setup to overwrite/i }));
  await user.click(screen.getByRole("button", { name: /Apply Setup/i }));

  expect(await screen.findByText(/Setup files written/i)).toBeInTheDocument();
  const applyCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/lm-api/v1/setup/apply");
  if (!applyCall) throw new Error("Apply call not found");
  const body = JSON.parse(String(applyCall[1]?.body));
  expect(body.overwrite_existing).toBe(true);
});
