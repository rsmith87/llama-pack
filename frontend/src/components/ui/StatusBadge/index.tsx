import "./styles.css";
import type { ReactNode } from "react";

export type Tone = "success" | "warning" | "danger" | "muted";

export function StatusBadge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}
