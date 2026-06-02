import "./styles.css";
import type { ReactNode } from "react";

export function Panel({ eyebrow, title, actions, children, className = "" }: { eyebrow?: string; title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title || eyebrow || actions ? (
        <div className="panel-title">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? <h3>{title}</h3> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
