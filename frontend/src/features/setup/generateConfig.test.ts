import { describe, expect, it } from "vitest";
import { generateCommands, generateConfig } from "./generateConfig";
import type { WizardState } from "./types";

function baseState(): WizardState {
  return {
    mode: "controller",
    controllerIdentity: {
      log_dir: "./logs",
      controller_registration_key: "",
      node_heartbeat_timeout_seconds: "90",
      controller_instance_id: "",
    },
    controllerFirstNode: {
      enabled: false,
      node_name: "",
      agent_url: "",
      agent_api_key: "",
      default_model: "",
    },
    controllerMemory: {
      enabled: false,
      path: "./logs/agent_memory",
      embedding_model_path: "./models/embedding/all-MiniLM-L6-v2",
      auto_inject: true,
      top_k: "3",
    },
    agentConnection: {
      controller_url: "",
      node_name: "",
      agent_url: "",
      agent_api_key: "",
      controller_registration_key_outbound: "",
    },
    agentRuntimePaths: {
      os: "macos",
      llama_server_bin: "./llama.cpp/build/bin/llama-server",
      llama_cpp_dir: "./llama.cpp",
      python_bin: "python3",
      hf_models_dir: "./models/HFModels",
      log_dir: "./logs",
    },
    agentFirstModel: {
      model_alias: "",
      path: "",
      port: "8080",
      gpu_layers: "999",
      ctx: "8192",
      strengths: ["general"],
      cost_tier: "low",
    },
    agentWorker: { enabled: false, max_jobs: "1", labels: [] },
  };
}

// ---------------------------------------------------------------------------
// Controller config
// ---------------------------------------------------------------------------

describe("generateConfig — controller", () => {
  it("emits mode: controller with required fields", () => {
    const cfg = generateConfig(baseState());
    expect(cfg).toContain("mode: controller");
    expect(cfg).toContain("log_dir: ./logs");
    expect(cfg).toContain("node_heartbeat_timeout_seconds: 90");
  });

  it("omits registration key line when field is empty", () => {
    const cfg = generateConfig(baseState());
    expect(cfg).not.toContain("controller_registration_key:");
  });

  it("includes registration key with env-var hint when set", () => {
    const state = baseState();
    state.controllerIdentity.controller_registration_key = "abc123";
    const cfg = generateConfig(state);
    expect(cfg).toContain("controller_registration_key: abc123");
    expect(cfg).toContain("CONTROLLER_REGISTRATION_KEY");
  });

  it("includes optional controller_instance_id when set", () => {
    const state = baseState();
    state.controllerIdentity.controller_instance_id = "pi-home";
    expect(generateConfig(state)).toContain("controller_instance_id: pi-home");
  });

  it("omits nodes section when first-node is disabled", () => {
    const cfg = generateConfig(baseState());
    expect(cfg).not.toContain("nodes:");
  });

  it("includes nodes section when first-node is enabled with a name", () => {
    const state = baseState();
    state.controllerFirstNode = {
      enabled: true,
      node_name: "mac-studio",
      agent_url: "http://192.168.1.20:9137",
      agent_api_key: "lm_key",
      default_model: "qwen2.5-7b",
    };
    const cfg = generateConfig(state);
    expect(cfg).toContain("nodes:");
    expect(cfg).toContain("  mac-studio:");
    expect(cfg).toContain("url: http://192.168.1.20:9137");
    expect(cfg).toContain("default_model: qwen2.5-7b");
  });

  it("omits memory section when disabled", () => {
    expect(generateConfig(baseState())).not.toContain("memory:");
  });

  it("includes memory section when enabled", () => {
    const state = baseState();
    state.controllerMemory.enabled = true;
    const cfg = generateConfig(state);
    expect(cfg).toContain("memory:");
    expect(cfg).toContain("  path: ./logs/agent_memory");
    expect(cfg).toContain("  auto_inject: true");
    expect(cfg).toContain("  top_k: 3");
  });

  it("does not include llama_server_bin or models for controller", () => {
    const cfg = generateConfig(baseState());
    expect(cfg).not.toContain("llama_server_bin");
    expect(cfg).not.toContain("models:");
  });
});

// ---------------------------------------------------------------------------
// Agent config
// ---------------------------------------------------------------------------

describe("generateConfig — agent", () => {
  it("emits mode: agent with runtime paths and model", () => {
    const state = baseState();
    state.mode = "agent";
    state.agentConnection = {
      controller_url: "http://192.168.1.10:9137",
      node_name: "mac-studio",
      agent_url: "http://192.168.1.20:9137",
      agent_api_key: "lm_agent_key",
      controller_registration_key_outbound: "regkey",
    };
    state.agentFirstModel = {
      model_alias: "qwen2.5-7b",
      path: "./models/qwen2.5-7b.gguf",
      port: "8080",
      gpu_layers: "999",
      ctx: "8192",
      strengths: ["general", "coding"],
      cost_tier: "low",
    };
    const cfg = generateConfig(state);
    expect(cfg).toContain("mode: agent");
    expect(cfg).toContain("controller_url: http://192.168.1.10:9137");
    expect(cfg).toContain("node_name: mac-studio");
    expect(cfg).toContain("llama_server_bin: ./llama.cpp/build/bin/llama-server");
    expect(cfg).toContain("hf_models_dirs:");
    expect(cfg).toContain("  - ./models/HFModels");
    expect(cfg).toContain("models:");
    expect(cfg).toContain("  qwen2.5-7b:");
    expect(cfg).toContain("      - general");
    expect(cfg).toContain("      - coding");
  });

  it("includes agent_worker fields when worker is enabled", () => {
    const state = baseState();
    state.mode = "agent";
    state.agentWorker = {
      enabled: true,
      max_jobs: "2",
      labels: [{ key: "gpu", value: "nvidia" }],
    };
    const cfg = generateConfig(state);
    expect(cfg).toContain("agent_worker_enabled: true");
    expect(cfg).toContain("agent_worker_max_jobs: 2");
    expect(cfg).toContain("  gpu: nvidia");
  });

  it("omits nodes and memory for agent mode", () => {
    const state = baseState();
    state.mode = "agent";
    const cfg = generateConfig(state);
    expect(cfg).not.toContain("nodes:");
    expect(cfg).not.toContain("memory:");
  });
});

// ---------------------------------------------------------------------------
// Standalone config
// ---------------------------------------------------------------------------

describe("generateConfig — standalone", () => {
  it("emits mode: agent without controller_url or node_name", () => {
    const state = baseState();
    state.mode = "standalone";
    const cfg = generateConfig(state);
    expect(cfg).toContain("mode: agent");
    expect(cfg).not.toContain("controller_url");
    expect(cfg).not.toContain("node_name");
    expect(cfg).toContain("llama_server_bin");
  });
});

// ---------------------------------------------------------------------------
// YAML quoting
// ---------------------------------------------------------------------------

describe("generateConfig — YAML quoting", () => {
  it("quotes values containing a colon", () => {
    const state = baseState();
    state.mode = "standalone";
    state.agentRuntimePaths.llama_server_bin = "/usr/local/bin/llama-server";
    // path contains / which is fine unquoted
    const cfg = generateConfig(state);
    expect(cfg).toContain("llama_server_bin: /usr/local/bin/llama-server");
  });

  it("quotes a value that looks like a number", () => {
    const state = baseState();
    state.mode = "standalone";
    // model alias that is all digits would need quoting
    state.agentFirstModel.model_alias = "model-7b";
    state.agentFirstModel.path = "./m.gguf";
    const cfg = generateConfig(state);
    expect(cfg).toContain("  model-7b:");
  });
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

describe("generateCommands", () => {
  it("controller includes onboard_controller.sh and start_controller.sh", () => {
    const cmds = generateCommands(baseState());
    expect(cmds).toContain("onboard_controller.sh");
    expect(cmds).toContain("start_controller.sh");
  });

  it("agent includes NODE_NAME and start_agent.sh", () => {
    const state = baseState();
    state.mode = "agent";
    state.agentConnection.node_name = "mac-studio";
    state.agentConnection.controller_url = "http://192.168.1.10:9137";
    const cmds = generateCommands(state);
    expect(cmds).toContain('NODE_NAME="mac-studio"');
    expect(cmds).toContain("onboard_agent.sh");
    expect(cmds).toContain("start_agent.sh");
  });

  it("standalone includes onboard_controller.sh and start_agent.sh", () => {
    const state = baseState();
    state.mode = "standalone";
    const cmds = generateCommands(state);
    expect(cmds).toContain("onboard_controller.sh");
    expect(cmds).toContain("start_agent.sh");
  });
});
