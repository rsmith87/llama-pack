import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BenchmarksPage } from "./BenchmarksPage";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

afterEach(() => {
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("prefills model, target, and managed load node from benchmark handoff query params", async () => {
  window.history.pushState({}, "", "/ui/benchmarks?model=qwen&target=node%3Amac&target_node=mac&source=dashboard");
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/benchmarks/definitions") {
      return Promise.resolve(okJson({ definitions: [{ id: "def-1", name: "Smoke", description: "", prompt_text: "Hello", sample_count: 1, max_tokens: 16, tags: [] }] }));
    }
    if (url === "/lm-api/v1/nodes/models") {
      return Promise.resolve(okJson({ nodes: [{ name: "mac", reachable: true, models: [{ name: "qwen" }, { name: "gemma" }] }] }));
    }
    if (url === "/lm-api/v1/benchmarks/runs?definition_id=def-1&limit=100") {
      return Promise.resolve(okJson({ runs: [] }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<BenchmarksPage />);

  const qwenLabel = (await screen.findByText("qwen")).closest("label");
  const qwen = qwenLabel?.querySelector("input[type='checkbox']");
  expect(qwen).toBeTruthy();
  expect(qwen as HTMLInputElement).toBeChecked();
  expect(screen.getByLabelText("Load model on a node before running")).toBeChecked();
  expect(within(screen.getByLabelText("Target node")).getByRole("option", { name: "mac" })).toBeInTheDocument();
  expect(screen.getByLabelText("Target node")).toHaveValue("mac");
  await waitFor(() => expect(screen.getByRole("button", { name: "Run Benchmark" })).toBeEnabled());
});
