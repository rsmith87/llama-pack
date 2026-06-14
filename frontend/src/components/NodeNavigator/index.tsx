import { useEffect, useMemo, useState, type ReactNode } from "react";
import "./styles.css";
import { Button, EmptyState, StatusBadge } from "../ui";
import {
  type ModelLineOverride,
  type ModelNavigatorLine,
  type ModelNavigatorModel,
  type ModelNavigatorQuant,
  type ModelNavigatorRecord,
} from "../../features/models/modelNavigator";

type DetailArgs<T extends ModelNavigatorRecord> = {
  selectedLine: ModelNavigatorLine<T> | null;
  selectedModel: ModelNavigatorModel<T> | null;
  selectedQuant: ModelNavigatorQuant<T> | null;
};

export type NodeNavigatorNode<T extends ModelNavigatorRecord> = {
  name: string;
  reachable?: boolean;
  status?: string;
  lines: ModelNavigatorLine<T>[];
};

export type NodeNavigatorProps<T extends ModelNavigatorRecord> = {
  nodes: NodeNavigatorNode<T>[];
  selectedNodeName?: string;
  onSelectNode?: (nodeName: string) => void;
  selectedQuantId?: string;
  onSelectQuant?: (quant: ModelNavigatorQuant<T>) => void;
  onReclassify?: (override: ModelLineOverride) => void;
  renderDetail?: (args: DetailArgs<T>) => ReactNode;
};

function matches(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function firstQuant<T extends ModelNavigatorRecord>(line: ModelNavigatorLine<T> | undefined): ModelNavigatorQuant<T> | null {
  return line?.models[0]?.quants[0] || null;
}

function preferredLine<T extends ModelNavigatorRecord>(lines: ModelNavigatorLine<T>[]): ModelNavigatorLine<T> | undefined {
  return (
    lines.find((line) => line.models.some((model) => model.registeredCount > 0)) ||
    lines.find((line) => line.label !== "Other") ||
    lines[0]
  );
}

function preferredNode<T extends ModelNavigatorRecord>(nodes: NodeNavigatorNode<T>[]): NodeNavigatorNode<T> | undefined {
  return (
    nodes.find((node) => node.reachable && node.lines.some((line) => line.models.length > 0)) ||
    nodes.find((node) => node.lines.length > 0) ||
    nodes[0]
  );
}

function defaultDetail<T extends ModelNavigatorRecord>(
  selectedLine: ModelNavigatorLine<T> | null,
  selectedModel: ModelNavigatorModel<T> | null,
  selectedQuant: ModelNavigatorQuant<T> | null,
  reclassifyForm: ReactNode,
) {
  if (!selectedLine || !selectedModel || !selectedQuant) {
    return <EmptyState message="Select a model to see its quants." />;
  }
  return (
    <div className="node-navigator-detail-stack">
      <div>
        <span className="eyebrow">Selected Quant</span>
        <h3>
          {selectedLine.label} · {selectedModel.label} · {selectedQuant.label}
        </h3>
      </div>
      <dl className="node-navigator-detail-grid">
        <div>
          <dt>Status</dt>
          <dd>{selectedQuant.status}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd>{String(selectedQuant.file.filename || selectedQuant.file.name || selectedQuant.id)}</dd>
        </div>
      </dl>
      {reclassifyForm}
    </div>
  );
}

export function NodeNavigator<T extends ModelNavigatorRecord>({
  nodes,
  selectedNodeName: controlledNodeName,
  onSelectNode,
  selectedQuantId,
  onSelectQuant,
  onReclassify,
  renderDetail,
}: NodeNavigatorProps<T>) {
  const initialNode = preferredNode(nodes);
  const [internalNodeName, setInternalNodeName] = useState(initialNode?.name || "");

  // Use controlled value if provided, otherwise internal state
  const selectedNodeName = controlledNodeName ?? internalNodeName;
  const setSelectedNodeName = onSelectNode ?? setInternalNodeName;

  const selectedNode = nodes.find((node) => node.name === selectedNodeName) || nodes[0] || null;
  const currentLines = selectedNode?.lines || [];

  const initialLine = preferredLine(currentLines);
  const [lineId, setLineId] = useState(initialLine?.id || "");
  const [modelId, setModelId] = useState(initialLine?.models[0]?.id || "");
  const [quantId, setQuantId] = useState(selectedQuantId || firstQuant(initialLine)?.id || "");
  const [lineQuery, setLineQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [newLineLabel, setNewLineLabel] = useState("");

  // Sync quant selection from external changes
  useEffect(() => {
    if (!selectedQuantId) {
      return;
    }
    for (const line of currentLines) {
      for (const model of line.models) {
        const quant = model.quants.find((item) => item.id === selectedQuantId);
        if (quant) {
          setLineId(line.id);
          setModelId(model.id);
          setQuantId(quant.id);
          return;
        }
      }
    }
  }, [selectedQuantId]);

  // Reset when lines change (node switches or lines refresh)
  useEffect(() => {
    if (!currentLines.some((line) => line.id === lineId)) {
      const nextLine = preferredLine(currentLines);
      setLineId(nextLine?.id || "");
      setModelId(nextLine?.models[0]?.id || "");
      setQuantId(firstQuant(nextLine)?.id || "");
    }
  }, [lineId, currentLines]);

  // Reset when node changes
  useEffect(() => {
    const nextLine = preferredLine(currentLines);
    setLineId(nextLine?.id || "");
    setModelId(nextLine?.models[0]?.id || "");
    setQuantId(firstQuant(nextLine)?.id || "");
    setLineQuery("");
    setModelQuery("");
  }, [selectedNodeName]);

  const selectedLine = currentLines.find((line) => line.id === lineId) || currentLines[0] || null;
  const selectedModel = selectedLine?.models.find((model) => model.id === modelId) || selectedLine?.models[0] || null;
  const selectedQuant = selectedModel?.quants.find((quant) => quant.id === (selectedQuantId || quantId)) || selectedModel?.quants[0] || null;

  const visibleLines = useMemo(() => currentLines.filter((line) => matches(line.label, lineQuery)), [lineQuery, currentLines]);
  const visibleModels = useMemo(
    () => (selectedLine?.models || []).filter((model) => matches(model.label, modelQuery)),
    [modelQuery, selectedLine],
  );

  function selectLine(line: ModelNavigatorLine<T>) {
    const nextQuant = firstQuant(line);
    setLineId(line.id);
    setModelId(line.models[0]?.id || "");
    setQuantId(nextQuant?.id || "");
  }

  function selectModel(model: ModelNavigatorModel<T>) {
    const nextQuant = model.quants[0] || null;
    setModelId(model.id);
    setQuantId(nextQuant?.id || "");
  }

  function selectQuant(quant: ModelNavigatorQuant<T>) {
    setQuantId(quant.id);
    onSelectQuant?.(quant);
  }

  function selectNode(node: NodeNavigatorNode<T>) {
    setSelectedNodeName(node.name);
  }

  const canReclassify = selectedLine?.label === "Other" && selectedQuant && onReclassify;
  const reclassifyForm = canReclassify ? (
    <form
      className="node-navigator-reclassify"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = newLineLabel.trim();
        if (trimmed && selectedQuant) {
          onReclassify({ recordId: selectedQuant.id, lineLabel: trimmed });
        }
        setNewLineLabel("");
      }}
    >
      <label>
        <span>New model line</span>
        <input aria-label="New model line" value={newLineLabel} onChange={(event) => setNewLineLabel(event.target.value)} />
      </label>
      <Button type="submit" disabled={!newLineLabel.trim()}>
        Reclassify
      </Button>
    </form>
  ) : null;

  if (nodes.length === 0) {
    return <EmptyState message="No nodes available." />;
  }

  return (
    <div>
      <div className="node-navigator-bar" aria-label="Node selector">
        {nodes.map((node) => (
          <button
            key={node.name}
            type="button"
            className={node.name === selectedNodeName ? "active" : ""}
            onClick={() => selectNode(node)}
          >
            <strong>{node.name}</strong>
            <span>
              {node.reachable !== undefined ? (
                <StatusBadge tone={node.reachable ? "success" : "muted"}>
                  {node.reachable ? "reachable" : "offline"}
                </StatusBadge>
              ) : null}
              {node.lines.reduce((sum, line) => sum + line.models.length, 0)} models
            </span>
          </button>
        ))}
      </div>

      <div className="node-navigator">
        <aside className="node-navigator-lines" aria-label="Model lines">
          <div className="node-navigator-pane-heading">
            <span className="eyebrow">Model Lines</span>
            <input
              aria-label="Search model lines"
              value={lineQuery}
              onChange={(event) => setLineQuery(event.target.value)}
              placeholder="Search lines..."
            />
          </div>
          <div className="node-navigator-list">
            {visibleLines.map((line) => (
              <button key={line.id} type="button" className={line.id === selectedLine?.id ? "active" : ""} onClick={() => selectLine(line)}>
                <span>{line.label}</span>
                <strong>{line.models.length}</strong>
              </button>
            ))}
          </div>
        </aside>
        <section className="node-navigator-models" aria-label="Models">
          <div className="node-navigator-pane-heading">
            <span className="eyebrow">{selectedLine?.label || "Models"}</span>
            <input
              aria-label={`Search models in ${selectedLine?.label || "selected line"}`}
              value={modelQuery}
              onChange={(event) => setModelQuery(event.target.value)}
              placeholder="Search models..."
            />
          </div>
          <div className="node-navigator-model-grid">
            {visibleModels.map((model) => (
              <button key={model.id} type="button" className={model.id === selectedModel?.id ? "active" : ""} onClick={() => selectModel(model)}>
                <strong>{model.label}</strong>
                <span>
                  {model.quants.length} quants · {model.registeredCount} configured
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="node-navigator-detail" aria-label="Selected model details">
          {selectedModel ? (
            <div className="node-navigator-quant-list">
              {selectedModel.quants.map((quant) => (
                <button key={quant.id} type="button" className={quant.id === selectedQuant?.id ? "active" : ""} onClick={() => selectQuant(quant)}>
                  <span>{quant.label}</span>
                  <StatusBadge tone={quant.status === "running" || quant.status === "configured" ? "success" : "muted"}>
                    {quant.status}
                  </StatusBadge>
                </button>
              ))}
            </div>
          ) : null}
          {renderDetail ? renderDetail({ selectedLine, selectedModel, selectedQuant }) : defaultDetail(selectedLine, selectedModel, selectedQuant, reclassifyForm)}
          {renderDetail ? reclassifyForm : null}
        </section>
      </div>
    </div>
  );
}