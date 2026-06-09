import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { createEmbeddings } from "../../api/embeddings";
import { listModels } from "../../api/models";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { DataTable, ErrorBanner, FormField, Panel } from "../../components/ui";
import type { LocalModel } from "../../types/models";
import type { EmbeddingRow, EmbeddingsResult, DisplayEmbeddingRow, SimilarityRow } from "../../types/embeddings";
import { modelName } from "../../features/models";

function asModels(payload: unknown): LocalModel[] {
  if (Array.isArray(payload)) return payload as LocalModel[];
  return (payload as { models?: LocalModel[] } | null)?.models || [];
}

function parseInputLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function vector(row: EmbeddingRow) {
  return Array.isArray(row.embedding) ? row.embedding : [];
}

function rowId(row: EmbeddingRow, index: number) {
  return String(row.id ?? row.index ?? index);
}

function usageLabel(result: EmbeddingsResult | null) {
  const usage = result?.usage || {};
  return `prompt=${String(usage.prompt_tokens ?? "-")}, total=${String(usage.total_tokens ?? "-")}`;
}

function vectorPreview(values: number[]) {
  return `${JSON.stringify(values.slice(0, 8))}${values.length > 8 ? " ..." : ""}`;
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i] || 0);
    const bv = Number(b[i] || 0);
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  return JSON.stringify(String(value ?? ""));
}

function quickClusters(vectors: number[][]) {
  const k = Math.min(3, vectors.length);
  const centroids = vectors.slice(0, k).map((current) => [...current]);
  const assignments = new Array(vectors.length).fill(0);
  for (let iter = 0; iter < 5; iter += 1) {
    for (let i = 0; i < vectors.length; i += 1) {
      let best = 0;
      let bestScore = -Infinity;
      for (let c = 0; c < k; c += 1) {
        const score = cosineSimilarity(vectors[i], centroids[c]);
        if (score > bestScore) {
          best = c;
          bestScore = score;
        }
      }
      assignments[i] = best;
    }
    for (let c = 0; c < k; c += 1) {
      const members = vectors.filter((_, index) => assignments[index] === c);
      if (!members.length) continue;
      const mean = new Array(members[0].length).fill(0);
      for (const member of members) {
        for (let i = 0; i < member.length; i += 1) mean[i] += Number(member[i] || 0);
      }
      centroids[c] = mean.map((value) => value / members.length);
    }
  }
  return Array.from({ length: k }, (_, cluster) => ({
    cluster,
    size: assignments.filter((value) => value === cluster).length,
    members: assignments.map((value, index) => ({ value, index })).filter((item) => item.value === cluster).map((item) => item.index),
  }));
}

export function EmbeddingsPage() {
  const { data: models, error, setError } = useAsyncResource<LocalModel[]>(
    () => listModels().then(asModels),
    [],
  );
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(modelName(models[0]));
    }
  }, [models, selectedModel]);
  const [target, setTarget] = useState("auto");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<EmbeddingsResult | null>(null);
  const [submittedLines, setSubmittedLines] = useState<string[]>([]);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [similarities, setSimilarities] = useState<SimilarityRow[]>([]);
  const [clusterOutput, setClusterOutput] = useState("No clustering run yet.");
  const [status, setStatus] = useState("Ready");

  const rows = useMemo(() => result?.data || [], [result]);
  const displayRows = useMemo(() => rows.map((row, index) => ({ row, input: submittedLines[index] || "-", index })), [rows, submittedLines]);
  const vectors = useMemo(() => rows.map(vector), [rows]);

  async function runEmbeddings() {
    const lines = parseInputLines(input);
    if (!selectedModel) {
      setError("Select an embeddings model.");
      return;
    }
    if (!lines.length) {
      setError("Enter at least one line.");
      return;
    }
    setError("");
    setStatus("Running embeddings...");
    const payload = await createEmbeddings(selectedModel, { input: lines, target });
    setSubmittedLines(lines);
    setResult(payload as EmbeddingsResult);
    setSimilarities([]);
    setClusterOutput("No clustering run yet.");
    setStatus("Embeddings ready");
  }

  function similarityRows(includeAnchor: boolean) {
    const anchor = Number(anchorIndex);
    if (!vectors.length) {
      setError("Run embeddings first.");
      return [];
    }
    if (!Number.isInteger(anchor) || anchor < 0 || anchor >= vectors.length) {
      setError("Anchor index out of range.");
      return [];
    }
    setError("");
    return vectors
      .map((item, index) => ({ index, id: rowId(rows[index], index), score: cosineSimilarity(vectors[anchor], item) }))
      .filter((item) => includeAnchor || item.index !== anchor)
      .sort((a, b) => b.score - a.score)
      .slice(0, includeAnchor ? vectors.length : 10)
      .map((item, rank) => ({ rank: rank + 1, ...item }));
  }

  function computeSimilarity() {
    setSimilarities(similarityRows(true));
  }

  function computeNearestNeighbors() {
    setSimilarities(similarityRows(false));
  }

  function runQuickClusters() {
    if (!vectors.length) {
      setError("Run embeddings first.");
      return;
    }
    setError("");
    setClusterOutput(JSON.stringify(quickClusters(vectors), null, 2));
  }

  function exportJson() {
    if (!result) {
      setError("Run embeddings first.");
      return;
    }
    downloadText("embeddings.json", JSON.stringify(result, null, 2), "application/json");
  }

  function exportCsv() {
    if (!result) {
      setError("Run embeddings first.");
      return;
    }
    const output = ["index,input,id,object,model,dimensions,prompt_tokens,total_tokens,vector_preview"];
    const usage = result.usage || {};
    rows.forEach((row, index) => {
      const values = vector(row);
      output.push([
        index,
        csvEscape(submittedLines[index] || ""),
        csvEscape(row.id ?? index),
        csvEscape(row.object ?? ""),
        csvEscape(result.model ?? row.model ?? ""),
        values.length,
        usage.prompt_tokens ?? "",
        usage.total_tokens ?? "",
        csvEscape(values.slice(0, 8).join(" ")),
      ].join(","));
    });
    downloadText("embeddings.csv", output.join("\n"), "text/csv");
  }

  return (
    <div className="embeddings-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Vectors</span><h2>Embeddings Workbench</h2></div>
        <span className="muted">Batch /v1/embeddings</span>
      </div>
      <ErrorBanner message={error} />
      <div className="split-page-layout">
        <Panel title="Batch Input" eyebrow="Line items" className="side-panel">
          <div className="side-form">
            <FormField label="Model">
              <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                {models.map((model) => <option key={modelName(model)} value={modelName(model)}>{modelName(model)}</option>)}
              </select>
            </FormField>
            <FormField label="Route">
              <select value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="auto">auto</option>
                <option value="local">local</option>
                <option value="node:mac">node:mac</option>
              </select>
            </FormField>
            <FormField label="Inputs">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={10} placeholder="One input per line" />
            </FormField>
          </div>
          <div className="stacked-actions">
            <button className="primary" type="button" onClick={() => void runEmbeddings()}>Run</button>
            <button className="primary" type="button" onClick={exportJson}>Export JSON</button>
            <button className="primary" type="button" onClick={exportCsv}>Export CSV</button>
          </div>
          <p className="muted">{status}</p>
        </Panel>

        <Panel title="Results" eyebrow="Vectors">
          <DataTable
            rows={displayRows}
            emptyMessage="No embeddings run yet."
            getRowKey={(item) => rowId(item.row, item.index)}
            columns={[
              { key: "index", header: "#", render: (item) => String(item.row.index ?? item.index) },
              { key: "input", header: "Input", render: (item) => item.input },
              { key: "id", header: "ID", render: (item) => rowId(item.row, item.index) },
              { key: "object", header: "Object", render: (item) => String(item.row.object ?? "-") },
              { key: "model", header: "Model", render: (item) => String(result?.model ?? item.row.model ?? "-") },
              { key: "dimensions", header: "Dimensions", render: (item) => String(vector(item.row).length) },
              { key: "usage", header: "Usage", render: () => usageLabel(result) },
              { key: "preview", header: "Vector preview", render: (item) => <span className="path">{vectorPreview(vector(item.row))}</span> },
            ]}
          />
        </Panel>

        <Panel title="Similarity" eyebrow="Vector analysis" className="span-all">
          <div className="chat-controls compact-controls">
            <FormField label="Anchor index">
              <input type="number" min={0} step={1} value={anchorIndex} onChange={(event) => setAnchorIndex(Number(event.target.value))} />
            </FormField>
            <button type="button" className="primary" onClick={computeSimilarity}>Compute Similarity</button>
            <button type="button" className="primary" onClick={computeNearestNeighbors}>Nearest Neighbors</button>
            <button type="button" className="primary" onClick={runQuickClusters}>Quick Clusters</button>
          </div>
          <DataTable
            rows={similarities}
            emptyMessage="Run embeddings first."
            getRowKey={(row) => `${row.rank}-${row.index}`}
            columns={[
              { key: "rank", header: "Rank", render: (row) => String(row.rank) },
              { key: "index", header: "Index", render: (row) => String(row.index) },
              { key: "id", header: "ID", render: (row) => row.id },
              { key: "score", header: "Score", render: (row) => row.score.toFixed(6) },
            ]}
          />
          <pre className="detail-json compact-json">{clusterOutput}</pre>
        </Panel>
      </div>
    </div>
  );
}
