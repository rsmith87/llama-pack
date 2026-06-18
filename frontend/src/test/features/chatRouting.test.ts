import { describe, expect, it } from "vitest";
import { routeDecisionToMeta, routeExplanationItems } from "../../features/chat";

describe("chat route explanation helpers", () => {
  it("keeps the selected route, reason, candidates, and startup decision from a thread route decision", () => {
    const meta = routeDecisionToMeta({
      node: "linux-2080ti",
      model: "qwen3",
      strategy: "deterministic",
      reason: "request_type_artifact_registered",
      startup_needed: true,
      startup_decision: "start_now",
      candidates: [
        { node: "linux-2080ti", model: "qwen3", priority: 10, model_running: false, artifact_state: "registered" },
        { node: "mac-mini", model: "gemma", priority: 20, model_running: true },
      ],
    });

    expect(meta).toEqual({
      model: "qwen3",
      target: "node:linux-2080ti",
      resolved: "linux-2080ti",
      reason: "request_type_artifact_registered",
      strategy: "deterministic",
      startup: "start_now",
      candidates: [
        "linux-2080ti/qwen3 priority 10, running no, artifact registered",
        "mac-mini/gemma priority 20, running yes",
      ],
    });
  });

  it("builds concise route explanation lines for messages", () => {
    expect(
      routeExplanationItems({
        routeMeta: {
          model: "qwen3",
          target: "node:linux-2080ti",
          resolved: "linux-2080ti",
          reason: "explicit_target",
          strategy: "explicit",
          candidates: ["linux-2080ti/qwen3, running yes"],
        },
      }),
    ).toEqual([
      "Target node:linux-2080ti",
      "Resolved agent linux-2080ti",
      "Model qwen3",
      "Strategy explicit",
      "Reason explicit_target",
      "Candidate linux-2080ti/qwen3, running yes",
    ]);
  });

  it("uses direct route headers when detailed route metadata is unavailable", () => {
    expect(routeExplanationItems({ route: "node:mac-mini" })).toEqual(["Resolved route node:mac-mini"]);
  });
});
