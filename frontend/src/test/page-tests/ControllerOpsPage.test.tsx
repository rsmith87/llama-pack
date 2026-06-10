import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ControllerOpsPage } from "../../pages/ControllerOpsPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function initialFetch() {
  return vi.fn()
    .mockResolvedValueOnce(okJson([
      { name: "mac", url: "http://mac" },
      { name: "linux", url: "http://linux" },
    ]))
    .mockResolvedValueOnce(okJson([
      { name: "mac", reachable: true, models: [{ name: "qwen" }], last_heartbeat: "now", models_source: "agent" },
      { name: "linux", reachable: false, models: [], last_heartbeat: "old", models_source: "cache" },
    ]))
    .mockResolvedValueOnce(okJson([
      { id: "job-123456789", status: "running", type: "chat", target_selector: "node:mac", updated_at: "today" },
      { id: "job-2", status: "succeeded", type: "embed", target_selector: "auto", updated_at: "yesterday" },
    ]))
    .mockResolvedValueOnce(okJson({ job_counts: { running: 1, succeeded: 1 }, last_sweep: { deleted: 2 } }))
    .mockResolvedValueOnce(okJson({ retention_days: 7, archive_retention_days: 30 }));
}

it("renders jobs, node capabilities, retention, and filters jobs", async () => {
  vi.stubGlobal("fetch", initialFetch());
  const user = userEvent.setup();

  render(<ControllerOpsPage />);

  expect(await screen.findByText("job-1234")).toBeInTheDocument();
  expect(screen.getByText("node:mac")).toBeInTheDocument();
  expect(screen.getByText("mac")).toBeInTheDocument();
  expect(screen.getByText("retention_days=7")).toBeInTheDocument();
  expect(screen.getByText(/"running": 1/)).toBeInTheDocument();

  await user.type(screen.getByLabelText("Status"), "succeeded");

  expect(screen.queryByText("job-1234")).not.toBeInTheDocument();
  expect(screen.getByText("job-2")).toBeInTheDocument();
});

it("loads job detail with events and artifacts", async () => {
  vi.stubGlobal(
    "fetch",
    initialFetch()
      .mockResolvedValueOnce(okJson({ id: "job-123456789", status: "running", type: "chat", target_selector: "node:mac", created_at: "start", updated_at: "today" }))
      .mockResolvedValueOnce(okJson([{ created_at: "now", event_type: "job_started", event_json: { node: "mac" } }]))
      .mockResolvedValueOnce(okJson([{ kind: "log", uri: "file:///tmp/job.log", meta: { bytes: 10 } }])),
  );
  const user = userEvent.setup();

  render(<ControllerOpsPage />);
  await user.click(await screen.findByRole("button", { name: "View job-123456789" }));

  expect(await screen.findByText(/status=running type=chat target=node:mac/)).toBeInTheDocument();
  expect(screen.getByText("job_started")).toBeInTheDocument();
  expect(screen.getByText("file:///tmp/job.log")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/jobs/job-123456789/events?limit=200", expect.objectContaining({ method: "GET" }));
  expect(fetch).toHaveBeenCalledWith("/lm-api/v1/jobs/job-123456789/artifacts", expect.objectContaining({ method: "GET" }));
});

it("cancels jobs and refreshes controller data", async () => {
  vi.stubGlobal(
    "fetch",
    initialFetch()
      .mockResolvedValueOnce(okJson({ status: "cancel_requested" }))
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([{ id: "job-123456789", status: "cancel_requested", type: "chat", target_selector: "node:mac" }]))
      .mockResolvedValueOnce(okJson({ job_counts: { cancel_requested: 1 } }))
      .mockResolvedValueOnce(okJson({ retention_days: 7 })),
  );
  const user = userEvent.setup();

  render(<ControllerOpsPage />);
  await user.click(await screen.findByRole("button", { name: "Cancel job-123456789" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/jobs/job-123456789/cancel", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText("cancel_requested")).toBeInTheDocument();
});

it("runs archive export", async () => {
  vi.stubGlobal(
    "fetch",
    initialFetch()
      .mockResolvedValueOnce(okJson({ jobs_exported: 3, archive_path: "/archives/jobs.jsonl" })),
  );
  const user = userEvent.setup();

  render(<ControllerOpsPage />);
  await user.click(await screen.findByRole("button", { name: "Run Archive Export" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/controller/archive/export", expect.objectContaining({ method: "POST" })));
  expect(screen.getByText(/"jobs_exported": 3/)).toBeInTheDocument();
});
