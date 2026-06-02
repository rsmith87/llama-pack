export type ThreadRecord = Record<string, unknown>;
export type ThreadEventsResponse = { events?: Array<Record<string, unknown>> };

export type ThreadEvent = {
  event_type?: string;
  role?: string;
  public?: boolean;
  content?: Record<string, unknown>;
  route?: Record<string, unknown>;
  agent_node?: string;
  model?: string;
  error_detail?: string;
};
