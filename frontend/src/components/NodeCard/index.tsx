import "./styles.css";
import type { ReactNode } from "react";
import { Button, EmptyState, StatusBadge } from "../ui";

type NodeCardProps = {
  name: string;
  statusLabel?: string;
  badgeTone?: "success" | "warning" | "danger" | "muted";
  modelCount: number;
  onOpenNode?: () => void;
  emptyMessage?: string;
  children?: ReactNode;
};

export function NodeCard({ name, statusLabel, badgeTone = "muted", modelCount, onOpenNode, emptyMessage, children }: NodeCardProps) {
  return (
    <article className="controller-node-card">
      <div className="controller-node-card-header">
        <div>
          <span className="label">Node</span>
          <strong>{name}</strong>
        </div>
        {statusLabel ? (
          <StatusBadge tone={badgeTone}>{statusLabel}</StatusBadge>
        ) : null}
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
