export function parseJsonObject(value: string, label: string): Record<string, string | number | boolean | null> {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} must be a JSON object.`);
  }
  for (const entry of Object.values(parsed)) {
    if (entry !== null && typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean") {
      throw new Error(`${label} values must be strings, numbers, booleans, or null.`);
    }
  }
  return parsed as Record<string, string | number | boolean | null>;
}

export function parseJsonRecord(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

export function safeRootsText(value: string[] | undefined): string {
  return (value || []).join("\n");
}

export function modelRootRows(value: string[] | undefined): string[] {
  const roots = [...(value || [])];
  return roots.length > 0 ? roots : [""];
}

export function normalizedModelRoots(value: string[]): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const root = item.trim();
    if (!root || seen.has(root)) continue;
    roots.push(root);
    seen.add(root);
  }
  return roots;
}

export function jsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function summaryValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(" ");
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = -1;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(amount >= 10 || unitIndex <= 0 ? 0 : 1)} ${units[unitIndex]}`;
}
