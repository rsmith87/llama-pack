export type AuditEvent = Record<string, unknown>;
export type AuditEventsResponse = { events?: AuditEvent[] };

export type ControllerJob = Record<string, unknown>;
export type JobsResponse = { jobs?: ControllerJob[] };
export type ControllerStatsResponse = Record<string, unknown>;
export type RetentionPolicyResponse = Record<string, unknown>;

/** Generic record item used in ControllerOpsPage tables. */
export type RecordItem = Record<string, unknown>;

export type JobDetail = {
  job: RecordItem;
  events: RecordItem[];
  artifacts: RecordItem[];
};
