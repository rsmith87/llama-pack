import "./styles.css";
import type { ReactNode } from "react";
import { Button } from "../Button";

export function Drawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <aside className={`drawer ${open ? "open" : ""}`} aria-label={title} aria-hidden={open ? "false" : "true"}>
      <div className="panel-title">
        <h2>{title}</h2>
        <Button type="button" onClick={onClose}>Close</Button>
      </div>
      {children}
    </aside>
  );
}
