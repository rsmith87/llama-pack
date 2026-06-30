import { describe, expect, it } from "vitest";
import { flattenNodeModels, runningNodeModelOptions } from "../../features/toolLoopEvals/viewModels";

describe("tool-loop eval model option helpers", () => {
  it("flattens all reachable node model deployments without dropdown filtering", () => {
    const models = flattenNodeModels({
      nodes: [
        {
          name: "linux-2080ti",
          reachable: true,
          models: {
            models: [
              { name: "gpt-oss-20b-mxfp4:default", status: "running" },
              { name: "mmproj-F16.gguf", status: "running", path: "/models/qwen/mmproj-F16.gguf" },
              { name: "projector.gguf", status: "running", path: "/models/qwen/mmproj/projector.gguf" },
            ],
          },
        },
      ],
    });

    expect(models.map((model) => model.name)).toEqual([
      "gpt-oss-20b-mxfp4:default",
      "mmproj-F16.gguf",
      "projector.gguf",
    ]);
    expect(models.every((model) => model.node === "linux-2080ti")).toBe(true);
  });

  it("keeps profiled running models and excludes sidecars for dropdown options", () => {
    expect(
      runningNodeModelOptions([
        { name: "gpt-oss-20b-mxfp4:default", status: "running", node: "linux-2080ti" },
        { name: "gemma", status: "stopped", node: "linux-2080ti" },
        { name: "mmproj-F16.gguf", status: "running", path: "/models/qwen/mmproj-F16.gguf", node: "linux-2080ti" },
        { name: "projector.gguf", status: "running", path: "/models/qwen/mmproj/projector.gguf", node: "linux-2080ti" },
      ]).map((model) => model.name),
    ).toEqual(["gpt-oss-20b-mxfp4:default"]);
  });
});
