import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ToolLoopEvalsPage } from "../../pages/ToolLoopEvalsPage";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders latest tool-loop eval summaries and selected case details", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
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

  render(<ToolLoopEvalsPage />);

  expect(await screen.findByRole("heading", { name: "Tool Loop Evals" })).toBeInTheDocument();
  expect(screen.getAllByText("gpt-oss-20b").length).toBeGreaterThan(0);
  expect(screen.getByText("2 / 2")).toBeInTheDocument();
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
  expect(screen.getByText("uv run python scripts/tool_loop_eval.py --config /path/to/controller-config.yaml --model gpt-oss-20b --target node:mac-mini")).toBeInTheDocument();
  expect(screen.getByText("/tmp/tool_loop_eval_latest.json")).toBeInTheDocument();
});
