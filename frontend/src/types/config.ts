import type { CurrentConfigNode } from "./nodes";
import type { RuntimeDiagnostic } from "./health";

export type SetupStatus = {
  mode: string;
  auth_bootstrap_required: boolean;
  auth_enabled: boolean;
  setup_recommended: boolean;
  diagnostics?: RuntimeDiagnostic[];
  models_count?: number;
  has_nodes?: boolean;
};

export type CurrentConfigMemory = {
  enabled: boolean;
  path: string;
  embedding_model_path: string;
  auto_inject: boolean;
  top_k: number;
};

export type CurrentConfigFirstModel = {
  alias: string;
  path: string;
  port: number;
  gpu_layers: number;
  ctx: number;
  strengths: string[];
  cost_tier: string;
};

export type CurrentConfig = {
  mode: string;
  log_dir: string;
  /** "***" if configured, "" if not */
  controller_registration_key: string;
  node_heartbeat_timeout_seconds: number;
  controller_instance_id: string;
  memory: CurrentConfigMemory;
  nodes: CurrentConfigNode[];
  controller_url: string;
  node_name: string;
  agent_url: string;
  /** "***" if configured, "" if not */
  agent_api_key: string;
  /** "***" if configured, "" if not */
  controller_registration_key_outbound: string;
  llama_server_bin: string;
  llama_cpp_dir: string;
  python_bin: string;
  hf_models_dir: string;
  agent_worker_enabled: boolean;
  agent_worker_max_jobs: number;
  agent_worker_labels: Record<string, string>;
  first_model: CurrentConfigFirstModel | null;
};

export type RoutePreviewCandidate = {
  node?: string;
  model?: string;
  source?: string;
  priority?: number;
  running?: boolean;
  available?: boolean;
  startup_needed?: boolean;
  startup_decision?: "start_now" | "defer" | string | null;
  eligible?: boolean;
  rejections?: string[];
  score?: number;
  ctx?: number | null;
  supports_json_schema?: boolean;
  strengths?: string[];
  cost_tier?: string | null;
  strength_match?: boolean;
};

export type RoutePreviewRequest = {
  task: string;
  request_type: string;
  model?: string | null;
  target?: string;
  requirements?: {
    min_context?: number | null;
    needs_json?: boolean;
    needs_tools?: boolean;
    latency?: string | null;
  };
};

export type RoutePreviewResponse = {
  selected?: {
    node?: string;
    model?: string;
    reason?: string;
    score?: number;
    startup_needed?: boolean;
    startup_decision?: "start_now" | "defer" | string | null;
  } | null;
  candidates?: RoutePreviewCandidate[];
  explanation?: string;
};
