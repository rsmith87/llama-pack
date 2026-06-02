import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { HfDownloadsPage } from "./HfDownloadsPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function mockHfDownloadsFetch(overrides: Record<string, unknown> = {}) {
  const payloads: Record<string, unknown> = {
    "/lm-api/v1/downloads/history?limit=200": [],
    "/lm-api/v1/downloads/recommendations": {
      machine: { ram_gb: 16, vram_gb: 8, platform: "Darwin", architecture: "arm64" },
      recommendations: [
        {
          repo_id: "bartowski/Qwen3-8B-Instruct-GGUF",
          title: "Qwen3 8B Instruct",
          include_file: "Qwen3-8B-Instruct-Q4_K_M.gguf",
          quant: "Q4_K_M",
          fit_label: "Balanced GPU chat",
          use_case: "General local assistant workloads with practical GPU acceleration.",
          fit_reason: "Fits 8 GB VRAM with conservative GPU headroom.",
          score: 80,
        },
        {
          repo_id: "bartowski/gemma-4-E2B-it-GGUF",
          title: "Gemma 4 E2B IT",
          include_file: "gemma-4-E2B-it-Q4_K_M.gguf",
          quant: "Q4_K_M",
          fit_label: "Instruction-tuned alternative",
          use_case: "Useful second opinion for text-only assistant tasks.",
          fit_reason: "Fits 8 GB VRAM with conservative GPU headroom.",
          score: 78,
        },
      ],
      excluded: [
        {
          repo_id: "bartowski/Qwen3-14B-Instruct-GGUF",
          title: "Qwen3 14B Instruct",
          include_file: "Qwen3-14B-Instruct-Q4_K_M.gguf",
          quant: "Q4_K_M",
          fit_label: "Larger local model",
          use_case: "Higher quality local chat on larger desktops and controllers.",
          fit_reason: "Needs at least 12 GB GPU memory or 24 GB RAM.",
          score: 0,
        },
      ],
    },
    "/lm-api/v1/library/ggufs": [],
    "/lm-api/v1/nodes/models": [],
    ...overrides,
  };
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url in payloads) return Promise.resolve(okJson(payloads[url]));
    return Promise.resolve(okJson({ ok: true }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, payloads };
}

it("renders download history and actions", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/downloads/history?limit=200": [
      { id: "dl-1", repo_id: "owner/model", status: "complete", started_at: "start", finished_at: "finish", local_path: "/models/model", triggered_by: "ui" },
    ],
  });

  render(<HfDownloadsPage />);

  expect(await screen.findByText("owner/model")).toBeInTheDocument();
  expect(screen.getByText("complete")).toBeInTheDocument();
});

it("renders download progress for running selected-file downloads", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/downloads/history?limit=200": [
      {
        id: "dl-1",
        repo_id: "owner/model",
        status: "running",
        bytes_downloaded: 512,
        bytes_total: 2048,
        progress_percent: 25,
      },
    ],
  });

  render(<HfDownloadsPage />);

  expect(await screen.findByText("25%")).toBeInTheDocument();
  expect(screen.getByText("512 B / 2 KB")).toBeInTheDocument();
});

it("renders machine-fit recommended download cards", async () => {
  mockHfDownloadsFetch();

  render(<HfDownloadsPage />);

  expect(await screen.findByText("Recommended for this machine")).toBeInTheDocument();
  expect(screen.getByText("Qwen3 8B Instruct")).toBeInTheDocument();
  expect(screen.getByText("Gemma 4 E2B IT")).toBeInTheDocument();
  expect(screen.queryByText("Qwen3 14B Instruct")).not.toBeInTheDocument();
  expect(screen.getAllByText("Fits 8 GB VRAM with conservative GPU headroom.").length).toBeGreaterThan(0);
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/downloads/recommendations", expect.objectContaining({ method: "GET" }));
});

it("starts a recommended model download with the suggested quant file", async () => {
  mockHfDownloadsFetch();
  const user = userEvent.setup();

  render(<HfDownloadsPage />);
  await user.click(await screen.findByRole("button", { name: "Download Qwen3 8B Instruct" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "/lm-api/v1/downloads/bartowski/Qwen3-8B-Instruct-GGUF/start",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        revision: null,
        include_file: "Qwen3-8B-Instruct-Q4_K_M.gguf",
      }),
    }),
  ));
});

it("shows and downloads the matching mmproj for recommended vision models", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/downloads/recommendations": {
      machine: { ram_gb: 32, vram_gb: 12, platform: "Darwin", architecture: "arm64" },
      recommendations: [
        {
          repo_id: "bad/Qwen2.5-VL-7B-Instruct-GGUF",
          title: "Qwen2.5 VL 7B Instruct",
          include_file: "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
          mmproj_file: "mmproj-F16.gguf",
          vision: true,
          quant: "Q4_K_M",
          fit_label: "Hugging Face discovery",
          use_case: "Vision-language GGUF model discovered from Hugging Face.",
          fit_reason: "Fits 32 GB RAM with conservative headroom.",
          score: 80,
        },
      ],
      excluded: [],
    },
  });
  const user = userEvent.setup();

  render(<HfDownloadsPage />);

  expect(await screen.findByText("Qwen2.5 VL 7B Instruct")).toBeInTheDocument();
  expect(screen.getByText("mmproj-F16.gguf")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Download Qwen2.5 VL 7B Instruct" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "/lm-api/v1/downloads/bad/Qwen2.5-VL-7B-Instruct-GGUF/start",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        revision: null,
        include_file: "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
        mmproj_file: "mmproj-F16.gguf",
      }),
    }),
  ));
});

it("discovers quants and starts a selected quant download", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/downloads/quants?repo_id=owner%2Fmodel": [{ path: "model-Q4.gguf", filename: "model-Q4.gguf", size: 1000 }],
  });
  const user = userEvent.setup();

  render(<HfDownloadsPage />);
  await user.type(screen.getByPlaceholderText("owner/model"), "owner/model");
  await user.click(screen.getByRole("button", { name: "Find Quants" }));
  expect(await screen.findByRole("button", { name: "Download model-Q4.gguf" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Download model-Q4.gguf" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/downloads/owner/model/start", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ revision: null, include_file: "model-Q4.gguf" }),
  })));
});

it("shows and downloads the matching mmproj for discovered vision quants", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/downloads/quants?repo_id=owner%2Fmodel": [
      { path: "model-Q4.gguf", filename: "model-Q4.gguf", size: 1000, mmproj: { path: "mmproj-F16.gguf", filename: "mmproj-F16.gguf" } },
    ],
  });
  const user = userEvent.setup();

  render(<HfDownloadsPage />);
  await user.type(screen.getByPlaceholderText("owner/model"), "owner/model");
  await user.click(screen.getByRole("button", { name: "Find Quants" }));

  expect(await screen.findByText("mmproj-F16.gguf")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Download model-Q4.gguf" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/downloads/owner/model/start", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ revision: null, include_file: "model-Q4.gguf", mmproj_file: "mmproj-F16.gguf" }),
  })));
});

it("starts, cancels, and deletes downloads from history", async () => {
  const { payloads } = mockHfDownloadsFetch({
    "/lm-api/v1/downloads/history?limit=200": [{ id: "dl-1", repo_id: "owner/model", status: "running" }],
  });
  const user = userEvent.setup();

  render(<HfDownloadsPage />);
  await screen.findByText("owner/model");
  payloads["/lm-api/v1/downloads/history?limit=200"] = [{ id: "dl-1", repo_id: "owner/model", status: "cancelled" }];
  await user.click(screen.getByRole("button", { name: "Stop owner/model" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/downloads/dl-1/cancel", expect.objectContaining({ method: "POST" })));

  await user.click(await screen.findByRole("button", { name: "Delete owner/model" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/downloads/dl-1", expect.objectContaining({ method: "DELETE" })));
});

it("hides recommended cards already available on this machine", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/library/ggufs": [{ id: "local-qwen3", filename: "Qwen3-8B-Instruct-Q4_K_M.gguf", path: "/models/Qwen3-8B-Instruct-Q4_K_M.gguf" }],
  });

  render(<HfDownloadsPage />);

  expect(await screen.findByText("Gemma 4 E2B IT")).toBeInTheDocument();
  expect(screen.queryByText("Qwen3 8B Instruct")).not.toBeInTheDocument();
  expect(screen.queryByText("On this machine")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Download Qwen3 8B Instruct" })).not.toBeInTheDocument();
});

it("explains when all recommended models are already local", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/library/ggufs": [
      { id: "local-qwen3", filename: "Qwen3-8B-Instruct-Q4_K_M.gguf", path: "/models/Qwen3-8B-Instruct-Q4_K_M.gguf" },
      { id: "local-gemma4", filename: "gemma-4-E2B-it-Q4_K_M.gguf", path: "/models/gemma-4-E2B-it-Q4_K_M.gguf" },
    ],
  });

  render(<HfDownloadsPage />);

  expect(await screen.findByText("All recommended models are already available locally.")).toBeInTheDocument();
  expect(screen.queryByText("Qwen3 8B Instruct")).not.toBeInTheDocument();
  expect(screen.queryByText("Gemma 4 E2B IT")).not.toBeInTheDocument();
});

it("offers Send for recommended cards already present on another reachable node", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/nodes/models": [
      { name: "source", reachable: true, models: [{ name: "qwen3", model_path: "/models/Qwen3-8B-Instruct-Q4_K_M.gguf", file_id: "remote-qwen3" }] },
      { name: "dest", reachable: true, models: [] },
    ],
  });
  const user = userEvent.setup();

  render(<HfDownloadsPage />);
  await user.click(await screen.findByRole("button", { name: "Send Qwen3 8B Instruct" }));
  await user.click(screen.getByRole("button", { name: "Start Transfer" }));

  expect(await screen.findByText("Transfer queued")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/nodes/source/transfers", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      destination_node: "dest",
      source_file_id: "remote-qwen3",
      include: "selected_only",
    }),
  }));
});

it("keeps manual downloads available when recommendations fail", async () => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/lm-api/v1/downloads/recommendations") {
      return Promise.resolve({ ok: false, status: 500, statusText: "Server Error", text: async () => "boom" });
    }
    if (url === "/lm-api/v1/downloads/history?limit=200") return Promise.resolve(okJson([]));
    if (url === "/lm-api/v1/library/ggufs") return Promise.resolve(okJson([]));
    if (url === "/lm-api/v1/nodes/models") return Promise.resolve(okJson([]));
    return Promise.resolve(okJson({ ok: true }));
  }));

  render(<HfDownloadsPage />);

  expect(await screen.findByText("Recommendations are unavailable. Manual downloads still work.")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("owner/model")).toBeInTheDocument();
});

it("does not render multimodal recommendations from the backend payload", async () => {
  mockHfDownloadsFetch({
    "/lm-api/v1/downloads/recommendations": {
      machine: { ram_gb: 16, vram_gb: 8, platform: "Darwin", architecture: "arm64" },
      recommendations: [
        {
          repo_id: "bartowski/Qwen3-8B-Instruct-GGUF",
          title: "Qwen3 8B Instruct",
          include_file: "Qwen3-8B-Instruct-Q4_K_M.gguf",
          quant: "Q4_K_M",
          fit_label: "Balanced GPU chat",
          use_case: "General local assistant workloads with practical GPU acceleration.",
          fit_reason: "Fits 8 GB VRAM with conservative GPU headroom.",
          score: 80,
        },
      ],
      excluded: [
        {
          repo_id: "bad/Qwen2.5-VL-7B-Instruct-GGUF",
          title: "Qwen2.5 VL 7B Instruct",
          include_file: "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
          quant: "Q4_K_M",
          fit_label: "Excluded",
          use_case: "Should never appear as a supported recommendation.",
          fit_reason: "Requires multimodal runtime assets.",
          score: 0,
        },
      ],
    },
  });

  render(<HfDownloadsPage />);

  expect(await screen.findByText("Qwen3 8B Instruct")).toBeInTheDocument();
  expect(screen.queryByText("Qwen2.5 VL 7B Instruct")).not.toBeInTheDocument();
});
