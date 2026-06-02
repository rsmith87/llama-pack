import { render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders the React operations shell", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/lm-api/v1/setup/status") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller", auth_bootstrap_required: false, auth_enabled: true, setup_recommended: false }) });
      if (url === "/lm-api/v1/health") return Promise.resolve({ ok: true, json: async () => ({ mode: "controller" }) });
      if (url === "/lm-api/v1/models") return Promise.resolve({ ok: true, json: async () => ({ models: [] }) });
      if (url === "/lm-api/v1/nodes/models") return Promise.resolve({ ok: true, json: async () => ({ nodes: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }),
  );

  render(<App />);

  expect(screen.getByRole("heading", { name: "Llama Manager" })).toBeInTheDocument();
  expect(await screen.findByText("controller")).toBeInTheDocument();
});
