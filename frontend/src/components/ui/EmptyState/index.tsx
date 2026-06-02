import "./styles.css";
export function EmptyState({ message }: { message: string }) {
  return <p className="empty">{message}</p>;
}
