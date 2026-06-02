export type { ThreadEvent } from "../../types/threads";
import type { ThreadEvent } from "../../types/threads";

export function threadEventToChatMessage(event: ThreadEvent) {
  const content = event?.content || {};
  const text = typeof content.text === "string" ? content.text : "";
  const route = event?.route || {};
  if (event?.event_type === "user_message") {
    return {
      role: "user",
      content: text,
      threadEventType: event.event_type,
    };
  }
  if (event?.event_type === "assistant_message") {
    return {
      role: "assistant",
      content: text,
      threadEventType: event.event_type,
      routeMeta: {
        model: event.model || String(route.model || ""),
        target: event.agent_node ? `node:${event.agent_node}` : "",
        resolved: event.agent_node || String(route.node || ""),
        reason: String(route.reason || ""),
      },
    };
  }
  if (event?.event_type === "routing_decision") {
    return {
      role: "internal",
      content: formatRoutingDecision(event),
      threadEventType: event.event_type,
      routeMeta: {
        model: event.model || String(route.model || ""),
        target: event.agent_node ? `node:${event.agent_node}` : "",
        resolved: event.agent_node || String(route.node || ""),
        reason: String(route.reason || ""),
      },
    };
  }
  if (event?.event_type === "error") {
    return {
      role: "error",
      content: event.error_detail || text || "Thread request failed",
      threadEventType: event.event_type,
    };
  }
  return {
    role: event?.public === false ? "internal" : event?.role || "assistant",
    content: text || JSON.stringify(content, null, 2),
    threadEventType: event?.event_type || "event",
  };
}

export function threadEventsToChatMessages(events: ThreadEvent[] = []) {
  return events.map(threadEventToChatMessage);
}

export function buildThreadMetadata({ app, purpose, priority, requestType }: { app?: string; purpose?: string; priority?: string; requestType?: string }) {
  return {
    app: normalizeOptional(app),
    purpose: normalizeOptional(purpose),
    priority: priority || "medium",
    request_type: requestType || "general",
  };
}

function normalizeOptional(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function formatRoutingDecision(event: ThreadEvent) {
  const route = event.route || {};
  const content = event.content || {};
  const candidates = content.candidates;
  const parts = [
    route.node || content.node ? `node=${String(route.node || content.node)}` : null,
    route.model || content.model ? `model=${String(route.model || content.model)}` : null,
    route.reason || content.reason ? `reason=${String(route.reason || content.reason)}` : null,
    Array.isArray(candidates) ? `candidates=${candidates.length}` : null,
  ].filter(Boolean);
  return parts.length ? `routing_decision ${parts.join(" ")}` : "routing_decision";
}
