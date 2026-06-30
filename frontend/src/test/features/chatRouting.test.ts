import { describe, expect, it } from "vitest";
import { nodeModelsToChatModels, routeDecisionToMeta, routeExplanationItems, runningChatModelOptions } from "../../features/chat";

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

  it("separates chat node model inventory from runnable dropdown options", () => {
    const models = nodeModelsToChatModels([
      {
        name: "linux-2080ti",
        reachable: true,
        models: [
          { name: "gpt-oss-20b-mxfp4:default", status: "running" },
          { name: "gemma", status: "stopped" },
          { name: "mmproj-F16.gguf", status: "running", path: "/models/qwen/mmproj-F16.gguf" },
          { name: "projector.gguf", status: "running", path: "/models/qwen/mmproj/projector.gguf" },
        ],
      },
    ]);

    expect(models.map((model) => model.name)).toEqual([
      "gpt-oss-20b-mxfp4:default",
      "gemma",
      "mmproj-F16.gguf",
      "projector.gguf",
    ]);
    expect(runningChatModelOptions(models).map((model) => model.name)).toEqual(["gpt-oss-20b-mxfp4:default"]);
  });
});
