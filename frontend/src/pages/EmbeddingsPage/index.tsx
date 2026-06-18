import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { createEmbeddings } from "../../api/embeddings";
import { startDownload } from "../../api/downloads";
import { searchMemory, writeMemory } from "../../api/memory";
import { listModels } from "../../api/models";
import { getRuntimeOverview } from "../../api/runtime";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { Button, DataTable, ErrorBanner, FormField, Panel, StatusBadge } from "../../components/ui";
import { asModels, downloadText } from "../../features/shared/helpers";
import type { LocalModel } from "../../types/models";
import type { EmbeddingRow, EmbeddingsResult, MemorySearchResult, RuntimeOverview, SimilarityRow } from "../../types/index";
import { modelName } from "../../features/models";

type EmbeddingsPageData = {
  models: LocalModel[];
  overview: RuntimeOverview | null;
};

type WorkbenchRecommendation = {
  title: string;
  repoId: string;
  fitLabel: string;
  useCase: string;
};

type ControllerMemoryModel = {
  title: string;
  repoId: string;
  fitLabel: string;
  useCase: string;
};

type EmbeddingsTab = "workbench" | "setup" | "memory";

const controllerMemoryModels: ControllerMemoryModel[] = [
  {
    title: "all-MiniLM-L6-v2",
    repoId: "sentence-transformers/all-MiniLM-L6-v2",
    fitLabel: "Small default",
    useCase: "Lowest-friction controller memory model for small RAM hosts.",
  },
  {
    title: "bge-small-en-v1.5",
    repoId: "BAAI/bge-small-en-v1.5",
    fitLabel: "Small English retrieval",
    useCase: "Compact English semantic search model with stronger retrieval focus.",
  },
  {
    title: "multilingual-e5-small",
    repoId: "intfloat/multilingual-e5-small",
    fitLabel: "Small multilingual",
    useCase: "Use when controller memory needs to search across multiple languages.",
  },
];

const workbenchModels: WorkbenchRecommendation[] = [
  {
    title: "nomic-embed-text-v1.5 GGUF",
    repoId: "nomic-ai/nomic-embed-text-v1.5-GGUF",
    fitLabel: "General local embeddings",
    useCase: "Good first GGUF model for the embeddings workbench and local vector experiments.",
  },
  {
    title: "bge-small-en-v1.5 GGUF",
    repoId: "bartowski/BAAI_bge-small-en-v1.5-GGUF",
    fitLabel: "Small English GGUF",
    useCase: "Small llama.cpp-compatible embedding model for low-resource nodes.",
  },
  {
    title: "mxbai-embed-large-v1 GGUF",
    repoId: "bartowski/mixedbread-ai_mxbai-embed-large-v1-GGUF",
    fitLabel: "Stronger larger GGUF",
    useCase: "Higher-quality workbench embedding model when the node has more memory headroom.",
  },
];

function parseInputLines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function vector(row: EmbeddingRow): number[] {
  return Array.isArray(row.embedding) ? row.embedding : [];
}

function rowId(row: EmbeddingRow, index: number): string {
  return String(row.id ?? row.index ?? index);
}

function usageLabel(result: EmbeddingsResult | null): string {
  const usage = result?.usage || {};
  return `prompt=${String(usage.prompt_tokens ?? "-")}, total=${String(usage.total_tokens ?? "-")}`;
}

function vectorPreview(values: number[]): string {
  return `${JSON.stringify(values.slice(0, 8))}${values.length > 8 ? " ..." : ""}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
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

function csvEscape(value: unknown): string {
  return JSON.stringify(String(value ?? ""));
}

function quickClusters(vectors: number[][]): Array<{ cluster: number; size: number; members: number[] }> {
  const k = Math.min(3, vectors.length);
  const centroids = vectors.slice(0, k).map((current) => [...current]);
  const assignments = new Array<number>(vectors.length).fill(0);
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
      const mean = new Array<number>(members[0].length).fill(0);
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

function appModeLabel(overview: RuntimeOverview | null): string {
  return overview?.mode === "controller" ? "Controller" : overview?.mode === "agent" ? "Agent" : "Unknown";
}

function memoryTone(overview: RuntimeOverview | null): "success" | "warning" | "muted" {
  if (overview?.memory?.available) return "success";
  if (overview?.memory?.configured) return "warning";
  return "muted";
}

function routeOptions(overview: RuntimeOverview | null): string[] {
  const options = ["auto", "local"];
  if (overview?.mode !== "controller") return options;
  const nodeOptions = (overview.nodes?.items || [])
    .map((node) => String(node.name || ""))
    .filter(Boolean)
    .map((name) => `node:${name}`);
  return [...options, ...nodeOptions];
}

function memoryInstallCommand(repoId: string): string {
  return `scripts/install_embedding_model.sh ./models/embedding/${repoId.split("/").pop() || "model"}`;
}

async function loadEmbeddingsPageData(): Promise<EmbeddingsPageData> {
  const [models, overview] = await Promise.all([
    listModels().then((payload) => asModels<LocalModel>(payload)),
    getRuntimeOverview().catch(() => null),
  ]);
  return { models, overview };
}

export function EmbeddingsPage() {
  const { data, error, setError, refresh } = useAsyncResource<EmbeddingsPageData>(
    () => loadEmbeddingsPageData(),
    { models: [], overview: null },
  );
  const [selectedModel, setSelectedModel] = useState("");
  const [target, setTarget] = useState("auto");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<EmbeddingsResult | null>(null);
  const [submittedLines, setSubmittedLines] = useState<string[]>([]);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [similarities, setSimilarities] = useState<SimilarityRow[]>([]);
  const [clusterOutput, setClusterOutput] = useState("No clustering run yet.");
  const [status, setStatus] = useState("Ready");
  const [downloadStatus, setDownloadStatus] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [memoryTier, setMemoryTier] = useState<"permanent" | "durable" | "ephemeral">("durable");
  const [memoryTopic, setMemoryTopic] = useState("");
  const [memoryTags, setMemoryTags] = useState("");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryTopK, setMemoryTopK] = useState(5);
  const [memoryResults, setMemoryResults] = useState<MemorySearchResult[]>([]);
  const [memoryStatus, setMemoryStatus] = useState("");
  const [activeTab, setActiveTab] = useState<EmbeddingsTab>("workbench");

  const models = data.models;
  const overview = data.overview;
  const routes = useMemo(() => routeOptions(overview), [overview]);
  const rows = useMemo(() => result?.data || [], [result]);
  const displayRows = useMemo(() => rows.map((row, index) => ({ row, input: submittedLines[index] || "-", index })), [rows, submittedLines]);
  const vectors = useMemo(() => rows.map(vector), [rows]);
  const controllerMemoryEnabled = overview?.mode === "controller";
  const memoryAvailable = Boolean(overview?.memory?.available);

  useEffect(() => {
    if (!selectedModel && models.length > 0) setSelectedModel(modelName(models[0]));
  }, [models, selectedModel]);

  useEffect(() => {
    if (!routes.includes(target)) setTarget("auto");
  }, [routes, target]);

  async function runEmbeddings(): Promise<void> {
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

  function similarityRows(includeAnchor: boolean): SimilarityRow[] {
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

  function computeSimilarity(): void {
    setSimilarities(similarityRows(true));
  }

  function computeNearestNeighbors(): void {
    setSimilarities(similarityRows(false));
  }

  function runQuickClusters(): void {
    if (!vectors.length) {
      setError("Run embeddings first.");
      return;
    }
    setError("");
    setClusterOutput(JSON.stringify(quickClusters(vectors), null, 2));
  }

  function exportJson(): void {
    if (!result) {
      setError("Run embeddings first.");
      return;
    }
    downloadText("embeddings.json", JSON.stringify(result, null, 2), "application/json");
  }

  function exportCsv(): void {
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

  async function downloadWorkbenchModel(item: WorkbenchRecommendation): Promise<void> {
    setError("");
    setDownloadStatus(`Starting ${item.title} download...`);
    await startDownload(item.repoId, {});
    setDownloadStatus(`${item.title} download started.`);
    await refresh();
  }

  async function saveMemory(): Promise<void> {
    if (!memoryText.trim()) {
      setError("Enter memory text before writing.");
      return;
    }
    setError("");
    setMemoryStatus("Writing memory...");
    const response = await writeMemory({
      text: memoryText.trim(),
      tier: memoryTier,
      topic: memoryTopic.trim() || null,
      tags: memoryTags.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    setMemoryStatus(response.id ? `Memory written: ${response.id}` : response.detail || "Memory write completed.");
    setMemoryText("");
  }

  async function runMemorySearch(): Promise<void> {
    if (!memoryQuery.trim()) {
      setError("Enter a memory search query.");
      return;
    }
    setError("");
    setMemoryStatus("Searching memory...");
    const response = await searchMemory({ query: memoryQuery.trim(), top_k: memoryTopK });
    setMemoryResults(response.results || []);
    setMemoryStatus(`Found ${response.count} memory result${response.count === 1 ? "" : "s"}.`);
  }

  return (
    <div className="embeddings-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Vectors</span><h2>Embeddings & Memory</h2></div>
        <span className="muted">Workbench embeddings plus controller semantic memory</span>
      </div>
      <ErrorBanner message={error} />

      <div className="embedding-status-strip">
        <div><span className="muted">Mode</span><strong>{appModeLabel(overview)}</strong></div>
        <div><span className="muted">Memory</span><StatusBadge tone={memoryTone(overview)}>{memoryAvailable ? "Available" : overview?.memory?.configured ? "Configured" : "Disabled"}</StatusBadge></div>
        <div><span className="muted">Store</span><strong>{overview?.memory?.path || "-"}</strong></div>
        <div><span className="muted">Embedding model</span><strong>{overview?.memory?.embedding_model_path || "-"}</strong></div>
      </div>

      <section className="embedding-explainer" aria-label="Why embeddings matter">
        <div>
          <span className="eyebrow">Why embeddings matter</span>
          <h3>Embeddings make text searchable by meaning, not just matching words.</h3>
          <p>They are the index that lets AI systems remember, search, retrieve context, compare text, and find related ideas before a model answers.</p>
        </div>
        <div className="embedding-example">
          <span className="muted">Meaning search example</span>
          <strong>Query: What does the user prefer for answers?</strong>
          <p>Result: User prefers concise responses with code examples.</p>
        </div>
      </section>

      <div className="embedding-tabs" role="tablist" aria-label="Embeddings page sections">
        <button type="button" role="tab" aria-selected={activeTab === "workbench"} className={activeTab === "workbench" ? "active" : ""} onClick={() => setActiveTab("workbench")}>Workbench</button>
        <button type="button" role="tab" aria-selected={activeTab === "setup"} className={activeTab === "setup" ? "active" : ""} onClick={() => setActiveTab("setup")}>Model Setup</button>
        <button type="button" role="tab" aria-selected={activeTab === "memory"} className={activeTab === "memory" ? "active" : ""} onClick={() => setActiveTab("memory")}>Controller Memory</button>
      </div>

      {activeTab === "workbench" ? (
        <div className="embeddings-tab-panel" role="tabpanel" aria-label="Workbench">
          <div className="embedding-tab-intro">
            <strong>Use the workbench to see meaning search in action.</strong>
            <span>Generate vectors for sample lines, then compare similarity, nearest neighbors, and clusters to understand how related text is found.</span>
          </div>
          <div className="split-page-layout embeddings-grid">
            <Panel title="Embeddings Workbench" eyebrow="Batch /v1/embeddings" className="side-panel">
              <div className="side-form">
                <FormField label="Model">
                  <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                    {models.map((model) => <option key={modelName(model)} value={modelName(model)}>{modelName(model)}</option>)}
                  </select>
                </FormField>
                <FormField label="Route">
                  <select value={target} onChange={(event) => setTarget(event.target.value)}>
                    {routes.map((route) => <option key={route} value={route}>{route}</option>)}
                  </select>
                </FormField>
                <FormField label="Inputs">
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={10} placeholder="One input per line" />
                </FormField>
              </div>
              <div className="stacked-actions">
                <Button variant="primary" type="button" onClick={() => void runEmbeddings()}>Run</Button>
                <Button variant="ghost" type="button" onClick={exportJson}>Export JSON</Button>
                <Button variant="ghost" type="button" onClick={exportCsv}>Export CSV</Button>
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
                <Button variant="primary" type="button" onClick={computeSimilarity}>Compute Similarity</Button>
                <Button variant="primary" type="button" onClick={computeNearestNeighbors}>Nearest Neighbors</Button>
                <Button variant="primary" type="button" onClick={runQuickClusters}>Quick Clusters</Button>
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
      ) : null}

      {activeTab === "setup" ? (
        <div className="embeddings-tab-panel" role="tabpanel" aria-label="Model Setup">
        <div className="embedding-tab-intro">
          <strong>Embedding models power semantic search and retrieval.</strong>
          <span>Use small sentence-transformers models for controller memory, and GGUF models when you want routed llama.cpp embedding inference.</span>
        </div>
        <Panel title="Embedding Model Setup" eyebrow="Recommended downloads" className="span-all">
          <div className="embedding-recommendation-grid">
            <section>
              <h3>Controller memory models</h3>
              <p className="muted">Small sentence-transformers models for the controller ChromaDB memory store.</p>
              <div className="embedding-card-grid">
                {controllerMemoryModels.map((item) => (
                  <article className="embedding-model-card" key={item.repoId}>
                    <div><strong>{item.title}</strong><StatusBadge>{item.fitLabel}</StatusBadge></div>
                    <p>{item.useCase}</p>
                    <code>{memoryInstallCommand(item.repoId)}</code>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h3>Workbench GGUF models</h3>
              <p className="muted">llama.cpp-compatible embedding models for the workbench and routed node execution.</p>
              <div className="embedding-card-grid">
                {workbenchModels.map((item) => (
                  <article className="embedding-model-card" key={item.repoId}>
                    <div><strong>{item.title}</strong><StatusBadge>{item.fitLabel}</StatusBadge></div>
                    <p>{item.useCase}</p>
                    <code>{item.repoId}</code>
                    <Button variant="primary" type="button" onClick={() => void downloadWorkbenchModel(item)}>Download</Button>
                  </article>
                ))}
              </div>
            </section>
          </div>
          {downloadStatus ? <p className="muted">{downloadStatus}</p> : null}
        </Panel>
        </div>
      ) : null}

      {activeTab === "memory" ? (
        <div className="embeddings-tab-panel" role="tabpanel" aria-label="Controller Memory">
        <div className="embedding-tab-intro">
          <strong>Controller memory uses embeddings to retrieve relevant facts before chat.</strong>
          <span>The model does not need exact keyword matches. Similar meanings can retrieve the right memory even when the wording differs.</span>
        </div>
        <Panel title="Controller Memory" eyebrow="Persistent semantic store" className="span-all">
          {!controllerMemoryEnabled ? (
            <p className="muted">Controller memory is managed by the controller. This agent can still use the embeddings workbench for local vector experiments.</p>
          ) : !memoryAvailable ? (
            <p className="muted">Memory is not available on this controller. Enable memory in controller config and install a controller memory model before writing or searching memories.</p>
          ) : (
            <div className="controller-memory-grid">
              <div className="memory-form">
                <FormField label="Memory text">
                  <textarea value={memoryText} onChange={(event) => setMemoryText(event.target.value)} rows={5} placeholder="Fact or observation to remember" />
                </FormField>
                <div className="memory-inline-fields">
                  <FormField label="Tier">
                    <select value={memoryTier} onChange={(event) => setMemoryTier(event.target.value as "permanent" | "durable" | "ephemeral")}>
                      <option value="durable">durable</option>
                      <option value="permanent">permanent</option>
                      <option value="ephemeral">ephemeral</option>
                    </select>
                  </FormField>
                  <FormField label="Topic">
                    <input value={memoryTopic} onChange={(event) => setMemoryTopic(event.target.value)} placeholder="preferences" />
                  </FormField>
                  <FormField label="Tags">
                    <input value={memoryTags} onChange={(event) => setMemoryTags(event.target.value)} placeholder="comma,separated" />
                  </FormField>
                </div>
                <Button variant="primary" type="button" onClick={() => void saveMemory()}>Write Memory</Button>
              </div>
              <div className="memory-form">
                <div className="memory-inline-fields">
                  <FormField label="Search query">
                    <input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="What should memory search for?" />
                  </FormField>
                  <FormField label="Top K">
                    <input type="number" min={1} max={20} step={1} value={memoryTopK} onChange={(event) => setMemoryTopK(Number(event.target.value))} />
                  </FormField>
                </div>
                <Button variant="primary" type="button" onClick={() => void runMemorySearch()}>Search Memory</Button>
                <DataTable
                  rows={memoryResults}
                  emptyMessage="No memory search results yet."
                  getRowKey={(row, index) => row.id || String(index)}
                  columns={[
                    { key: "score", header: "Score", render: (row) => row.score == null ? "-" : row.score.toFixed(4) },
                    { key: "tier", header: "Tier", render: (row) => row.tier || "-" },
                    { key: "topic", header: "Topic", render: (row) => row.topic || "-" },
                    { key: "text", header: "Text", render: (row) => row.text || "-" },
                  ]}
                />
              </div>
            </div>
          )}
          {memoryStatus ? <p className="muted">{memoryStatus}</p> : null}
        </Panel>
        </div>
      ) : null}
    </div>
  );
}
