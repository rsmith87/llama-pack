export type NodeModel = {
  name?: string;
  id?: string;
  status?: string;
};

export type NodeInventoryItem = {
  node_id?: string;
  name?: string;
  status?: string;
  reachable?: boolean;
  models?: NodeModel[];
};

export type NodesResponse = {
  nodes?: NodeInventoryItem[];
};

/** A node record as seen by the controller's node inventory/config views. */
export type NodeRecord = {
  name?: string;
  url?: string;
  reachable?: boolean;
  registration?: string;
  agent_config_source?: string;
  controller_config_source?: string;
  models?: Array<Record<string, unknown>>;
  files?: Array<Record<string, unknown>>;
  models_source?: string;
  verify_tls?: boolean;
  heartbeat_fresh?: boolean;
  heartbeat_age_seconds?: number | null;
  last_heartbeat?: string;
  error?: string;
};

/** Config entry for a node (used inside CurrentConfig). */
export type CurrentConfigNode = {
  name: string;
  url: string;
  /** "***" if a key is configured, "" if not */
  api_key: string;
  default_model: string;
};

/** State for the send-to-node (model transfer) modal, shared by DashboardPage and NodesPage. */
export type TransferState = {
  sourceNode: string;
  modelName: string;
  sourceFileId: string;
  destinationNode: string;
  include: string;
  status: Record<string, unknown> | null;
  submitting: boolean;
};
