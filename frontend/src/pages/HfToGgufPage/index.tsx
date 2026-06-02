import "./styles.css";
import { useEffect, useState } from "react";
import { listConversions, startConversion } from "../../api/conversions";
import { DataTable, EmptyState, ErrorBanner, Panel, StatusBadge, Button } from "../../components/ui";
import type { ConversionRecord } from "../../types/api";

function asConversions(payload: unknown): ConversionRecord[] {
  if (Array.isArray(payload)) return payload as ConversionRecord[];
  const value = payload as { models?: ConversionRecord[]; conversions?: ConversionRecord[] } | null;
  return value?.models || value?.conversions || [];
}

function text(record: ConversionRecord, key: string, fallback = "-") {
  return String(record[key] || fallback);
}

function statusText(model: ConversionRecord) {
  if (model.running) return `running pid ${text(model, "pid", "?")}`;
  return model.convertible ? "ready" : "not convertible";
}

function ggufLabel(model: ConversionRecord) {
  const files = Array.isArray(model.gguf_files) ? model.gguf_files : [];
  return files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "missing";
}

export function HfToGgufPage() {
  const [models, setModels] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setModels(asConversions(await listConversions()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load convertible HF models");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function convert(name: string) {
    await startConversion(name, undefined);
    await refresh();
  }

  return (
    <div className="hf-to-gguf-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Conversion</span><h2>HF to GGUF</h2></div>
        <Button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</Button>
      </div>
      <ErrorBanner message={error} />
      <Panel title="Convertible HF Models" eyebrow="Source models">
        {models.length === 0 && loading ? <EmptyState message="Loading convertible HF models..." /> : (
          <DataTable
            rows={models}
            emptyMessage="No convertible HF models found."
            getRowKey={(row, index) => text(row, "name", String(index))}
            columns={[
              { key: "name", header: "Model", render: (row) => <strong>{text(row, "name")}</strong> },
              { key: "status", header: "Status", render: (row) => <StatusBadge tone={row.running ? "warning" : row.convertible ? "success" : "danger"}>{statusText(row)}</StatusBadge> },
              { key: "gguf", header: "GGUF", render: ggufLabel },
              { key: "path", header: "Path", render: (row) => text(row, "path") },
              { key: "output", header: "Output", render: (row) => text(row, "output_path") },
              { key: "python", header: "Python", render: (row) => text(row, "python_bin") },
              { key: "actions", header: "Actions", render: (row) => {
                const name = text(row, "name");
                const canConvert = Boolean(row.convertible) && !row.running;
                return <div className="actions"><Button type="button" onClick={() => void convert(name)} disabled={!canConvert} aria-label={`Convert ${name}`}>Convert</Button></div>;
              } },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
