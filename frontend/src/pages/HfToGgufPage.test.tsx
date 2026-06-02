import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { HfToGgufPage } from "./HfToGgufPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

it("renders convertible HF models", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { name: "Qwen", convertible: true, running: false, gguf_files: ["qwen.gguf"], path: "/hf/Qwen", output_path: "/gguf/Qwen", python_bin: "/venv/bin/python" },
  ])));

  render(<HfToGgufPage />);

  expect(await screen.findByText("Qwen")).toBeInTheDocument();
  expect(screen.getByText("ready")).toBeInTheDocument();
  expect(screen.getByText("1 file")).toBeInTheDocument();
  expect(screen.getByText("/hf/Qwen")).toBeInTheDocument();
});

it("starts conversion for a ready model", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ name: "Qwen", convertible: true, running: false, gguf_files: [] }]))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson([{ name: "Qwen", convertible: true, running: true, pid: 42 }]))
  );
  const user = userEvent.setup();

  render(<HfToGgufPage />);
  await user.click(await screen.findByRole("button", { name: "Convert Qwen" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/conversions/Qwen/start", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText("running pid 42")).toBeInTheDocument();
});

it("disables conversion for non-convertible models", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([{ name: "Broken", convertible: false, running: false }])));

  render(<HfToGgufPage />);

  expect(await screen.findByRole("button", { name: "Convert Broken" })).toBeDisabled();
  expect(screen.getByText("not convertible")).toBeInTheDocument();
});
