import "./styles.css";
import type { ReactNode } from "react";

type ModelCardProps = {
  title: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function ModelCard({ title, onOpen, openLabel, meta, badges, actions, children, className = "" }: ModelCardProps) {
  return (
    <article className={`library-card ${className}`.trim()}>
      {onOpen ? (
        <button type="button" className="library-card-button" onClick={onOpen} aria-label={openLabel || "Open"}>
          <strong>{title}</strong>
          {meta}
        </button>
      ) : (
        <div className="library-card-button">
          <strong>{title}</strong>
          {meta}
        </div>
      )}
      {badges ? <div className="library-card-badges">{badges}</div> : null}
      {children}
      {actions ? <div className="model-actions">{actions}</div> : null}
    </article>
  );
}
