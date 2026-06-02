import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EmbeddingsPage } from "./EmbeddingsPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

it("runs batch embeddings from trimmed line items and renders each result", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson({ models: [{ name: "nomic-embed" }, { name: "qwen" }] }))
      .mockResolvedValueOnce(okJson({
        model: "nomic-embed",
        usage: { prompt_tokens: 5, total_tokens: 5 },
        data: [
          { id: "emb-0", object: "embedding", index: 0, embedding: [1, 0, 0] },
          { id: "emb-1", object: "embedding", index: 1, embedding: [0.8, 0.2, 0] },
        ],
      })),
  );
  const user = userEvent.setup();

  render(<EmbeddingsPage />);
  await user.type(await screen.findByLabelText("Inputs"), " alpha \n\n beta ");
  await user.selectOptions(screen.getByLabelText("Route"), "node:mac");
  await user.click(screen.getByRole("button", { name: "Run" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/chat/nomic-embed/embeddings", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ input: ["alpha", "beta"], target: "node:mac" }),
  })));
  expect(await screen.findByText("emb-0")).toBeInTheDocument();
  expect(screen.getByText("alpha")).toBeInTheDocument();
  expect(screen.getByText("beta")).toBeInTheDocument();
  expect(screen.getAllByText("3")[0]).toBeInTheDocument();
  expect(screen.getAllByText("prompt=5, total=5")[0]).toBeInTheDocument();
});

it("computes similarity, nearest neighbors, and quick clusters from returned vectors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ name: "embedder" }]))
      .mockResolvedValueOnce(okJson({
        model: "embedder",
        data: [
          { id: "a", embedding: [1, 0] },
          { id: "b", embedding: [0.9, 0.1] },
          { id: "c", embedding: [0, 1] },
        ],
      })),
  );
  const user = userEvent.setup();

  render(<EmbeddingsPage />);
  await user.type(await screen.findByLabelText("Inputs"), "red\nrose\nblue");
  await user.click(screen.getByRole("button", { name: "Run" }));
  await screen.findByText("a");

  await user.click(screen.getByRole("button", { name: "Compute Similarity" }));
  expect(await screen.findByText("1.000000")).toBeInTheDocument();
  expect(screen.getByText("0.993884")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Nearest Neighbors" }));
  expect(screen.queryAllByText("a")).toHaveLength(1);
  expect(screen.getAllByText("b").length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: "Quick Clusters" }));
  expect(screen.getByText(/"cluster": 0/)).toBeInTheDocument();
  expect(screen.getByText(/"members"/)).toBeInTheDocument();
});

it("exports the last embeddings result as JSON and CSV", async () => {
  const createObjectURL = vi.fn(() => "blob:embeddings");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(okJson([{ name: "embedder" }]))
      .mockResolvedValueOnce(okJson({ model: "embedder", usage: { prompt_tokens: 1, total_tokens: 1 }, data: [{ id: "emb-0", object: "embedding", embedding: [0.1, 0.2] }] })),
  );
  const user = userEvent.setup();

  render(<EmbeddingsPage />);
  await user.type(await screen.findByLabelText("Inputs"), "hello");
  await user.click(screen.getByRole("button", { name: "Run" }));
  await screen.findByText("emb-0");

  await user.click(screen.getByRole("button", { name: "Export JSON" }));
  await user.click(screen.getByRole("button", { name: "Export CSV" }));

  expect(createObjectURL).toHaveBeenCalledTimes(2);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:embeddings");
});
