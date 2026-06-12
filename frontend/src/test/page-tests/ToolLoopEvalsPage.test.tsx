import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ToolLoopEvalsPage } from "../../pages/ToolLoopEvalsPage";
import userEvent from "@testing-library/user-event";
import { AppModeProvider } from "../../features/appMode/appModeContext";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders latest tool-loop eval summaries and selected case details", async () => {
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
  expect(screen.getByText("mac-mini")).toBeInTheDocument();
  expect(screen.getAllByText("gpt-oss-20b").length).toBeGreaterThan(0);
  expect(screen.getAllByText("2 / 2").length).toBeGreaterThan(0);
  expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
  expect(screen.getAllByText("two-step-tool-synthesis").length).toBeGreaterThan(0);
  expect(screen.getAllByText("read_status -> read_details").length).toBeGreaterThan(0);
  expect(screen.getByText("Combined answer")).toBeInTheDocument();
  const checks = screen.getByLabelText("Case checks");
  expect(within(checks).getByText("completed")).toBeInTheDocument();
  expect(within(checks).getByText("no_tool_errors")).toBeInTheDocument();
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

it("submits a tool-loop eval run from the page", async () => {
  const user = userEvent.setup();
  const requests: Array<{ url: string; body?: string }> = [];
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    requests.push({ url, body: String(options?.body || "") });
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
    if (url === "/lm-api/v1/runtime/tool-loop-evals/node-run") {
      return Promise.resolve(okJson({
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
            final_answer: "tool loop ready",
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

  await user.selectOptions(await screen.findByLabelText("Preset"), "avoid-unneeded-tools");
  await user.click(screen.getByRole("button", { name: "Run Eval" }));

  const runRequest = requests.find((request) => request.url === "/lm-api/v1/runtime/tool-loop-evals/node-run");
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
    if (url === "/lm-api/v1/runtime/tool-loop-evals/run") {
      return Promise.resolve(okJson({
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
            final_answer: "local tool loop ready",
          },
        ],
      }));
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

  const localRunRequest = requests.find((request) => request.url === "/lm-api/v1/runtime/tool-loop-evals/run");
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

it("renders local history targets", async () => {
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

  expect(await screen.findByText("local")).toBeInTheDocument();
});

it("exposes real-world scenario presets in the run form", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
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
  expect(within(preset).getByRole("option", { name: "Technical design doc draft" })).toHaveValue("technical-design-doc-draft");
  expect(within(preset).getByRole("option", { name: "Collaborative notes app design" })).toHaveValue("collaborative-notes-app-design");
  expect(within(preset).getByRole("option", { name: "Live collaborative notes design" })).toHaveValue("live-collaborative-notes-design");
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
            models: { models: [{ name: "gpt-oss-20b-mxfp4:default", status: "running" }] },
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

  render(
    <AppModeProvider appMode="controller">
      <ToolLoopEvalsPage />
    </AppModeProvider>,
  );

  expect(await screen.findByDisplayValue("gemma-4-E4B-it-OBLITERATED-Q8_0")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Node"), "linux-2080ti");

  expect(screen.getByDisplayValue("gpt-oss-20b-mxfp4:default")).toBeInTheDocument();
});
