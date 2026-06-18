import type { LocalModel } from "./models";
import type { NodeInventoryItem } from "./nodes";

export type RuntimeDiagnostic = {
  id: string;
  severity: "warning" | "error" | string;
  message: string;
  evidence: string;
  action: string;
};

export type HealthResponse = {
  mode?: string;
  controller_url?: string | null;
  diagnostics?: RuntimeDiagnostic[];
  configured_models?: number;
  models_configured?: number;
  system?: {
    cpu_percent?: number;
    memory_percent?: number;
    vram_percent?: number | null;
  };
};

export type RuntimeOverview = {
  mode?: string;
  agent_tools?: {
    enabled?: boolean;
    tool_count?: number;
    max_iterations?: number;
    tools?: Array<{ name?: string; type?: string; description?: string }>;
  };
  memory?: {
    configured?: boolean;
    available?: boolean;
    path?: string;
    embedding_model_path?: string | null;
    auto_inject?: boolean;
    top_k?: number;
  };
  jobs?: {
    available?: boolean;
    counts?: Record<string, number>;
  };
  worker?: {
    enabled?: boolean;
    running?: boolean;
    configured_enabled?: boolean;
    controller_url?: string | null;
    node_name?: string | null;
    poll_interval_seconds?: number;
    max_jobs?: number;
    claim_url?: string | null;
    labels?: Record<string, unknown>;
    capacity?: Record<string, unknown>;
    executors?: {
      chat?: boolean;
      embeddings?: boolean;
      model_transfer?: boolean;
    };
  };
  threads?: {
    available?: boolean;
    count?: number;
  };
  nodes?: {
    available?: boolean;
    count?: number;
    items?: Array<{
      name?: string;
      url?: string;
      heartbeat_fresh?: boolean;
      heartbeat_age_seconds?: number | null;
      registration?: string;
      request_types?: string[];
      default_model?: string;
    }>;
  };
  node_runtimes?: {
    available?: boolean;
    items?: Array<{
      name?: string;
      reachable?: boolean;
      tools_enabled?: boolean;
      tool_count?: number;
      memory_configured?: boolean;
      memory_available?: boolean;
      worker_enabled?: boolean;
      worker_running?: boolean;
      worker_node_name?: string | null;
      worker_max_jobs?: number | null;
      worker_labels?: Record<string, unknown>;
      worker_capacity?: Record<string, unknown>;
      worker_executors?: {
        chat?: boolean;
        embeddings?: boolean;
        model_transfer?: boolean;
      };
    }>;
  };
  running_models?: {
    available?: boolean;
    count?: number;
    error?: string;
    items?: Array<{
      name?: string;
      port?: number;
      profile_label?: string | null;
      profile_kind?: string | null;
      resource_tier?: string | null;
    }>;
  };
  downloads?: {
    available?: boolean;
    active_count?: number;
    error?: string;
  };
};

export type DashboardData = {
  health: HealthResponse | null;
  localModels: LocalModel[];
  nodes: NodeInventoryItem[];
};
