import { Button } from "../../components/ui";
import type { RecommendedDownload } from "../../types/downloads";
import type { RecommendedInventory, RemoteGgufSource } from "../../types/downloads";

type RecommendationModelCardProps = {
  item: RecommendedDownload;
  inventory: RecommendedInventory;
  canSend: boolean;
  onSend: (item: RecommendedDownload, source: RemoteGgufSource) => void;
  onDownload: (item: RecommendedDownload) => void;
};

export function RecommendationModelCard({ item, inventory, canSend, onSend, onDownload }: RecommendationModelCardProps) {
  const remoteSource = inventory.remoteSource;
  return (
    <article className="model-card recommended-download-card">
      <strong>{item.title}</strong>
      <span>{item.fitLabel}</span>
      <small>{item.repoId}</small>
      <div className="recommended-download-meta">
        <span>{item.quant}</span>
        <span>{item.includeFile}</span>
        {item.mmprojFile ? <span>{item.mmprojFile}</span> : null}
        <span>{inventory.label}</span>
      </div>
      <p>{item.useCase}</p>
      <small>{item.fitReason}</small>
      <small>Path: {inventory.detail}</small>
      {inventory.status === "local" ? (
        <Button disabled>Available locally</Button>
      ) : remoteSource && canSend ? (
        <Button type="button" onClick={() => onSend(item, remoteSource)} aria-label={`Send ${item.title}`}>Send</Button>
      ) : (
        <Button type="button" onClick={() => onDownload(item)} aria-label={`Download ${item.title}`}>Download</Button>
      )}
    </article>
  );
}
