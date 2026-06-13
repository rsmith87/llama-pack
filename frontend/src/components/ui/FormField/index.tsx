import "./styles.css";
import type { ReactNode } from "react";

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  let classLabel = label.toLowerCase().replace(/ /g, "-");
  return (
    <label className={`form-field ${classLabel}`}>
      <span className="label">{label}</span>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}
