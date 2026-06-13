import { describe, expect, it } from "vitest";
import {
  buildModelNavigatorLines,
  detectModelLine,
  detectQuantType,
  displayModelLabel,
  modelNavigatorRecordId,
  type ModelLineOverride,
  type ModelNavigatorRecord,
} from "../features/models/modelNavigator";

function record(partial: Partial<ModelNavigatorRecord>): ModelNavigatorRecord {
  return {
    id: partial.id || partial.filename || partial.name || "file-1",
    filename: partial.filename,
    name: partial.name,
    path: partial.path,
    model_dir: partial.model_dir,
    registered: partial.registered,
    registered_as: partial.registered_as,
    size_bytes: partial.size_bytes,
    running: partial.running,
  };
}

describe("model navigator parsing", () => {
  it("detects specific generation lines from filename and folder metadata", () => {
    expect(detectModelLine(record({ filename: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf" }))).toBe("Qwen3");
    expect(detectModelLine(record({ model_dir: "Meta-Llama-3.3-70B-Instruct", filename: "model-Q4_K_M.gguf" }))).toBe("Llama 3.3");
    expect(detectModelLine(record({ path: "/models/deepseek-r1/DeepSeek-R1-Distill-Qwen-14B-Q8_0.gguf" }))).toBe("DeepSeek R1");
    expect(detectModelLine(record({ model_dir: "Mistral-Small-3.1-24B-Instruct-2503" }))).toBe("Mistral Small 3.1");
  });

  it("falls back to Other for ambiguous records", () => {
    expect(detectModelLine(record({ filename: "custom-local-model-Q4_K_M.gguf" }))).toBe("Other");
  });

  it("detects quant suffixes without treating model sizes as quants", () => {
    expect(detectQuantType("Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf")).toBe("Q4_K_M");
    expect(detectQuantType("llama-3.3-70b.Q8_0.gguf")).toBe("Q8_0");
    expect(detectQuantType("qwen3-8b-instruct.gguf")).toBeNull();
  });

  it("removes line and quant noise from display model labels", () => {
    expect(displayModelLabel(record({ filename: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf" }), "Qwen3")).toBe("Coder 30B A3B Instruct");
    expect(displayModelLabel(record({ filename: "Meta-Llama-3.3-70B-Instruct-Q8_0.gguf" }), "Llama 3.3")).toBe("70B Instruct");
  });
});

describe("buildModelNavigatorLines", () => {
  it("groups records by line, model, and quant with stable sorting", () => {
    const lines = buildModelNavigatorLines([
      record({ id: "qwen-q5", filename: "Qwen3-Coder-30B-A3B-Instruct-Q5_K_M.gguf", size_bytes: 20 }),
      record({ id: "llama-q4", filename: "Meta-Llama-3.3-70B-Instruct-Q4_K_M.gguf", registered: true, registered_as: "llama", size_bytes: 10 }),
      record({ id: "qwen-q4", filename: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf", registered: true, registered_as: "qwen", size_bytes: 30 }),
    ]);

    expect(lines.map((line) => line.label)).toEqual(["Llama 3.3", "Qwen3"]);
    const qwen = lines.find((line) => line.label === "Qwen3");
    expect(qwen?.models[0].label).toBe("Coder 30B A3B Instruct");
    expect(qwen?.models[0].registeredCount).toBe(1);
    expect(qwen?.models[0].quants.map((quant) => quant.label)).toEqual(["Q4_K_M", "Q5_K_M"]);
  });

  it("applies manual Other reclassification overrides without renaming files", () => {
    const ambiguous = record({ id: "custom-1", filename: "custom-local-model-Q4_K_M.gguf" });
    const overrides: ModelLineOverride[] = [{ recordId: modelNavigatorRecordId(ambiguous), lineLabel: "Custom Local" }];

    const lines = buildModelNavigatorLines([ambiguous], overrides);

    expect(lines.map((line) => line.label)).toEqual(["Custom Local"]);
    expect(lines[0].models[0].quants[0].file.filename).toBe("custom-local-model-Q4_K_M.gguf");
  });
});
