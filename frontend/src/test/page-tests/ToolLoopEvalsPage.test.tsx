import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ToolLoopEvalsPage } from "../../pages/ToolLoopEvalsPage";
import { ToolLoopCaseDetail, ToolLoopCaseList, RunComparisonPanel } from "../../pages/ToolLoopEvalsPage/components";
import { scorePercent, presetGroupsWithAllOption } from "../../features/toolLoopEvals/viewModels";
import userEvent from "@testing-library/user-event";
import { AppModeProvider } from "../../features/appMode/appModeContext";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function okStream(events: unknown[]) {
  const text = events.map((event) => `event: ${(event as { event_type?: string }).event_type || "message"}\ndata: ${JSON.stringify(event)}\n\n`).join("");
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
  };
}

function presetCatalog(payload = {}) {
  return {
    preset_count: 2,
    groups: [
      {
        id: "synthetic",
        label: "Synthetic presets",
        presets: [
          {
            id: "avoid-unneeded-tools",
            label: "Backend direct answer",
            category: "synthetic",
            scoring_mode: "strict_sequence",
            expected_tool_count: 0,
            max_iterations: null,
          },
        ],
      },
      {
        id: "real_world",
        label: "Real-world scenarios",
        presets: [
          {
            id: "technical-design-doc-draft",
            label: "Backend technical design",
            category: "real_world",
            scoring_mode: "set_membership",
            expected_tool_count: 5,
            max_iterations: 8,
          },
        ],
      },
    ],
    ...payload,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps ToolLoopEvalsPage focused by extracting view models and display components", () => {
  const source = readFileSync(resolve(__dirname, "../../pages/ToolLoopEvalsPage/index.tsx"), "utf-8");

  expect(ToolLoopCaseDetail).toBeTypeOf("function");
  expect(ToolLoopCaseList).toBeTypeOf("function");
  expect(RunComparisonPanel).toBeTypeOf("function");
  expect(scorePercent(0.875)).toBe("88%");
  expect(presetGroupsWithAllOption([{ id: "synthetic", label: "Synthetic", presets: [{ id: "case-1", label: "Case 1" }] }])[0].presets[0].id).toBe("all");
  expect(source).not.toContain("function timelineEntries");
  expect(source).not.toContain("function ToolLoopCaseDetail");
});

it("renders latest tool-loop eval summaries and selected case details", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({
        runs: [
          {
            id: "run-1",
            generated_at: "2026-06-11T12:10:00+00:00",
            model: "gpt-oss-20b",
            target_selector: "node:mac-mini",
            target_node: "mac-mini",
            status: "passed",
            average_score: 1,
            case_count: 2,
            passed_count: 2,
            failed_count: 0,
            case_ids: ["two-step-tool-synthesis", "avoid-unneeded-tools"],
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs/run-1") {
      return Promise.resolve(okJson({
        id: "run-1",
        generated_at: "2026-06-11T12:10:00+00:00",
        model: "gpt-oss-20b",
        target_selector: "node:mac-mini",
        target_node: "mac-mini",
        status: "passed",
        average_score: 1,
        case_count: 2,
        passed_count: 2,
        failed_count: 0,
        cases: [
          {
            case_id: "avoid-unneeded-tools",
            status: "passed",
            score: 1,
            iteration_count: 1,
            tool_call_count: 0,
            observed_tool_sequence: [],
            expected_tool_sequence: [],
            checks: { completed: true },
            final_answer: "tool loop ready",
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: true,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: "2026-06-11T12:00:00+00:00",
        suite_count: 1,
        models: ["gpt-oss-20b"],
        suites: [
          {
            model: "gpt-oss-20b",
            status: "passed",
            case_count: 2,
            passed_count: 2,
            failed_count: 0,
            average_score: 1,
            cases: [
              {
                case_id: "two-step-tool-synthesis",
                status: "passed",
                score: 1,
                iteration_count: 3,
                tool_call_count: 2,
                observed_tool_sequence: ["read_status", "read_details"],
                expected_tool_sequence: ["read_status", "read_details"],
                checks: {
                  completed: true,
                  expected_tool_sequence: true,
                  expected_final_substrings: true,
                  no_tool_errors: true,
                },
                final_answer: "Combined answer",
              },
            ],
          },
        ],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(
    <AppModeProvider appMode="controller">
      <ToolLoopEvalsPage />
    </AppModeProvider>,
  );

  expect(await screen.findByRole("heading", { name: "Tool Loop Evals" })).toBeInTheDocument();
  expect(await screen.findByText("Run History")).toBeInTheDocument();
  expect(screen.getAllByText("Preset").length).toBeGreaterThan(0);
  expect(screen.getByText("two-step-tool-synthesis +1")).toBeInTheDocument();
  expect(screen.getAllByText("gpt-oss-20b").length).toBeGreaterThan(0);
  expect(screen.getAllByText("2 / 2").length).toBeGreaterThan(0);
  expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
  expect(screen.getAllByText("two-step-tool-synthesis").length).toBeGreaterThan(0);
  expect(screen.getAllByText("read_status -> read_details").length).toBeGreaterThan(0);
  expect(screen.getByText("Combined answer")).toBeInTheDocument();
  const checks = screen.getByLabelText("Case checks");
  expect(within(checks).getByText("completed")).toBeInTheDocument();
  expect(within(checks).getByText("no_tool_errors")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "View run gpt-oss-20b" }));

  const dialog = await screen.findByRole("dialog", { name: "Tool-loop run details" });
  expect(within(dialog).getAllByText("avoid-unneeded-tools").length).toBeGreaterThan(0);
  expect(within(dialog).getByText("tool loop ready")).toBeInTheDocument();
  expect(within(dialog).getAllByText("gpt-oss-20b").length).toBeGreaterThan(0);
});

it("renders an empty state when no latest tool-loop eval exists", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({ runs: [] }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<ToolLoopEvalsPage />);

  expect(await screen.findByText("No tool-loop eval results yet.")).toBeInTheDocument();
  expect(screen.getByText("Run a tool-loop eval from this page, then refresh to inspect the latest summary.")).toBeInTheDocument();
  expect(screen.getByText("/tmp/tool_loop_eval_latest.json")).toBeInTheDocument();
});

it("loads persisted run detail from the history table", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({
        runs: [
          {
            id: "run-2",
            generated_at: "2026-06-11T12:15:00+00:00",
            model: "qwen",
            target_selector: "node:linux-2080ti",
            target_node: "linux-2080ti",
            status: "failed",
            average_score: 0.5,
            case_count: 2,
            passed_count: 1,
            failed_count: 1,
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs/run-2") {
      return Promise.resolve(okJson({
        id: "run-2",
        generated_at: "2026-06-11T12:15:00+00:00",
        model: "qwen",
        target_selector: "node:linux-2080ti",
        target_node: "linux-2080ti",
        status: "failed",
        average_score: 0.5,
        case_count: 2,
        passed_count: 1,
        failed_count: 1,
        cases: [
          {
            case_id: "branching-decision",
            status: "failed",
            score: 0.5,
            iteration_count: 2,
            tool_call_count: 2,
            observed_tool_sequence: ["choose_route", "inspect_billing"],
            expected_tool_sequence: ["choose_route", "inspect_infra"],
            checks: { expected_tool_sequence: false },
            trace_events: [
              { id: "trace-history-1", event_type: "case_started", sequence: 1, status: "running", title: "Case started", payload: {} },
              { id: "trace-history-2", event_type: "tool_call_started", sequence: 2, status: "running", title: "choose_route started", payload: { tool_name: "choose_route" } },
            ],
            final_answer: "billing route found invoice drift",
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<ToolLoopEvalsPage />);

  await user.click(await screen.findByRole("button", { name: "View run qwen" }));

  expect((await screen.findAllByText("branching-decision")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("choose_route -> inspect_billing").length).toBeGreaterThan(0);
  expect(screen.getByText("billing route found invoice drift")).toBeInTheDocument();
  expect(screen.getByLabelText("Runtime trace replay")).toBeInTheDocument();
  expect(screen.getByText("2 / 2 events")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Replay" }));
  expect(screen.getByText("0 / 2 events")).toBeInTheDocument();
});

it("renders expandable tool-call timeline details", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({
        runs: [
          {
            id: "run-3",
            generated_at: "2026-06-11T12:20:00+00:00",
            model: "gpt-oss-20b",
            target_selector: "node:linux-2080ti",
            target_node: "linux-2080ti",
            status: "passed",
            average_score: 1,
            case_count: 1,
            passed_count: 1,
            failed_count: 0,
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs/run-3") {
      return Promise.resolve(okJson({
        id: "run-3",
        generated_at: "2026-06-11T12:20:00+00:00",
        model: "gpt-oss-20b",
        target_selector: "node:linux-2080ti",
        target_node: "linux-2080ti",
        status: "passed",
        average_score: 1,
        case_count: 1,
        passed_count: 1,
        failed_count: 0,
        cases: [
          {
            case_id: "technical-design-doc-draft",
            status: "passed",
            score: 1,
            iteration_count: 6,
            tool_call_count: 2,
            observed_tool_sequence: ["read_design_requirements", "inspect_existing_api_contract"],
            expected_tool_sequence: ["read_design_requirements", "inspect_existing_api_contract"],
            checks: { completed: true, expected_tool_sequence: true, no_tool_errors: true, no_repeated_calls: true },
            tool_results: [
              {
                tool_call_id: "call-req",
                tool_name: "read_design_requirements",
                raw_arguments: "{}",
                arguments: {},
                ok: true,
                error: "",
                function: { name: "read_design_requirements", arguments: "{}" },
                result: { ok: true, source: "requirements", problem: "durable eval history" },
              },
              {
                tool_call_id: "call-api",
                tool_name: "inspect_existing_api_contract",
                raw_arguments: "{}",
                arguments: {},
                ok: true,
                error: "",
              },
            ],
            final_answer: "Overview Goals Architecture Persistence Frontend Risk durable eval history",
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<ToolLoopEvalsPage />);

  await user.click(await screen.findByRole("button", { name: "View run gpt-oss-20b" }));

  expect(await screen.findByText("Tool Call Timeline")).toBeInTheDocument();
  expect(screen.getByText("read_design_requirements")).toBeInTheDocument();
  expect(screen.getByText("inspect_existing_api_contract")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Inspect tool call 1 read_design_requirements" }));

  expect(screen.getAllByText("Function call").length).toBeGreaterThan(0);
  expect(screen.getByText(/"tool_call_id": "call-req"/)).toBeInTheDocument();
  expect(screen.getByText(/"problem": "durable eval history"/)).toBeInTheDocument();
});

it("renders required tool and artifact diagnostics for persisted run cases", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({
        runs: [
          {
            id: "run-diagnostics",
            generated_at: "2026-06-11T12:10:00+00:00",
            model: "gpt-oss-20b",
            status: "failed",
            average_score: 0.875,
            case_count: 1,
            passed_count: 0,
            failed_count: 1,
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs/run-diagnostics") {
      return Promise.resolve(okJson({
        id: "run-diagnostics",
        generated_at: "2026-06-11T12:10:00+00:00",
        model: "gpt-oss-20b",
        status: "failed",
        average_score: 0.875,
        case_count: 1,
        passed_count: 0,
        failed_count: 1,
        cases: [
          {
            case_id: "live-collaborative-notes-design",
            status: "failed",
            score: 0.875,
            iteration_count: 6,
            tool_call_count: 5,
            observed_tool_sequence: [
              "list_workspace",
              "read_workspace_file",
              "read_workspace_file",
              "search_workspace",
              "write_notes_app_design",
            ],
            expected_tool_sequence: ["list_workspace", "read_workspace_file", "search_workspace", "write_notes_app_design"],
            missing_expected_tools: [],
            unexpected_tools: ["read_workspace_file"],
            checks: {
              completed: true,
              expected_tool_sequence: true,
              expected_final_substrings: false,
              no_tool_errors: true,
            },
            diagnostics: {
              missing_artifact_substrings: { "docs/notes-app-design.md": ["registration"] },
            },
            tool_results: [],
            final_answer: "Done.",
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<ToolLoopEvalsPage />);

  await user.click(await screen.findByRole("button", { name: "View run gpt-oss-20b" }));

  expect(await screen.findByText("Required tools")).toBeInTheDocument();
  expect(screen.getByLabelText("Case diagnostics")).toBeInTheDocument();
  expect(screen.getByText("Extra observed tools")).toBeInTheDocument();
  expect(screen.getByText("Artifact diagnostics")).toBeInTheDocument();
  expect(screen.getByText("expected_final_substrings")).toBeInTheDocument();
  expect(screen.getByText(/"registration"/)).toBeInTheDocument();
});

it("summarizes failure buckets for the selected persisted run", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({
        runs: [
          {
            id: "run-failure-summary",
            generated_at: "2026-06-11T12:10:00+00:00",
            model: "gpt-oss-20b",
            status: "failed",
            average_score: 0.5,
            case_count: 2,
            passed_count: 0,
            failed_count: 2,
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs/run-failure-summary") {
      return Promise.resolve(okJson({
        id: "run-failure-summary",
        generated_at: "2026-06-11T12:10:00+00:00",
        model: "gpt-oss-20b",
        status: "failed",
        average_score: 0.5,
        case_count: 2,
        passed_count: 0,
        failed_count: 2,
        cases: [
          {
            case_id: "argument-repair",
            status: "failed",
            score: 0.25,
            checks: {
              expected_tool_sequence: false,
              expected_tool_arguments: false,
              no_tool_errors: false,
            },
            missing_expected_tools: ["fetch_ticket"],
            unexpected_tools: ["read_status"],
            observed_tool_sequence: ["read_status", "read_status"],
            tool_results: [{ tool_name: "read_status", ok: false, error: "wrong tool" }],
            final_answer: "",
          },
          {
            case_id: "live-collaborative-notes-design",
            status: "failed",
            score: 0.75,
            error: "live tool loop reached max_iterations before final assistant response",
            checks: {
              completed: false,
              expected_artifact_substrings: false,
              no_repeated_calls: false,
            },
            diagnostics: {
              missing_artifact_substrings: { "docs/notes-app-design.md": ["registration"] },
            },
            observed_tool_sequence: ["read_workspace_file", "read_workspace_file"],
            final_answer: "",
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<ToolLoopEvalsPage />);

  await user.click(await screen.findByRole("button", { name: "View run gpt-oss-20b" }));

  expect(await screen.findByText("Failure Summary")).toBeInTheDocument();
  expect(screen.getByText("2 failed cases")).toBeInTheDocument();
  expect(screen.getByText("Missing tools")).toBeInTheDocument();
  expect(screen.getByText("Repeated tools")).toBeInTheDocument();
  expect(screen.getByText("Max iterations")).toBeInTheDocument();
  expect(screen.getByText("Argument mismatch")).toBeInTheDocument();
  expect(screen.getByText("Tool selection: missing required tools or unrelated tool calls.")).toBeInTheDocument();
  expect(screen.getByText("Loop control: repeated calls or max-iteration exits.")).toBeInTheDocument();
});

it("compares selected persisted runs", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({
        runs: [
          {
            id: "run-a",
            generated_at: "2026-06-11T12:10:00+00:00",
            model: "model-a",
            target_selector: "node:mac-mini",
            status: "failed",
            average_score: 0.5,
            case_count: 2,
            passed_count: 1,
            failed_count: 1,
          },
          {
            id: "run-b",
            generated_at: "2026-06-11T12:12:00+00:00",
            model: "model-b",
            target_selector: "node:linux-2080ti",
            status: "passed",
            average_score: 1,
            case_count: 2,
            passed_count: 2,
            failed_count: 0,
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs/run-a") {
      return Promise.resolve(okJson({
        id: "run-a",
        model: "model-a",
        target_selector: "node:mac-mini",
        status: "failed",
        average_score: 0.5,
        case_count: 2,
        passed_count: 1,
        failed_count: 1,
        cases: [
          { case_id: "avoid-unneeded-tools", status: "passed", score: 1, checks: { completed: true } },
          {
            case_id: "argument-repair",
            status: "failed",
            score: 0,
            checks: { expected_tool_arguments: false, expected_tool_sequence: false },
            missing_expected_tools: ["fetch_ticket"],
            observed_tool_sequence: ["read_status"],
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs/run-b") {
      return Promise.resolve(okJson({
        id: "run-b",
        model: "model-b",
        target_selector: "node:linux-2080ti",
        status: "passed",
        average_score: 1,
        case_count: 2,
        passed_count: 2,
        failed_count: 0,
        cases: [
          { case_id: "avoid-unneeded-tools", status: "passed", score: 1, checks: { completed: true } },
          { case_id: "argument-repair", status: "passed", score: 1, checks: { expected_tool_arguments: true, expected_tool_sequence: true } },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<ToolLoopEvalsPage />);

  await user.click(await screen.findByRole("checkbox", { name: "Compare model-a" }));
  await user.click(screen.getByRole("checkbox", { name: "Compare model-b" }));
  await user.click(screen.getByRole("button", { name: "Compare Selected" }));

  expect(await screen.findByText("Run Comparison")).toBeInTheDocument();
  expect(screen.getByText("Best run")).toBeInTheDocument();
  expect(screen.getAllByText("model-b · node:linux-2080ti").length).toBeGreaterThan(0);
  expect(screen.getByText("Score delta")).toBeInTheDocument();
  expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
  expect(screen.getByText("argument-repair")).toBeInTheDocument();
  expect(screen.getByText("expected_tool_arguments, expected_tool_sequence")).toBeInTheDocument();
  expect(screen.getByText("Missing tools, Argument mismatch")).toBeInTheDocument();
});

it("submits a tool-loop eval run from the page", async () => {
  const user = userEvent.setup();
  const requests: Array<{ url: string; body?: string }> = [];
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    requests.push({ url, body: String(options?.body || "") });
    if (url === "/lm-api/v1/runtime/tool-loop-evals/presets") {
      return Promise.resolve(okJson(presetCatalog()));
    }
    if (url === "/lm-api/v1/nodes/models") {
      return Promise.resolve(okJson({
        nodes: [
          {
            name: "mac-mini",
            reachable: true,
            models: [{ name: "gpt-oss-20b", status: "running" }],
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({ runs: [] }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/node-run/stream") {
      return Promise.resolve(okStream([
        { id: "trace-1", event_type: "run_started", status: "running", sequence: 1, payload: {} },
        {
          id: "trace-2",
          event_type: "run_completed",
          status: "passed",
          sequence: 2,
          payload: {
            suite: {
              model: "gpt-oss-20b",
              status: "passed",
              case_count: 1,
              passed_count: 1,
              failed_count: 0,
              average_score: 1,
              persisted_run_id: "run-new",
              cases: [
                {
                  case_id: "avoid-unneeded-tools",
                  status: "passed",
                  score: 1,
                  iteration_count: 1,
                  tool_call_count: 0,
                  observed_tool_sequence: [],
                  expected_tool_sequence: [],
                  checks: { completed: true },
                  trace_events: [
                    { id: "case-trace-1", event_type: "assistant_message_completed", sequence: 1, status: "passed", title: "Assistant answered", payload: { content: "tool loop ready" } },
                  ],
                  final_answer: "tool loop ready",
                },
              ],
            },
          },
        },
      ]));
    }
    return Promise.resolve(okJson({}));
  }));

  render(
    <AppModeProvider appMode="controller">
      <ToolLoopEvalsPage />
    </AppModeProvider>,
  );

  await user.selectOptions(await screen.findByLabelText("Preset"), "avoid-unneeded-tools");
  await user.click(screen.getByRole("button", { name: "Run Eval" }));

  const runRequest = requests.find((request) => request.url === "/lm-api/v1/runtime/tool-loop-evals/node-run/stream");
  expect(runRequest).toBeTruthy();
  expect(JSON.parse(String(runRequest?.body))).toEqual({
    node: "mac-mini",
    model: "gpt-oss-20b",
    case_ids: ["avoid-unneeded-tools"],
  });
  expect(await screen.findByText("tool loop ready")).toBeInTheDocument();
});

it("submits a local tool-loop eval run in agent mode", async () => {
  const user = userEvent.setup();
  const requests: Array<{ url: string; body?: string }> = [];
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    requests.push({ url, body: String(options?.body || "") });
    if (url === "/lm-api/v1/runtime/tool-loop-evals/presets") {
      return Promise.resolve(okJson(presetCatalog()));
    }
    if (url === "/lm-api/v1/models") {
      return Promise.resolve(okJson({
        models: [{ name: "qwen-local", status: "running" }],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({ runs: [] }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/run/stream") {
      return Promise.resolve(okStream([
        {
          id: "trace-local",
          event_type: "run_completed",
          status: "passed",
          sequence: 1,
          payload: {
            suite: {
              model: "qwen-local",
              status: "passed",
              case_count: 1,
              passed_count: 1,
              failed_count: 0,
              average_score: 1,
              persisted_run_id: "run-local",
              cases: [
                {
                  case_id: "avoid-unneeded-tools",
                  status: "passed",
                  score: 1,
                  iteration_count: 1,
                  tool_call_count: 0,
                  observed_tool_sequence: [],
                  expected_tool_sequence: [],
                  checks: { completed: true },
                  trace_events: [
                    { id: "case-trace-local", event_type: "assistant_message_completed", sequence: 1, status: "passed", title: "Assistant answered", payload: { content: "local tool loop ready" } },
                  ],
                  final_answer: "local tool loop ready",
                },
              ],
            },
          },
        },
      ]));
    }
    return Promise.resolve(okJson({}));
  }));

  render(
    <AppModeProvider appMode="agent">
      <ToolLoopEvalsPage />
    </AppModeProvider>,
  );

  expect(await screen.findByDisplayValue("qwen-local")).toBeInTheDocument();
  expect(screen.queryByLabelText("Node")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Preset"), "avoid-unneeded-tools");
  await user.click(screen.getByRole("button", { name: "Run Eval" }));

  const localRunRequest = requests.find((request) => request.url === "/lm-api/v1/runtime/tool-loop-evals/run/stream");
  expect(localRunRequest).toBeTruthy();
  expect(JSON.parse(String(localRunRequest?.body))).toEqual({
    model: "qwen-local",
    case_ids: ["avoid-unneeded-tools"],
  });
  expect(requests.some((request) => request.url === "/lm-api/v1/nodes/models")).toBe(false);
  expect(await screen.findByText("local tool loop ready")).toBeInTheDocument();
  expect(screen.getByText(/Persisted run cases .* local/)).toBeInTheDocument();
});

it("keeps the local run button disabled in agent mode until a model is selected", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [] }));
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") return Promise.resolve(okJson({ runs: [] }));
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(
    <AppModeProvider appMode="agent">
      <ToolLoopEvalsPage />
    </AppModeProvider>,
  );

  expect(await screen.findByRole("button", { name: "Run Eval" })).toBeDisabled();
  expect(screen.queryByLabelText("Node")).not.toBeInTheDocument();
});

it("renders local history presets", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/models") return Promise.resolve(okJson({ models: [{ name: "qwen-local" }] }));
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") {
      return Promise.resolve(okJson({
        runs: [
          {
            id: "run-local-history",
            generated_at: "2026-06-11T12:10:00+00:00",
            model: "qwen-local",
            target_selector: "local",
            target_node: null,
            status: "passed",
            average_score: 1,
            case_count: 1,
            passed_count: 1,
            failed_count: 0,
            case_ids: ["live-config-migration-plan"],
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(
    <AppModeProvider appMode="agent">
      <ToolLoopEvalsPage />
    </AppModeProvider>,
  );

  expect(await screen.findByText("live-config-migration-plan")).toBeInTheDocument();
});

it("exposes real-world scenario presets in the run form", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/runtime/tool-loop-evals/presets") {
      return Promise.resolve(okJson(presetCatalog()));
    }
    if (url === "/lm-api/v1/nodes/models") {
      return Promise.resolve(okJson({
        nodes: [
          {
            name: "mac-mini",
            reachable: true,
            models: [{ name: "gpt-oss-20b", status: "running" }],
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") return Promise.resolve(okJson({ runs: [] }));
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  render(<ToolLoopEvalsPage />);

  const preset = await screen.findByLabelText("Preset");
  expect(within(preset).getByRole("group", { name: "Synthetic presets" })).toBeInTheDocument();
  expect(within(preset).getByRole("group", { name: "Real-world scenarios" })).toBeInTheDocument();
  expect(within(preset).getByRole("option", { name: "Backend direct answer" })).toHaveValue("avoid-unneeded-tools");
  expect(within(preset).getByRole("option", { name: "Backend technical design" })).toHaveValue("technical-design-doc-draft");
});

it("updates the model field when the selected node changes", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/lm-api/v1/nodes/models") {
      return Promise.resolve(okJson({
        nodes: [
          {
            name: "mac-mini",
            reachable: true,
            models: [{ name: "gemma-4-E4B-it-OBLITERATED-Q8_0", status: "running" }],
          },
          {
            name: "linux-2080ti",
            reachable: true,
            models: {
              models: [
                { name: "gpt-oss-20b-mxfp4:default", status: "running" },
                { name: "mmproj-F16.gguf", status: "running", path: "/models/qwen/mmproj-F16.gguf" },
              ],
            },
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/runtime/tool-loop-evals/runs?limit=50") return Promise.resolve(okJson({ runs: [] }));
    if (url === "/lm-api/v1/runtime/tool-loop-evals/latest") {
      return Promise.resolve(okJson({
        available: false,
        path: "/tmp/tool_loop_eval_latest.json",
        generated_at: null,
        suite_count: 0,
        models: [],
        suites: [],
      }));
    }
    return Promise.resolve(okJson({}));
  }));

  const { container } = render(
    <AppModeProvider appMode="controller">
      <ToolLoopEvalsPage />
    </AppModeProvider>,
  );

  expect(await screen.findByDisplayValue("gemma-4-E4B-it-OBLITERATED-Q8_0")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Node"), "linux-2080ti");

  expect(screen.getByDisplayValue("gpt-oss-20b-mxfp4:default")).toBeInTheDocument();
  expect(container.querySelector('option[value="gpt-oss-20b-mxfp4:default"]')).not.toBeNull();
  expect(container.querySelector('option[value="mmproj-F16.gguf"]')).toBeNull();
});
