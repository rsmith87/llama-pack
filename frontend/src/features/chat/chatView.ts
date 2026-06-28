import type { ContextBudget } from "../../types/chat";
import type { MemorySearchResult } from "../../types/memory";

export function formatCompactTokenCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function contextBudgetSummary(budget: ContextBudget): string {
  const used = budget.prompt_tokens_estimated + budget.reserved_completion_tokens;
  return `Context: ${formatCompactTokenCount(used)} / ${formatCompactTokenCount(budget.context_window_tokens)} used · ${formatCompactTokenCount(budget.remaining_context_tokens)} left`;
}

export function contextBudgetPercent(budget: ContextBudget): number {
  return Math.min(100, Math.max(0, Math.round(budget.usage_ratio * 100)));
}

export function memoryResultLine(result: MemorySearchResult): string {
  const score = result.score == null ? "-" : result.score.toFixed(4);
  return `${score} ${result.tier || "-"} ${result.topic || "-"} ${result.text || "-"}`;
}
