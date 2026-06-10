import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { QuantizationPage } from "../../pages/QuantizationPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

it("renders quantizable GGUF files", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "file-1", model_dir: "Qwen", filename: "qwen-f16.gguf", size_gb: 12, type: "Q4_K_M", quantize_bin: "/bin/llama-quantize", output_path: "/gguf/qwen-Q4.gguf" },
  ])));

  render(<QuantizationPage />);

  expect(await screen.findByText("qwen-f16.gguf")).toBeInTheDocument();
  expect(screen.getByText("12.0 GB")).toBeInTheDocument();
  expect(screen.getByText("ready")).toBeInTheDocument();
});

it("hides already quantized GGUF files by filename suffix", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "file-1", model_dir: "Qwen", filename: "qwen.gguf", size_gb: 12, quantize_bin: "/bin/llama-quantize" },
    { id: "file-2", model_dir: "Qwen", filename: "qwen-Q4_K_M.gguf", size_gb: 4, quantize_bin: "/bin/llama-quantize" },
    { id: "file-3", model_dir: "Qwen", filename: "qwen.IQ2_XS.gguf", size_gb: 2, quantize_bin: "/bin/llama-quantize" },
    { id: "file-4", model_dir: "Qwen", filename: "qwen.Q8_0.gguf", size_gb: 8, quantize_bin: "/bin/llama-quantize" },
  ])));

  render(<QuantizationPage />);

  expect(await screen.findByText("qwen.gguf")).toBeInTheDocument();
  expect(screen.queryByText("qwen-Q4_K_M.gguf")).not.toBeInTheDocument();
  expect(screen.queryByText("qwen.IQ2_XS.gguf")).not.toBeInTheDocument();
  expect(screen.queryByText("qwen.Q8_0.gguf")).not.toBeInTheDocument();
});

it("starts quantization with the selected type", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ id: "file-1", model_dir: "Qwen", filename: "qwen.gguf", supported_types: ["Q4_K_M", "Q5_K_M"], quantize_bin: "/bin/llama-quantize" }]))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson([{ id: "file-1", model_dir: "Qwen", filename: "qwen.gguf", running: true, pid: 77, supported_types: ["Q4_K_M", "Q5_K_M"], quantize_bin: "/bin/llama-quantize" }]))
  );
  const user = userEvent.setup();

  render(<QuantizationPage />);
  await user.selectOptions(await screen.findByLabelText("Quant type for qwen.gguf"), "Q5_K_M");
  await user.click(screen.getByRole("button", { name: "Quantize qwen.gguf" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/quantizations/file-1/start", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ type: "Q5_K_M" }),
  })));
  expect(await screen.findByText("running pid 77")).toBeInTheDocument();
});

it("recommends quantization candidates from local file data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson([
    { id: "file-1", model_dir: "Qwen", filename: "qwen.gguf", size_gb: 12, supported_types: ["Q4_K_M", "Q8_0"], quantize_bin: "/bin/llama-quantize" },
  ])));
  const user = userEvent.setup();

  render(<QuantizationPage />);
  await screen.findByText("qwen.gguf");
  await user.clear(screen.getByLabelText("Target VRAM (GB)"));
  await user.type(screen.getByLabelText("Target VRAM (GB)"), "8");
  await user.click(screen.getByRole("button", { name: "Recommend" }));

  const advisor = screen.getByText(/Memory estimate approximates/);
  expect(advisor).toHaveTextContent("qwen.gguf");
  expect(advisor).toHaveTextContent("Q4_K_M");
});
