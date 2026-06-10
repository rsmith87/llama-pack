/**
 * Extract a string field from a record, falling back to a default when the
 * value is falsy. Useful for safe display of optional API response fields.
 */
export function field(record: Record<string, unknown>, key: string, fallback = "-"): string {
  return String(record[key] || fallback);
}

/**
 * Trigger a browser download for a text blob.
 */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Normalise an API payload that may be either an array of models or an object
 * with a `models` property into a flat array.
 */
export function asModels<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  return (payload as { models?: T[] } | null)?.models || [];
}