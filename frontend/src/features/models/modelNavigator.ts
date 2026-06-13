export type ModelNavigatorRecord = Record<string, unknown> & {
  id?: string;
  file_id?: string;
  filename?: string;
  name?: string;
  path?: string;
  model_dir?: string;
  repo_id?: string;
  model_id?: string;
  registered?: boolean;
  registered_as?: string | null;
  size_bytes?: number;
  size_gb?: number;
  running?: boolean;
};

export type ModelLineOverride = {
  recordId: string;
  lineLabel: string;
};

export type ModelNavigatorQuant<T extends ModelNavigatorRecord = ModelNavigatorRecord> = {
  id: string;
  label: string;
  file: T;
  quantType: string | null;
  status: "running" | "configured" | "available" | "file-only" | "unknown";
};

export type ModelNavigatorModel<T extends ModelNavigatorRecord = ModelNavigatorRecord> = {
  id: string;
  label: string;
  sourceLabel: string;
  quants: ModelNavigatorQuant<T>[];
  registeredCount: number;
  totalSizeGb: number;
};

export type ModelNavigatorLine<T extends ModelNavigatorRecord = ModelNavigatorRecord> = {
  id: string;
  label: string;
  models: ModelNavigatorModel<T>[];
};

const OTHER_LINE = "Other";
const QUANT_SUFFIX =
  /(?:^|[-._])((?:Q[2-8](?:_[0-9A-Z]+)*)|(?:IQ[1-4](?:_[0-9A-Z]+)*)|(?:TQ[1-2](?:_[0-9A-Z]+)*))(?=\.gguf$|[-._]|$)/i;

const LINE_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/\bqwen[-_\s]?(?:v?)(\d+(?:\.\d+)?)\b/i, (match) => `Qwen${match[1]}`],
  [/\b(?:meta[-_\s]?)?llama[-_\s]?(\d+(?:\.\d+)?)\b/i, (match) => `Llama ${match[1]}`],
  [/\bdeepseek[-_\s]?r1\b/i, () => "DeepSeek R1"],
  [/\bmistral[-_\s]?small[-_\s]?(\d+(?:\.\d+)?)\b/i, (match) => `Mistral Small ${match[1]}`],
  [/\bgemma[-_\s]?(\d+(?:\.\d+)?)\b/i, (match) => `Gemma ${match[1]}`],
  [/\bphi[-_\s]?(\d+(?:\.\d+)?)\b/i, (match) => `Phi ${match[1]}`],
];

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeWhitespace(value: string): string {
  return value.replace(/[_/]+/g, " ").replace(/[-]+/g, " ").replace(/\s+/g, " ").trim();
}

function sourceCandidates(record: ModelNavigatorRecord): string[] {
  return [
    text(record.repo_id),
    text(record.model_id),
    text(record.model_dir),
    text(record.registered_as),
    text(record.name),
    text(record.filename),
    text(record.path),
  ].filter(Boolean);
}

export function modelNavigatorRecordId(record: ModelNavigatorRecord): string {
  return String(record.id || record.file_id || record.path || record.filename || record.name || "unknown");
}

export function detectQuantType(value: string): string | null {
  const match = value.match(QUANT_SUFFIX);
  return match?.[1]?.toUpperCase() || null;
}

export function detectModelLine(record: ModelNavigatorRecord): string {
  for (const candidate of sourceCandidates(record)) {
    const normalized = normalizeWhitespace(candidate);
    for (const [pattern, label] of LINE_PATTERNS) {
      const match = normalized.match(pattern);
      if (match) {
        return label(match);
      }
    }
  }
  return OTHER_LINE;
}

function baseName(record: ModelNavigatorRecord): string {
  const raw =
    text(record.name) || text(record.filename) || text(record.registered_as) || text(record.path) || modelNavigatorRecordId(record);
  const last = raw.split(/[\\/]/).filter(Boolean).pop() || raw;
  return last.replace(/\.gguf$/i, "");
}

function stripLinePrefix(label: string, line: string): string {
  const normalizedLine = line.replace(/\s+/g, "[-_\\s]*");
  return label.replace(new RegExp(`^(?:meta[-_\\s]*)?${normalizedLine}[-_\\s]*`, "i"), "");
}

export function displayModelLabel(record: ModelNavigatorRecord, line: string): string {
  const quant = detectQuantType(baseName(record));
  let label = baseName(record);
  if (quant) {
    label = label.replace(new RegExp(`[-._]${quant}$`, "i"), "");
  }
  label = stripLinePrefix(label, line);
  label = normalizeWhitespace(label);
  return label || baseName(record);
}

function quantStatus(record: ModelNavigatorRecord): ModelNavigatorQuant["status"] {
  if (record.running) return "running";
  if (record.registered) return "configured";
  if (record.filename || record.path) return "available";
  return "unknown";
}

function sizeGb(record: ModelNavigatorRecord): number {
  if (typeof record.size_gb === "number" && Number.isFinite(record.size_gb)) return record.size_gb;
  if (typeof record.size_bytes === "number" && Number.isFinite(record.size_bytes)) return record.size_bytes / 1024 ** 3;
  return 0;
}

function sortByLabel<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
}

export function buildModelNavigatorLines<T extends ModelNavigatorRecord>(
  records: T[],
  overrides: ModelLineOverride[] = [],
): ModelNavigatorLine<T>[] {
  const overrideEntries: Array<[string, string]> = overrides.flatMap((item) => {
    const lineLabel = item.lineLabel.trim();
    return lineLabel ? [[item.recordId, lineLabel]] : [];
  });
  const overrideMap = new Map<string, string>(overrideEntries);
  const lineMap = new Map<string, Map<string, ModelNavigatorQuant<T>[]>>();

  for (const record of records) {
    const recordId = modelNavigatorRecordId(record);
    const line = overrideMap.get(recordId) || detectModelLine(record);
    const modelLabel = displayModelLabel(record, line);
    const quantType = detectQuantType(text(record.filename) || text(record.name) || text(record.path));
    const quant: ModelNavigatorQuant<T> = {
      id: recordId,
      label: quantType || "Unknown",
      file: record,
      quantType,
      status: quantStatus(record),
    };
    if (!lineMap.has(line)) {
      lineMap.set(line, new Map());
    }
    const modelMap = lineMap.get(line)!;
    if (!modelMap.has(modelLabel)) {
      modelMap.set(modelLabel, []);
    }
    modelMap.get(modelLabel)!.push(quant);
  }

  return sortByLabel(
    Array.from(lineMap.entries()).map(([lineLabel, modelMap]) => ({
      id: lineLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other",
      label: lineLabel,
      models: sortByLabel(
        Array.from(modelMap.entries()).map(([modelLabel, quants]) => ({
          id: `${lineLabel}:${modelLabel}`,
          label: modelLabel,
          sourceLabel: modelLabel,
          quants: sortByLabel(quants),
          registeredCount: quants.filter((quant) => Boolean(quant.file.registered)).length,
          totalSizeGb: quants.reduce((total, quant) => total + sizeGb(quant.file), 0),
        })),
      ),
    })),
  );
}
