import "./styles.css";
export function StreamingText({ text, emptyMessage = "No output yet." }: { text: string; emptyMessage?: string }) {
  return <pre className="streaming-text">{text || emptyMessage}</pre>;
}
