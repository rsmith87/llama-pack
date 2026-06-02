import type { TransferState } from "../../types/nodes";
import { Button, FormField, Modal, StatusBadge } from "../ui";

type IncludeOption = { value: string; label: string };

const DEFAULT_INCLUDE_OPTIONS: IncludeOption[] = [
  { value: "selected_with_sidecars", label: "Selected + sidecars" },
  { value: "selected_only", label: "Selected only" },
];

function transferTone(status: unknown): "success" | "warning" | "danger" | "muted" {
  const normalized = String(status || "").toLowerCase();
  if (["succeeded", "complete", "completed"].includes(normalized)) return "success";
  if (["failed", "error", "cancelled", "canceled"].includes(normalized)) return "danger";
  if (["running", "queued", "pending"].includes(normalized)) return "warning";
  return "muted";
}

type SendModelModalProps = {
  transfer: TransferState | null;
  destinationOptions: Array<{ name?: string }>;
  onClose: () => void;
  onChangeDestination: (value: string) => void;
  onChangeInclude?: (value: string) => void;
  onSubmit: () => void;
  progressText?: string;
  progressErrorDetail?: string;
  includeOptions?: IncludeOption[];
};

export function SendModelModal({
  transfer,
  destinationOptions,
  onClose,
  onChangeDestination,
  onChangeInclude,
  onSubmit,
  progressText,
  progressErrorDetail,
  includeOptions = DEFAULT_INCLUDE_OPTIONS,
}: SendModelModalProps) {
  return (
    <Modal
      title={transfer ? `Send ${transfer.modelName}` : "Send Model"}
      open={Boolean(transfer)}
      onClose={onClose}
    >
      {transfer ? (
        <div className="library-detail">
          <dl className="detail-list">
            <div><dt>Source</dt><dd>{transfer.sourceNode}</dd></div>
            <div><dt>File ID</dt><dd>{transfer.sourceFileId}</dd></div>
          </dl>
          <div className="library-controls">
            <FormField label="Destination node">
              <select
                value={transfer.destinationNode}
                onChange={(event) => onChangeDestination(event.target.value)}
              >
                <option value="">Select destination</option>
                {destinationOptions.map((node) => (
                  <option key={node.name} value={node.name}>{node.name}</option>
                ))}
              </select>
            </FormField>
            {includeOptions.length > 1 && onChangeInclude ? (
              <FormField label="Include files">
                <select
                  value={transfer.include}
                  onChange={(event) => onChangeInclude(event.target.value)}
                >
                  {includeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>
            ) : null}
          </div>
          {transfer.status ? (
            <div className="transfer-status">
              <StatusBadge tone={transferTone(transfer.status.status)}>
                {String(transfer.status.status || "queued")}
              </StatusBadge>
              <span className="muted">
                {String(transfer.status.source_node || transfer.sourceNode)} to{" "}
                {String(transfer.status.destination_node || transfer.destinationNode)}
              </span>
              {progressText ? <span className="muted">{progressText}</span> : null}
              {progressErrorDetail ? <span className="muted">{progressErrorDetail}</span> : null}
            </div>
          ) : null}
          <div className="modal-actions">
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!transfer.destinationNode || transfer.destinationNode === transfer.sourceNode || transfer.submitting}
            >
              {transfer.submitting ? "Sending" : "Send Model"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
