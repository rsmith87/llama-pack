import "./styles.css";
export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="error-text" role="alert">{message}</p>;
}
