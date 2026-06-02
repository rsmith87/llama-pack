export type BenchmarkHandoff = {
  model: string;
  target: string;
  targetNode: string;
  source: string;
};

export function benchmarkSearch(model: string, target: string, targetNode: string, source: string): string {
  const params = new URLSearchParams();
  params.set("model", model);
  params.set("target", target || "auto");
  if (targetNode) params.set("target_node", targetNode);
  params.set("source", source);
  return params.toString();
}

export function readBenchmarkHandoff(search = window.location.search): BenchmarkHandoff {
  const params = new URLSearchParams(search);
  return {
    model: params.get("model")?.trim() || "",
    target: params.get("target")?.trim() || "",
    targetNode: params.get("target_node")?.trim() || "",
    source: params.get("source")?.trim() || "",
  };
}
