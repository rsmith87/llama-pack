import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AuditPage } from "../AuditPage";
import { AuthSessionProvider, AUTH_TOKEN_STORAGE_KEY } from "../../features/auth/authSession";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function renderWithAuth() {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "admin-token");
  return render(<AuthSessionProvider><AuditPage /></AuthSessionProvider>);
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("loads filtered audit events and shows event detail", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/auth/me") return Promise.resolve(okJson({ username: "alice", role: "admin", created_at: "now" }));
    if (url.includes("event_type=model_start")) return Promise.resolve(okJson([
      { id: "evt-2", actor: "bob", created_at: "2026-05-20T11:00:00Z", event_type: "model_start", dry_run: true, target: "qwen", route: "model", payload: { dry: true } },
    ]));
    return Promise.resolve(okJson([
      { id: "evt-1", actor: "alice", created_at: "2026-05-20T10:00:00Z", event_type: "auth_login", dry_run: false, target: "alice", route: "auth", payload: { role: "admin" } },
    ]));
  }));
  const user = userEvent.setup();

  renderWithAuth();
  expect(await screen.findByText("auth_login")).toBeInTheDocument();

  await user.clear(screen.getByLabelText("Event type"));
  await user.type(screen.getByLabelText("Event type"), "model_start");
  await user.selectOptions(screen.getByLabelText("Dry run"), "true");
  await user.click(screen.getByRole("button", { name: "Refresh Audit" }));

  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/lm-api/v1/audit/events?limit=200&event_type=model_start&dry_run=true", expect.objectContaining({ method: "GET" })));
  expect(await screen.findByText("model_start")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "View evt-2" }));
  expect(screen.getByText(/"target": "qwen"/)).toBeInTheDocument();
});

it("filters loaded events to the current user", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/auth/me") return Promise.resolve(okJson({ username: "alice", role: "admin", created_at: "now" }));
    return Promise.resolve(okJson([
      { id: "evt-1", actor: "alice", created_at: "now", event_type: "auth_key_create", dry_run: false, target: "alice", route: "auth" },
      { id: "evt-2", actor: "bob", created_at: "now", event_type: "auth_key_revoke", dry_run: false, target: "bob", route: "auth" },
    ]));
  }));
  const user = userEvent.setup();

  renderWithAuth();
  expect(await screen.findByText("auth_key_create")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "My Actions" }));

  expect(screen.getByText("auth_key_create")).toBeInTheDocument();
  expect(screen.queryByText("auth_key_revoke")).not.toBeInTheDocument();
});
