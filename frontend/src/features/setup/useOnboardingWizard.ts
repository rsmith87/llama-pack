import { useCallback, useState } from "react";
import type { CurrentConfig } from "../../types/api";
import {
  type AgentConnectionState,
  type AgentFirstModelState,
  type AgentRuntimePathsState,
  type AgentWorkerState,
  type ControllerFirstNodeState,
  type ControllerIdentityState,
  type ControllerMemoryState,
  type ModeChoice,
  type ModelStrength,
  OPTIONAL_STEPS,
  type StepId,
  type WizardState,
  stepsForMode,
} from "./types";

const MODEL_STRENGTHS = new Set<string>(["general", "coding", "research", "vision", "summarization"]);
function toModelStrengths(raw: string[]): ModelStrength[] {
  return raw.filter((s) => MODEL_STRENGTHS.has(s)) as ModelStrength[];
}

// ---- Default state factories ----

function defaultControllerIdentity(): ControllerIdentityState {
  return {
    log_dir: "./logs",
    controller_registration_key: "",
    node_heartbeat_timeout_seconds: "90",
    controller_instance_id: "",
  };
}

function defaultControllerFirstNode(): ControllerFirstNodeState {
  return { enabled: false, node_name: "", agent_url: "", agent_api_key: "", default_model: "" };
}

function defaultControllerMemory(): ControllerMemoryState {
  return {
    enabled: false,
    path: "./logs/agent_memory",
    embedding_model_path: "./models/embedding/all-MiniLM-L6-v2",
    auto_inject: true,
    top_k: "3",
  };
}

function defaultAgentConnection(): AgentConnectionState {
  return {
    controller_url: "",
    node_name: "",
    agent_url: "",
    agent_api_key: "",
    controller_registration_key_outbound: "",
  };
}

function defaultAgentRuntimePaths(os: "macos" | "linux" = "macos"): AgentRuntimePathsState {
  if (os === "linux") {
    return {
      os: "linux",
      llama_server_bin: "/home/user/Apps/llama.cpp/build/bin/llama-server",
      llama_cpp_dir: "/home/user/Apps/llama.cpp",
      python_bin: "python3",
      hf_models_dir: "/home/user/models/HFModels",
      log_dir: "./logs",
    };
  }
  return {
    os: "macos",
    llama_server_bin: "./llama.cpp/build/bin/llama-server",
    llama_cpp_dir: "./llama.cpp",
    python_bin: "python3",
    hf_models_dir: "./models/HFModels",
    log_dir: "./logs",
  };
}

function defaultAgentFirstModel(): AgentFirstModelState {
  return {
    model_alias: "",
    path: "",
    port: "8080",
    gpu_layers: "999",
    ctx: "8192",
    strengths: ["general"],
    cost_tier: "low",
  };
}

function defaultAgentWorker(): AgentWorkerState {
  return { enabled: false, max_jobs: "1", labels: [] };
}

function buildInitialState(mode: ModeChoice): WizardState {
  return {
    mode,
    controllerIdentity: defaultControllerIdentity(),
    controllerFirstNode: defaultControllerFirstNode(),
    controllerMemory: defaultControllerMemory(),
    agentConnection: defaultAgentConnection(),
    agentRuntimePaths: defaultAgentRuntimePaths(),
    agentFirstModel: defaultAgentFirstModel(),
    agentWorker: defaultAgentWorker(),
  };
}

function buildStateFromConfig(cfg: CurrentConfig): WizardState {
  const mode: ModeChoice =
    cfg.mode === "controller" ? "controller" : cfg.controller_url ? "agent" : "standalone";

  const firstNode = (cfg.nodes ?? [])[0];

  return {
    mode,
    controllerIdentity: {
      log_dir: cfg.log_dir || "./logs",
      controller_registration_key: cfg.controller_registration_key,
      node_heartbeat_timeout_seconds: String(cfg.node_heartbeat_timeout_seconds),
      controller_instance_id: cfg.controller_instance_id,
    },
    controllerFirstNode: firstNode
      ? {
          enabled: true,
          node_name: firstNode.name,
          agent_url: firstNode.url,
          agent_api_key: firstNode.api_key,
          default_model: firstNode.default_model,
        }
      : defaultControllerFirstNode(),
    controllerMemory: {
      enabled: cfg.memory?.enabled ?? false,
      path: cfg.memory?.path || "./logs/agent_memory",
      embedding_model_path:
        cfg.memory?.embedding_model_path || "./models/embedding/all-MiniLM-L6-v2",
      auto_inject: cfg.memory?.auto_inject ?? true,
      top_k: String(cfg.memory?.top_k ?? 3),
    },
    agentConnection: {
      controller_url: cfg.controller_url,
      node_name: cfg.node_name,
      agent_url: cfg.agent_url,
      agent_api_key: cfg.agent_api_key,
      controller_registration_key_outbound: cfg.controller_registration_key_outbound,
    },
    agentRuntimePaths: {
      os: "macos" as const,
      llama_server_bin: cfg.llama_server_bin,
      llama_cpp_dir: cfg.llama_cpp_dir,
      python_bin: cfg.python_bin,
      hf_models_dir: cfg.hf_models_dir,
      log_dir: cfg.log_dir,
    },
    agentFirstModel: cfg.first_model
      ? {
          model_alias: cfg.first_model.alias,
          path: cfg.first_model.path,
          port: String(cfg.first_model.port),
          gpu_layers: String(cfg.first_model.gpu_layers),
          ctx: String(cfg.first_model.ctx),
          strengths: toModelStrengths(cfg.first_model.strengths),
          cost_tier: cfg.first_model.cost_tier as AgentFirstModelState["cost_tier"],
        }
      : defaultAgentFirstModel(),
    agentWorker: {
      enabled: cfg.agent_worker_enabled,
      max_jobs: String(cfg.agent_worker_max_jobs ?? 1),
      labels: Object.entries(cfg.agent_worker_labels ?? {}).map(([key, value]) => ({ key, value })),
    },
  };
}

// ---- Hook ----

export type WizardNav = {
  state: WizardState;
  currentStep: StepId;
  steps: StepId[];
  stepIndex: number;
  isFirst: boolean;
  isLast: boolean;
  canSkip: boolean;
  setMode: (mode: ModeChoice) => void;
  setControllerIdentity: (patch: Partial<ControllerIdentityState>) => void;
  setControllerFirstNode: (patch: Partial<ControllerFirstNodeState>) => void;
  setControllerMemory: (patch: Partial<ControllerMemoryState>) => void;
  setAgentConnection: (patch: Partial<AgentConnectionState>) => void;
  setAgentRuntimePaths: (patch: Partial<AgentRuntimePathsState>) => void;
  setAgentFirstModel: (patch: Partial<AgentFirstModelState>) => void;
  setAgentWorker: (patch: Partial<AgentWorkerState>) => void;
  seedFromConfig: (cfg: CurrentConfig) => void;
  goNext: () => void;
  goBack: () => void;
  goTo: (step: StepId) => void;
};

export function useOnboardingWizard(initialMode: ModeChoice = "controller"): WizardNav {
  const [wizardState, setWizardState] = useState<WizardState>(() =>
    buildInitialState(initialMode),
  );
  const [currentStep, setCurrentStep] = useState<StepId>("mode");

  const steps = stepsForMode(wizardState.mode);
  const stepIndex = steps.indexOf(currentStep);

  const goNext = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = steps.indexOf(prev);
      return idx < steps.length - 1 ? steps[idx + 1] : prev;
    });
  }, [steps]);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = steps.indexOf(prev);
      return idx > 0 ? steps[idx - 1] : prev;
    });
  }, [steps]);

  const goTo = useCallback((step: StepId) => setCurrentStep(step), []);

  const setMode = useCallback((mode: ModeChoice) => {
    setWizardState((prev) => ({ ...prev, mode }));
    setCurrentStep(stepsForMode(mode)[1]); // advance past "mode" step
  }, []);

  const patch = useCallback(
    <K extends keyof WizardState>(key: K, value: Partial<WizardState[K]>) => {
      setWizardState((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...value } }));
    },
    [],
  );

  return {
    state: wizardState,
    currentStep,
    steps,
    stepIndex,
    isFirst: stepIndex === 0,
    isLast: stepIndex === steps.length - 1,
    canSkip: OPTIONAL_STEPS.has(currentStep),
    setMode,
    setControllerIdentity: (p) => patch("controllerIdentity", p),
    setControllerFirstNode: (p) => patch("controllerFirstNode", p),
    setControllerMemory: (p) => patch("controllerMemory", p),
    setAgentConnection: (p) => patch("agentConnection", p),
    setAgentRuntimePaths: (p) => patch("agentRuntimePaths", p),
    setAgentFirstModel: (p) => patch("agentFirstModel", p),
    setAgentWorker: (p) => patch("agentWorker", p),
    seedFromConfig: useCallback(
      (cfg: CurrentConfig) => setWizardState(buildStateFromConfig(cfg)),
      [],
    ),
    goNext,
    goBack,
    goTo,
  };
}
