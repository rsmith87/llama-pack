import "./styles.css";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui";

type ModelWorkflowItem = {
  label: string;
  eyebrow: string;
  path: string;
  summary: string;
};

const workflowItems: ModelWorkflowItem[] = [
  {
    label: "Acquire",
    eyebrow: "Download",
    path: "/ui/hf-downloads",
    summary: "Find Hugging Face repositories, queue downloads, and review download history.",
  },
  {
    label: "Convert",
    eyebrow: "HF to GGUF",
    path: "/ui/hf-to-gguf",
    summary: "Convert downloaded model directories into GGUF artifacts for llama.cpp runtimes.",
  },
  {
    label: "Quantize",
    eyebrow: "Optimize",
    path: "/ui/quantization",
    summary: "Create smaller GGUF variants from source files for latency, VRAM, and quality targets.",
  },
  {
    label: "Library",
    eyebrow: "Inventory",
    path: "/ui/gguf-library",
    summary: "Inspect local GGUF files, registration state, metadata, and model handoffs.",
  },
  {
    label: "Evaluate",
    eyebrow: "Benchmarks",
    path: "/ui/benchmarks",
    summary: "Run and compare benchmark suites for registered models and target nodes.",
  },
];

export function ModelsPage() {
  return (
    <div className="models-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Model Lifecycle</span>
          <h2>Models</h2>
        </div>
      </div>

      <Panel title="Workflow" eyebrow="Lifecycle">
        <div className="model-workflow-grid">
          {workflowItems.map((item, index) => (
            <Link className="model-workflow-card" to={item.path} key={item.path}>
              <span className="workflow-index">{index + 1}</span>
              <span className="workflow-copy">
                <span className="eyebrow">{item.eyebrow}</span>
                <strong>{item.label}</strong>
                <span>{item.summary}</span>
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
