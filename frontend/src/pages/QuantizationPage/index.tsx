import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { listQuantizationFiles, startQuantization } from "../../api/quantizations";
import { DataTable, EmptyState, ErrorBanner, FormField, Panel, StatusBadge, Button } from "../../components/ui";
import type { QuantizationFile } from "../../types/api";

const DEFAULT_TYPES = ["Q4_K_M"];
const QUANTIZED_GGUF_SUFFIX = /(?:^|[-._])(?:Q[2-8](?:_[0-9A-Z]+)*|IQ[1-4](?:_[0-9A-Z]+)*|TQ[1-2](?:_[0-9A-Z]+)*)\.gguf$/i;

function asFiles(payload: unknown): QuantizationFile[] {
  if (Array.isArray(payload)) return payload as QuantizationFile[];
  const value = payload as { files?: QuantizationFile[] } | null;
  return value?.files || [];
}

function text(record: QuantizationFile, key: string, fallback = "-") {
  return String(record[key] || fallback);
}

function fileId(file: QuantizationFile) {
  return text(file, "id", text(file, "filename"));
}

function fileName(file: QuantizationFile) {
  return text(file, "filename", text(file, "name", fileId(file)));
}

function isAlreadyQuantizedGguf(file: QuantizationFile) {
  return QUANTIZED_GGUF_SUFFIX.test(fileName(file));
}

function sizeGb(file: QuantizationFile) {
  const size = Number(file.size_gb || 0);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function formatGb(value: number) {
  return value > 0 ? `${value.toFixed(1)} GB` : "-";
}

function supportedTypes(file: QuantizationFile) {
  return Array.isArray(file.supported_types) && file.supported_types.length ? file.supported_types.map(String) : DEFAULT_TYPES;
}

function statusText(file: QuantizationFile) {
  if (file.running) return `running pid ${text(file, "pid", "?")}`;
  return file.quantize_bin ? "ready" : "missing binary";
}

function quantTypeBits(type: string) {
  const upper = type.toUpperCase();
  if (upper.startsWith("Q2")) return 2.5;
  if (upper.startsWith("Q3")) return 3.5;
  if (upper.startsWith("Q4")) return 4.5;
  if (upper.startsWith("Q5")) return 5.5;
  if (upper.startsWith("Q6")) return 6.5;
  if (upper.startsWith("Q8")) return 8.5;
  if (upper.includes("F16")) return 16;
  return 6;
}

function throughputFactor(type: string) {
  return Number((16 / quantTypeBits(type)).toFixed(2));
}

function recommend(files: QuantizationFile[], vramGb: number, latencyGoal: string, qualityGoal: string) {
  const candidates = files.flatMap((file) => supportedTypes(file).map((type) => {
    const sourceGb = sizeGb(file);
    const estSizeGb = sourceGb * (quantTypeBits(type) / 16);
    const fits = estSizeGb <= vramGb * 0.85;
    let score = fits ? 20 : -50;
    if (latencyGoal === "low") score += throughputFactor(type) * 8;
    if (latencyGoal === "balanced") score += throughputFactor(type) * 4;
    if (qualityGoal === "high") score += quantTypeBits(type) * 1.8;
    if (qualityGoal === "max") score += quantTypeBits(type) * 2.6;
    if (qualityGoal === "balanced") score += quantTypeBits(type) * 1.2;
    return {
      file: fileName(file),
      type,
      source_gb: Number(sourceGb.toFixed(2)),
      est_size_gb: Number(estSizeGb.toFixed(2)),
      throughput_factor: throughputFactor(type),
      fits_vram: fits,
      score: Number(score.toFixed(2)),
    };
  })).sort((a, b) => b.score - a.score);

  return JSON.stringify({
    inputs: { vram_gb: vramGb, latency_goal: latencyGoal, quality_goal: qualityGoal },
    recommendation: candidates[0] || null,
    top_candidates: candidates.slice(0, 5),
    notes: [
      "Memory estimate approximates quant bits vs FP16 baseline and is not exact.",
      "Throughput factor is a relative heuristic, not measured tokens/sec.",
    ],
  }, null, 2);
}

export function QuantizationPage() {
  const [files, setFiles] = useState<QuantizationFile[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Record<string, string>>({});
  const [vramGb, setVramGb] = useState(16);
  const [latencyGoal, setLatencyGoal] = useState("balanced");
  const [qualityGoal, setQualityGoal] = useState("balanced");
  const [advisorOutput, setAdvisorOutput] = useState("Run the advisor after files load.");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setFiles(asFiles(await listQuantizationFiles()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quantization files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const rowTypes = useMemo(() => {
    const next: Record<string, string> = {};
    for (const file of files) next[fileId(file)] = selectedTypes[fileId(file)] || String(file.type || supportedTypes(file)[0]);
    return next;
  }, [files, selectedTypes]);
  const sourceFiles = useMemo(() => files.filter((file) => !isAlreadyQuantizedGguf(file)), [files]);

  async function quantize(file: QuantizationFile) {
    await startQuantization(fileId(file), { type: rowTypes[fileId(file)] || supportedTypes(file)[0] });
    await refresh();
  }

  return (
    <div className="quantization-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Optimization</span><h2>Quantization</h2></div>
        <Button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</Button>
      </div>
      <ErrorBanner message={error} />
      <div className="flex">
        <Panel title="Advisor" eyebrow="Heuristic" className="side-panel">
          <div className="stacked-controls">
            <div className="recommendation-form">
              <FormField label="Target VRAM (GB)"><input value={vramGb} onChange={(event) => setVramGb(Number(event.target.value || 0))} type="number" /></FormField>
              <FormField label="Latency Goal"><select value={latencyGoal} onChange={(event) => setLatencyGoal(event.target.value)}><option value="low">Low</option><option value="balanced">Balanced</option><option value="throughput">Throughput</option></select></FormField>
              <FormField label="Quality Goal"><select value={qualityGoal} onChange={(event) => setQualityGoal(event.target.value)}><option value="balanced">Balanced</option><option value="high">High</option><option value="max">Max</option></select></FormField>
              <Button type="button" className="btn btn-primary" onClick={() => setAdvisorOutput(recommend(sourceFiles, vramGb, latencyGoal, qualityGoal))}>Recommend</Button>
            </div>
            <pre className="detail-json">{advisorOutput}</pre>
          </div>
        </Panel>

        <Panel title="Quantization Files" eyebrow="Source GGUFs">
          {sourceFiles.length === 0 && loading ? <EmptyState message="Loading quantization files..." /> : (
            <DataTable
              rows={sourceFiles}
              emptyMessage="No GGUF files found for quantization."
              getRowKey={(row, index) => fileId(row) || String(index)}
              columns={[
                /*{ key: "model", header: "Model", render: (row) => <strong>{text(row, "model_dir")}</strong> },*/
                { key: "file", header: "File", render: (row) => fileName(row) },
                { key: "size", header: "Size", render: (row) => formatGb(sizeGb(row)) },
                { key: "type", header: "Type", render: (row) => {
                  const id = fileId(row);
                  const name = fileName(row);
                  return <select className="compact-select" aria-label={`Quant type for ${name}`} value={rowTypes[id] || supportedTypes(row)[0]} onChange={(event) => setSelectedTypes((current) => ({ ...current, [id]: event.target.value }))}>{supportedTypes(row).map((type) => <option key={type} value={type}>{type}</option>)}</select>;
                } },
                { key: "status", header: "Status", render: (row) => <StatusBadge tone={row.running ? "warning" : row.quantize_bin ? "success" : "danger"}>{statusText(row)}</StatusBadge> },
                { key: "output", header: "Output", render: (row) => text(row, "output_path") },
                { key: "actions", header: "Actions", render: (row) => {
                  const name = fileName(row);
                  return <button type="button" className="btn btn-primary" onClick={() => void quantize(row)} disabled={!row.quantize_bin || Boolean(row.running)} aria-label={`Quantize ${name}`}>Quantize</button>;
                } },
              ]}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
