import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { AuthSessionProvider, AUTH_TOKEN_STORAGE_KEY } from "../features/auth/authSession";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function renderWithAuth(token = "admin-token") {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  return render(<AuthSessionProvider><SettingsPage /></AuthSessionProvider>);
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("generates config and env exports from settings fields", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJson({ username: "admin", role: "admin", created_at: "now" })));
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  expect(screen.getByRole("heading", { name: "System Settings" })).toBeInTheDocument();
  expect(screen.getByText(/Config Helper generates setup files/)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Mode"), "agent");
  await user.clear(screen.getByLabelText("Controller URL"));
  await user.type(screen.getByLabelText("Controller URL"), "http://controller:9137");
  await user.clear(screen.getByLabelText("Registration Key (Agent)"));
  await user.type(screen.getByLabelText("Registration Key (Agent)"), "reg-key");
  await user.click(screen.getByRole("button", { name: "Update Preview" }));

  expect(screen.getByText(/mode: agent/)).toBeInTheDocument();
  expect(screen.getByText(/controller_url: "http:\/\/controller:9137"/)).toBeInTheDocument();
  expect(screen.getByText(/LLAMA_MANAGER_CONTROLLER_REGISTRATION_KEY_OUTBOUND='reg-key'/)).toBeInTheDocument();
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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJson({ username: "admin", role: "admin", created_at: "now" })));
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Copy Config YAML" }));
  expect(await screen.findByText("Config YAML copied")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Download config.yaml" }));
  expect(anchor.download).toBe("config.yaml");
  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Copy Env Exports" }));
  expect(await screen.findByText("Env exports copied")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Download env.sh" }));
  expect(anchor.download).toBe("llama-manager.env.sh");
});

it("generates helper keys and applies the first generated key", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(okJson({ username: "admin", role: "admin", created_at: "now" }))
    .mockResolvedValueOnce(okJson({ keys: ["llm_generated"], count: 1 })));
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Admin Keys" }));
  await user.click(screen.getByRole("button", { name: "Generate with Script" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/settings/api-keys/generate", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText(/llm_generated/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Apply First Key" }));
  await user.click(screen.getByRole("button", { name: "Config Helper" }));
  expect(screen.getByLabelText("Controller API Key (Optional)")).toHaveValue("llm_generated");
});

it("creates and revokes admin auth keys", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(okJson({ username: "admin", role: "admin", created_at: "now" }))
    .mockResolvedValueOnce(okJson([]))
    .mockResolvedValueOnce(okJson({ id: "key-1", username: "service", role: "operator", key: "llm_secret" }))
    .mockResolvedValueOnce(okJson([{ id: "key-1", username: "service", role: "operator", key_hint: "llm_...", revoked: false, created_at: "now" }]))
    .mockResolvedValueOnce(okJson({ ok: true }))
    .mockResolvedValueOnce(okJson([{ id: "key-1", username: "service", role: "operator", key_hint: "llm_...", revoked: true, created_at: "now" }])));
  const user = userEvent.setup();

  renderWithAuth();
  await screen.findByText("admin (admin)");
  await user.click(screen.getByRole("button", { name: "Admin Keys" }));
  await user.click(screen.getByRole("button", { name: "Refresh Auth Keys" }));
  await user.type(screen.getByLabelText("Key username"), "service");
  await user.click(screen.getByRole("button", { name: "Create Auth Key" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/auth/keys", expect.objectContaining({ method: "POST", body: JSON.stringify({ username: "service", role: "operator" }) })));
  expect(await screen.findByText(/llm_secret/)).toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Revoke key-1" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/auth/keys/key-1/revoke", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText("true")).toBeInTheDocument();
});
