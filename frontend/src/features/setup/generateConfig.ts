import type { WizardState } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Placeholder used when seeding wizard fields from an existing config. */
export const REDACTED = "***";

/**
 * Emit a secret field line, handling the REDACTED placeholder.
 * - Real value  → yaml assignment with inline env-var hint
 * - REDACTED    → commented-out line noting the key is kept from existing config
 * - Empty       → nothing emitted
 */
function secretLine(key: string, value: string, envVar: string): string | null {
  if (!value) return null;
  if (value === REDACTED) return `# ${key}: (configured — kept from existing config.yaml)`;
  return `${key}: ${yamlStr(value)}  # consider: \${${envVar}}`;
}

/** Quote a string value when YAML would misparse it without quotes. */
function yamlStr(val: string): string {
  if (
    val === "" ||
    /^(true|false|yes|no|null|~)$/i.test(val) ||
    /^\d/.test(val) ||
    val.startsWith(" ") ||
    val.endsWith(" ") ||
    /: /.test(val) ||        // colon-space = key-value separator inside value
    val.endsWith(":") ||     // trailing colon
    /^[{[\|>&*!,?'"@`]/.test(val) || // YAML special first chars
    / #/.test(val)           // inline comment marker
  ) {
    return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return val;
}

function modelBlock(alias: string, m: WizardState["agentFirstModel"]): string[] {
  if (!alias) return [];
  const lines: string[] = [];
  lines.push(`models:`);
  lines.push(`  ${alias}:`);
  lines.push(`    path: ${yamlStr(m.path)}`);
  lines.push(`    port: ${m.port}`);
  lines.push(`    gpu_layers: ${m.gpu_layers}`);
  lines.push(`    ctx: ${m.ctx}`);
  if (m.strengths.length > 0) {
    lines.push(`    strengths:`);
    for (const s of m.strengths) lines.push(`      - ${s}`);
  }
  lines.push(`    cost_tier: ${m.cost_tier}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Per-mode generators
// ---------------------------------------------------------------------------

function controllerConfig(state: WizardState): string {
  const ci = state.controllerIdentity;
  const fn = state.controllerFirstNode;
  const mem = state.controllerMemory;

  const lines: string[] = [];

  lines.push(`mode: controller`);
  lines.push(`log_dir: ${yamlStr(ci.log_dir)}`);

  const regKeyLine = secretLine(
    "controller_registration_key",
    ci.controller_registration_key,
    "CONTROLLER_REGISTRATION_KEY",
  );
  if (regKeyLine) lines.push(regKeyLine);

  lines.push(`node_heartbeat_timeout_seconds: ${ci.node_heartbeat_timeout_seconds}`);

  if (ci.controller_instance_id) {
    lines.push(`controller_instance_id: ${yamlStr(ci.controller_instance_id)}`);
  }

  if (mem.enabled) {
    lines.push(``);
    lines.push(`memory:`);
    lines.push(`  path: ${yamlStr(mem.path)}`);
    lines.push(`  embedding_model_path: ${yamlStr(mem.embedding_model_path)}`);
    lines.push(`  auto_inject: ${mem.auto_inject}`);
    lines.push(`  top_k: ${mem.top_k}`);
  }

  if (fn.enabled && fn.node_name) {
    lines.push(``);
    lines.push(`nodes:`);
    lines.push(`  ${fn.node_name}:`);
    lines.push(`    url: ${yamlStr(fn.agent_url)}`);
    const nodeKeyLine = secretLine("    api_key", fn.agent_api_key, "AGENT_API_KEY");
    if (nodeKeyLine) lines.push(nodeKeyLine);
    if (fn.default_model) {
      lines.push(`    default_model: ${yamlStr(fn.default_model)}`);
    }
  }

  return lines.join("\n");
}

function agentConfig(state: WizardState): string {
  const ac = state.agentConnection;
  const rp = state.agentRuntimePaths;
  const fm = state.agentFirstModel;
  const aw = state.agentWorker;

  const lines: string[] = [];

  lines.push(`mode: agent`);
  if (ac.controller_url) lines.push(`controller_url: ${yamlStr(ac.controller_url)}`);
  if (ac.node_name) lines.push(`node_name: ${yamlStr(ac.node_name)}`);
  if (ac.agent_url) lines.push(`agent_url: ${yamlStr(ac.agent_url)}`);
  const agentApiKeyLine = secretLine("agent_api_key", ac.agent_api_key, "AGENT_API_KEY");
  if (agentApiKeyLine) lines.push(agentApiKeyLine);
  const regKeyOutboundLine = secretLine(
    "controller_registration_key_outbound",
    ac.controller_registration_key_outbound,
    "CONTROLLER_REGISTRATION_KEY",
  );
  if (regKeyOutboundLine) lines.push(regKeyOutboundLine);

  lines.push(`llama_server_bin: ${yamlStr(rp.llama_server_bin)}`);
  lines.push(`llama_cpp_dir: ${yamlStr(rp.llama_cpp_dir)}`);
  lines.push(`python_bin: ${yamlStr(rp.python_bin)}`);
  lines.push(`hf_models_dirs:`);
  lines.push(`  - ${yamlStr(rp.hf_models_dir)}`);
  lines.push(`log_dir: ${yamlStr(rp.log_dir)}`);

  if (aw.enabled) {
    lines.push(`agent_worker_enabled: true`);
    lines.push(`agent_worker_max_jobs: ${aw.max_jobs}`);
    const activeLabels = aw.labels.filter((l) => l.key);
    if (activeLabels.length > 0) {
      lines.push(`agent_worker_labels:`);
      for (const l of activeLabels) lines.push(`  ${l.key}: ${yamlStr(l.value)}`);
    }
  }

  const model = modelBlock(fm.model_alias, fm);
  if (model.length > 0) {
    lines.push(``);
    lines.push(...model);
  }

  return lines.join("\n");
}

function standaloneConfig(state: WizardState): string {
  const rp = state.agentRuntimePaths;
  const fm = state.agentFirstModel;
  const aw = state.agentWorker;

  const lines: string[] = [];

  lines.push(`mode: agent`);
  lines.push(`llama_server_bin: ${yamlStr(rp.llama_server_bin)}`);
  lines.push(`llama_cpp_dir: ${yamlStr(rp.llama_cpp_dir)}`);
  lines.push(`python_bin: ${yamlStr(rp.python_bin)}`);
  lines.push(`hf_models_dirs:`);
  lines.push(`  - ${yamlStr(rp.hf_models_dir)}`);
  lines.push(`log_dir: ${yamlStr(rp.log_dir)}`);

  if (aw.enabled) {
    lines.push(`agent_worker_enabled: true`);
    lines.push(`agent_worker_max_jobs: ${aw.max_jobs}`);
    const activeLabels = aw.labels.filter((l) => l.key);
    if (activeLabels.length > 0) {
      lines.push(`agent_worker_labels:`);
      for (const l of activeLabels) lines.push(`  ${l.key}: ${yamlStr(l.value)}`);
    }
  }

  const model = modelBlock(fm.model_alias, fm);
  if (model.length > 0) {
    lines.push(``);
    lines.push(...model);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateConfig(state: WizardState): string {
  if (state.mode === "controller") return controllerConfig(state);
  if (state.mode === "agent") return agentConfig(state);
  return standaloneConfig(state);
}

export function generateCommands(state: WizardState): string {
  const { mode } = state;
  const ac = state.agentConnection;

  if (mode === "controller") {
    return [
      "# 1. Run migrations and create the first admin key",
      "bash scripts/onboard_controller.sh",
      "",
      "# 2. Start the controller",
      "bash scripts/start_controller.sh",
    ].join("\n");
  }

  if (mode === "agent") {
    const env: string[] = [];
    if (ac.node_name) env.push(`NODE_NAME="${ac.node_name}"`);
    if (ac.controller_url) env.push(`CONTROLLER_URL="${ac.controller_url}"`);
    if (ac.agent_url) env.push(`AGENT_URL="${ac.agent_url}"`);
    const prefix =
      env.length > 0 ? env.map((e, i) => (i === 0 ? e : `  ${e}`)).join(" \\\n") + " \\\n  " : "";
    return [
      "# 1. Register this agent with the controller",
      `${prefix}bash scripts/onboard_agent.sh`,
      "",
      "# 2. Start the agent",
      "bash scripts/start_agent.sh",
    ].join("\n");
  }

  // standalone
  return [
    "# 1. Initialize databases and create the first admin key",
    "bash scripts/onboard_controller.sh",
    "",
    "# 2. Start the server",
    "bash scripts/start_agent.sh",
  ].join("\n");
}
