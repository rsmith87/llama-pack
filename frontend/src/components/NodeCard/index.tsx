import "./styles.css";
import type { ReactNode } from "react";
import { Button, EmptyState, StatusBadge, type Tone } from "../ui";

type NodeCardProps = {
  name: string;
  statusLabel?: string;
  badgeTone?: Tone;
  certLabel?: string;
  certTone?: Tone;
  modelCount: number;
  onOpenNode?: () => void;
  emptyMessage?: string;
  children?: ReactNode;
};

export function NodeCard({
  name,
  statusLabel,
  badgeTone = "muted",
  certLabel,
  certTone = "muted",
  modelCount,
  onOpenNode,
  emptyMessage,
  children,
}: NodeCardProps) {
  return (
    <article className="controller-node-card">
      <div className="controller-node-card-header">
        <div>
          <span className="label">Node</span>
          <strong>{name}</strong>
        </div>
        <div className="controller-node-card-badges">
          {statusLabel ? <StatusBadge tone={badgeTone}>{statusLabel}</StatusBadge> : null}
          {certLabel ? <StatusBadge tone={certTone}>{certLabel}</StatusBadge> : null}
        </div>
      </div>
      <div className="node-model-summary">
        <span>{modelCount} models</span>
        {onOpenNode ? <Button type="button" onClick={onOpenNode}>Open Node</Button> : null}
      </div>
      <div className="node-model-cards">
        {modelCount === 0 ? <EmptyState message={emptyMessage ?? "No models for this node."} /> : null}
        {children}
      </div>
    </article>
  );
}
