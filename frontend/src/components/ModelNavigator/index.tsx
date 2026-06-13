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

export type ModelNavigatorProps<T extends ModelNavigatorRecord> = {
  lines: ModelNavigatorLine<T>[];
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
    <div className="model-navigator-detail-stack">
      <div>
        <span className="eyebrow">Selected Quant</span>
        <h3>
          {selectedLine.label} · {selectedModel.label} · {selectedQuant.label}
        </h3>
      </div>
      <dl className="model-navigator-detail-grid">
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

export function ModelNavigator<T extends ModelNavigatorRecord>({
  lines,
  selectedQuantId,
  onSelectQuant,
  onReclassify,
  renderDetail,
}: ModelNavigatorProps<T>) {
  const initialLine = preferredLine(lines);
  const [lineId, setLineId] = useState(initialLine?.id || "");
  const [modelId, setModelId] = useState(initialLine?.models[0]?.id || "");
  const [quantId, setQuantId] = useState(selectedQuantId || firstQuant(initialLine)?.id || "");
  const [lineQuery, setLineQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [newLineLabel, setNewLineLabel] = useState("");

  useEffect(() => {
    if (!selectedQuantId) {
      return;
    }
    for (const line of lines) {
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

  useEffect(() => {
    if (!lines.some((line) => line.id === lineId)) {
      const nextLine = preferredLine(lines);
      setLineId(nextLine?.id || "");
      setModelId(nextLine?.models[0]?.id || "");
      setQuantId(firstQuant(nextLine)?.id || "");
    }
  }, [lineId, lines]);

  const selectedLine = lines.find((line) => line.id === lineId) || lines[0] || null;
  const selectedModel = selectedLine?.models.find((model) => model.id === modelId) || selectedLine?.models[0] || null;
  const selectedQuant = selectedModel?.quants.find((quant) => quant.id === (selectedQuantId || quantId)) || selectedModel?.quants[0] || null;

  const visibleLines = useMemo(() => lines.filter((line) => matches(line.label, lineQuery)), [lineQuery, lines]);
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

  const canReclassify = selectedLine?.label === "Other" && selectedQuant && onReclassify;
  const reclassifyForm = canReclassify ? (
    <form
      className="model-navigator-reclassify"
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

  if (lines.length === 0) {
    return <EmptyState message="No model files found." />;
  }

  return (
    <div className="model-navigator">
      <aside className="model-navigator-lines" aria-label="Model lines">
        <div className="model-navigator-pane-heading">
          <span className="eyebrow">Model Lines</span>
          <input
            aria-label="Search model lines"
            value={lineQuery}
            onChange={(event) => setLineQuery(event.target.value)}
            placeholder="Search lines..."
          />
        </div>
        <div className="model-navigator-list">
          {visibleLines.map((line) => (
            <button key={line.id} type="button" className={line.id === selectedLine?.id ? "active" : ""} onClick={() => selectLine(line)}>
              <span>{line.label}</span>
              <strong>{line.models.length}</strong>
            </button>
          ))}
        </div>
      </aside>
      <section className="model-navigator-models" aria-label="Models">
        <div className="model-navigator-pane-heading">
          <span className="eyebrow">{selectedLine?.label || "Models"}</span>
          <input
            aria-label={`Search models in ${selectedLine?.label || "selected line"}`}
            value={modelQuery}
            onChange={(event) => setModelQuery(event.target.value)}
            placeholder="Search models..."
          />
        </div>
        <div className="model-navigator-model-grid">
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
      <section className="model-navigator-detail" aria-label="Selected model details">
        {selectedModel ? (
          <div className="model-navigator-quant-list">
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
  );
}
