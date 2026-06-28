import type { DocumentCitation } from "./chat";

export type ThreadRecord = Record<string, unknown>;
export type ThreadEventsResponse = { events?: ThreadEvent[] };

export type ThreadEvent = {
  event_type?: string;
  role?: string;
  public?: boolean;
  content?: {
    text?: string;
    reasoning_text?: string;
    document_citations?: DocumentCitation[];
    [key: string]: unknown;
  };
  route?: Record<string, unknown>;
  agent_node?: string;
  model?: string;
  error_detail?: string;
};
