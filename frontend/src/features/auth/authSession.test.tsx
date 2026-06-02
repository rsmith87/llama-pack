import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { apiGet } from "../../api/client";
import { AuthLoginForm, AuthSessionProvider, useAuthSession } from "./authSession";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Probe() {
  const session = useAuthSession();
  return <span>{session.isAuthenticated ? `${session.authUser}:${session.authRole}` : "anonymous"}</span>;
}

it("reads persisted token and configures API requests", async () => {
  localStorage.setItem("lm_ui_token", "persisted");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));

  render(<AuthSessionProvider><Probe /></AuthSessionProvider>);
  await apiGet("/protected");

  expect(screen.getByText(":")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/protected", expect.objectContaining({
    headers: expect.objectContaining({ "X-UI-Session": "persisted" }),
  }));
});

it("logs in and logs out through the form", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "token-1", username: "admin", role: "admin", expires_at: "later" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }),
  );

  render(<AuthSessionProvider><AuthLoginForm /></AuthSessionProvider>);
  await user.type(screen.getByPlaceholderText("username"), "admin");
  await user.type(screen.getByPlaceholderText("api key"), "secret");
  await user.click(screen.getByRole("button", { name: "Login" }));

  await waitFor(() => expect(localStorage.getItem("lm_ui_token")).toBe("token-1"));
  expect(screen.getByText("admin (admin)")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Logout" }));

  await waitFor(() => expect(localStorage.getItem("lm_ui_token")).toBeNull());
});
