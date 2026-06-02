import "./styles.css";
import type { ReactNode } from "react";
import { Button } from "../Button";

export function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-title">
          <h2>{title}</h2>
          <Button type="button" onClick={onClose} aria-label={`Close ${title}`}>Close</Button>
        </div>
        {children}
      </section>
    </div>
  );
}
