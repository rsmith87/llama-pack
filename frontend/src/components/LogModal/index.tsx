import "./styles.css";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiStream } from "../../api/client";
import { FormField, Modal, Button } from "../ui";

type LogSource = "model" | "node-model" | "download" | "conversion" | "quantization";
export type LogSelection = {
  source: LogSource;
  identifier: string;
  node?: string;
  lines?: number;
  autoLoad?: boolean;
  requestId?: number;
};

type LogPaths = { title: string; streamPath: string; fallbackPath: string; emptyText: string };

function pathsFor(source: LogSource, identifier: string, node: string, lines: number): LogPaths {
  const encodedId = encodeURIComponent(identifier);
  const suffix = `lines=${lines}`;
  if (source === "download") {
    return { title: `download / ${identifier}`, streamPath: `/downloads/${encodedId}/logs/stream?${suffix}`, fallbackPath: `/downloads/${encodedId}/logs?${suffix}`, emptyText: "No download log output." };
  }
  if (source === "conversion") {
    return { title: `conversion / ${identifier}`, streamPath: `/conversions/${encodedId}/logs/stream?${suffix}`, fallbackPath: `/conversions/${encodedId}/logs?${suffix}`, emptyText: "No conversion log output." };
  }
  if (source === "quantization") {
    return { title: `quantization / ${identifier}`, streamPath: `/quantizations/${encodedId}/logs/stream?${suffix}`, fallbackPath: `/quantizations/${encodedId}/logs?${suffix}`, emptyText: "No quantization log output." };
  }
  if (source === "node-model") {
    const encodedNode = encodeURIComponent(node);
    return { title: `${node} / ${identifier}`, streamPath: `/nodes/${encodedNode}/logs/${encodedId}/stream?${suffix}`, fallbackPath: `/nodes/${encodedNode}/logs/${encodedId}?${suffix}`, emptyText: "No node log output." };
  }
  return { title: `model / ${identifier}`, streamPath: `/logs/${encodedId}/stream?${suffix}`, fallbackPath: `/logs/${encodedId}?${suffix}`, emptyText: "No log output." };
}

function parseStreamEvents(buffer: string) {
  return buffer
    .split("\n\n")
    .map((event) => {
      const lines = event.split("\n");
      const name = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
      const data = lines.find((line) => line.startsWith("data:"))?.slice(5).trim();
      return { name, data };
    })
    .filter((event) => event.name === "chunk" && event.data);
}

export function LogModal({ open, onClose, initialSelection }: { open: boolean; onClose: () => void; initialSelection?: LogSelection | null }) {
  const [source, setSource] = useState<LogSource>("model");
  const [identifier, setIdentifier] = useState("");
  const [node, setNode] = useState("");
  const [lines, setLines] = useState(200);
  const [title, setTitle] = useState("Select a log source");
  const [output, setOutput] = useState("No logs loaded.");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLPreElement | null>(null);
  const hasPinnedSelection = Boolean(initialSelection?.source && initialSelection?.identifier);

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  useEffect(() => () => stopStream(), []);

  useEffect(() => {
    if (!open || !initialSelection) return;
    const nextSource = initialSelection.source;
    const nextIdentifier = initialSelection.identifier;
    const nextNode = initialSelection.node || "";
    const nextLines = initialSelection.lines ?? 200;
    setSource(nextSource);
    setIdentifier(nextIdentifier);
    setNode(nextNode);
    setLines(nextLines);
    if (initialSelection.autoLoad && nextIdentifier.trim()) {
      // Kick off load immediately when dashboard opens the modal for a specific model.
      queueMicrotask(() => {
        void loadLogs(nextSource, nextIdentifier, nextNode, nextLines);
      });
    }
  }, [open, initialSelection]);

  useEffect(() => {
    if (!open) return;
    const outputElement = outputRef.current;
    if (!outputElement) return;
    outputElement.scrollTop = outputElement.scrollHeight;
  }, [open, output]);

  async function loadLogs(
    nextSource: LogSource = source,
    nextIdentifier: string = identifier,
    nextNode: string = node,
    nextLines: number = lines,
  ) {
    stopStream();
    setError("");
    if (!nextIdentifier.trim()) {
      setError("Enter a log identifier.");
      return;
    }
    if (nextSource === "node-model" && !nextNode.trim()) {
      setError("Enter a node name.");
      return;
    }
    const paths = pathsFor(nextSource, nextIdentifier.trim(), nextNode.trim(), nextLines);
    setTitle(paths.title);
    setOutput("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reader = await apiStream(paths.streamPath, { signal: controller.signal });
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const event of parseStreamEvents(parts.join("\n\n"))) {
          try {
            const payload = JSON.parse(event.data || "{}");
            setOutput((current) => `${current}${String(payload.text || "")}`);
          } catch {
            setOutput((current) => `${current}${event.data || ""}`);
          }
        }
        if (done) break;
      }
      if (buffer.trim()) {
        for (const event of parseStreamEvents(buffer)) {
          try {
            const payload = JSON.parse(event.data || "{}");
            setOutput((current) => `${current}${String(payload.text || "")}`);
          } catch {
            setOutput((current) => `${current}${event.data || ""}`);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        const payload = await apiGet<Record<string, unknown>>(paths.fallbackPath);
        const result = payload.result as Record<string, unknown> | undefined;
        setOutput(String(payload.text || result?.text || paths.emptyText));
      } catch (fallbackErr) {
        setOutput(paths.emptyText);
        setError(fallbackErr instanceof Error ? fallbackErr.message : "Failed to load logs");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function close() {
    stopStream();
    onClose();
  }

  return (
    <Modal title="Recent Logs" open={open} onClose={close}>
      <div className="log-modal-controls">
        {!hasPinnedSelection ? (
          <FormField label="Source">
            <select value={source} onChange={(event) => setSource(event.target.value as LogSource)}>
              <option value="model">Model</option>
              <option value="node-model">Node model</option>
              <option value="download">Download</option>
              <option value="conversion">Conversion</option>
              <option value="quantization">Quantization</option>
            </select>
          </FormField>
        ) : null}
        {source === "node-model" ? (
          <FormField label="Node">
            <input value={node} onChange={(event) => setNode(event.target.value)} placeholder="node name" />
          </FormField>
        ) : null}
        {!hasPinnedSelection ? (
          <FormField label="Identifier">
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="model, download id, or file id" />
          </FormField>
        ) : null}
        <FormField label="Lines">
          <input type="number" min={1} max={2000} value={lines} onChange={(event) => setLines(Number(event.target.value))} />
        </FormField>
        <button type="button" onClick={() => void loadLogs()}>Load Logs</button>
        <Button type="button" onClick={() => setOutput("")} aria-label="Clear displayed logs">Clear Display</Button>
        <Button type="button" onClick={close} aria-label="Close logs">Close</Button>
      </div>
      <div className="muted">{title}</div>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <pre ref={outputRef} className="modal-log-output">{output || "Waiting for log output..."}</pre>
    </Modal>
  );
}
