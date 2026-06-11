import { apiGet } from "./client";
import type { ToolLoopEvalLatest } from "../types/index";

export function getToolLoopEvalLatest() {
  return apiGet<ToolLoopEvalLatest>("/runtime/tool-loop-evals/latest");
}
