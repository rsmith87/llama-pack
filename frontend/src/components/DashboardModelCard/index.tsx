import type { LocalModel } from "../../types/api";
import { ModelCard } from "../ModelCard";
import { Button, StatusBadge } from "../ui";
import { isActiveModel } from "../../features/models/modelStatus";
import { IoStar, IoHome, IoCheckmarkCircle, IoStop, IoPlaySharp, IoChatbubbles, IoSend, IoTerminal, IoStatsChart } from "react-icons/io5";

export function modelName(model: { name?: string; id?: string; model?: string; path?: string }): string {
  return model.name || model.id || model.model || model.path || "unnamed model";
}

export function statusTone(status: string): "success" | "warning" | "danger" | "muted" {
  const normalized = status.toLowerCase();
  if (["running", "ready", "available", "loaded"].includes(normalized)) return "success";
  if (["starting", "stopping", "loading"].includes(normalized)) return "warning";
  if (["failed", "error", "offline"].includes(normalized)) return "danger";
  return "muted";
}

function modelDetail(model: LocalModel): string {
  return model.model_path || model.path || model.model_dir || model.model || "configured model";
}

function numberLabel(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function sizeLabel(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${numberLabel(value)} B`;
}

function reasoningLabel(model: LocalModel): string | null {
  if (!model.reasoning) return null;
  if (typeof model.reasoning_budget === "number") return `${model.reasoning} / ${numberLabel(model.reasoning_budget)}`;
  return model.reasoning;
}

function modelDetails(model: LocalModel): Array<[string, string]> {
  const details: Array<[string, string | number | null | undefined]> = [
    ["Port", model.port],
    ["PID", model.pid],
    ["Context", typeof model.ctx === "number" ? numberLabel(model.ctx) : null],
    ["GPU Layers", model.gpu_layers],
    ["Host", model.host],
    ["Reasoning", reasoningLabel(model)],
    ["Template", model.prompt_template],
    ["Size", sizeLabel(model.size_bytes)],
  ];
  return details.flatMap(([label, value]) => (value || value === 0 ? [[label, String(value)]] : []));
}

type DashboardModelCardProps = {
  model: LocalModel;
  resolvedNode: string | null;
  canSend: boolean;
  actingModel: string;
  onOpen: () => void;
  onStart: () => void;
  onStop: () => void;
  onChat: () => void;
  onBenchmark: () => void;
  onTransfer?: () => void;
  onLogs?: () => void;
};

export function DashboardModelCard({ model, resolvedNode, canSend, actingModel, onOpen, onStart, onStop, onChat, onBenchmark, onTransfer, onLogs }: DashboardModelCardProps) {
  const name = modelName(model);
  const status = model.status || "available";
  const details = modelDetails(model);
  const fileId = String(model.file_id || "");
  return (
    <ModelCard
      title={name}
      onOpen={onOpen}
      openLabel={`Open ${name}`}
      className={isActiveModel(model) ? "active" : ""}
      badges={<>
        <StatusBadge tone={statusTone(status)}><IoCheckmarkCircle /> {status}</StatusBadge>
        <StatusBadge tone="muted"><IoHome /> {resolvedNode || "local"}</StatusBadge>
        {model.favorite ? <StatusBadge tone="warning"><IoStar /> favorite</StatusBadge> : null}
        {fileId ? <StatusBadge tone="muted">file {fileId}</StatusBadge> : null}
      </>}
      actions={<>
        <Button variant="success" onClick={onStart} disabled={actingModel === `start:${name}`} aria-label={`Start ${name}`}><IoPlaySharp /></Button>
        <Button variant="danger" onClick={onStop} disabled={actingModel === `stop:${name}`} aria-label={`Stop ${name}`}><IoStop /></Button>
        <Button variant="warning" onClick={onChat} aria-label={`Chat with ${name}`}><IoChatbubbles /></Button>
        <Button type="button" onClick={onBenchmark} aria-label={`Benchmark ${name}`}><IoStatsChart /></Button>
        {canSend && onTransfer ? (
          <Button variant="success" onClick={onTransfer} aria-label={`Send Model for ${name}`}><IoSend /></Button>
        ) : null}
        {onLogs ? (
          <Button type="button" onClick={onLogs} aria-label={`View logs for ${name}`}><IoTerminal /></Button>
        ) : null}
      </>}
    >
      {(details.length || modelDetail(model)) ? (
        <dl className="model-card-detail-grid">
          <div>
            <dt>Path</dt>
            <dd>{modelDetail(model)}</dd>
          </div>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </ModelCard>
  );
}
