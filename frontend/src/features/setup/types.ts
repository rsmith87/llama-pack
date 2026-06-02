export type ModeChoice = "controller" | "agent" | "standalone";

// ---- Controller wizard state ----

export type ControllerIdentityState = {
  log_dir: string;
  controller_registration_key: string;
  node_heartbeat_timeout_seconds: string;
  controller_instance_id: string;
};

export type ControllerFirstNodeState = {
  enabled: boolean;
  node_name: string;
  agent_url: string;
  agent_api_key: string;
  default_model: string;
};

export type ControllerMemoryState = {
  enabled: boolean;
  path: string;
  embedding_model_path: string;
  auto_inject: boolean;
  top_k: string;
};

// ---- Agent wizard state ----

export type AgentConnectionState = {
  controller_url: string;
  node_name: string;
  agent_url: string;
  agent_api_key: string;
  controller_registration_key_outbound: string;
};

export type OsChoice = "macos" | "linux";

export type AgentRuntimePathsState = {
  os: OsChoice;
  llama_server_bin: string;
  llama_cpp_dir: string;
  python_bin: string;
  hf_models_dir: string;
  log_dir: string;
};

export type ModelStrength = "general" | "coding" | "research" | "vision" | "summarization";
export type CostTier = "low" | "medium" | "high";

export type AgentFirstModelState = {
  model_alias: string;
  path: string;
  port: string;
  gpu_layers: string;
  ctx: string;
  strengths: ModelStrength[];
  cost_tier: CostTier;
};

export type AgentWorkerState = {
  enabled: boolean;
  max_jobs: string;
  labels: { key: string; value: string }[];
};

// ---- Top-level wizard state ----

export type WizardState = {
  mode: ModeChoice;

  // controller
  controllerIdentity: ControllerIdentityState;
  controllerFirstNode: ControllerFirstNodeState;
  controllerMemory: ControllerMemoryState;

  // agent / standalone
  agentConnection: AgentConnectionState;
  agentRuntimePaths: AgentRuntimePathsState;
  agentFirstModel: AgentFirstModelState;
  agentWorker: AgentWorkerState;
};

// ---- Step IDs ----

export type ControllerStepId =
  | "mode"
  | "controller-identity"
  | "controller-first-node"
  | "controller-memory"
  | "admin-bootstrap"
  | "config-commands"
  | "verification";

export type AgentStepId =
  | "mode"
  | "agent-connection"
  | "agent-runtime-paths"
  | "agent-first-model"
  | "agent-worker"
  | "admin-bootstrap"
  | "config-commands"
  | "verification";

export type StandaloneStepId =
  | "mode"
  | "agent-runtime-paths"
  | "agent-first-model"
  | "admin-bootstrap"
  | "config-commands"
  | "verification";

export type StepId = ControllerStepId | AgentStepId | StandaloneStepId;

export const CONTROLLER_STEPS: ControllerStepId[] = [
  "mode",
  "controller-identity",
  "controller-first-node",
  "controller-memory",
  "admin-bootstrap",
  "config-commands",
  "verification",
];

export const AGENT_STEPS: AgentStepId[] = [
  "mode",
  "agent-connection",
  "agent-runtime-paths",
  "agent-first-model",
  "agent-worker",
  "admin-bootstrap",
  "config-commands",
  "verification",
];

export const STANDALONE_STEPS: StandaloneStepId[] = [
  "mode",
  "agent-runtime-paths",
  "agent-first-model",
  "admin-bootstrap",
  "config-commands",
  "verification",
];

export function stepsForMode(mode: ModeChoice): StepId[] {
  if (mode === "controller") return CONTROLLER_STEPS;
  if (mode === "agent") return AGENT_STEPS;
  return STANDALONE_STEPS;
}

export const STEP_LABELS: Record<StepId, string> = {
  mode: "Mode",
  "controller-identity": "Controller Identity",
  "controller-first-node": "First Agent Node",
  "controller-memory": "Memory",
  "agent-connection": "Controller Connection",
  "agent-runtime-paths": "Runtime Paths",
  "agent-first-model": "First Model",
  "agent-worker": "Job Worker",
  "admin-bootstrap": "Admin Key",
  "config-commands": "Config & Commands",
  verification: "Verify",
};

export const OPTIONAL_STEPS = new Set<StepId>([
  "controller-first-node",
  "controller-memory",
  "agent-worker",
]);
