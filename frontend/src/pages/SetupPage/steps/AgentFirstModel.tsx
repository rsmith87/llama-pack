import { FormField } from "../../../components/ui";
import type { AgentFirstModelState, CostTier, ModelStrength } from "../../../features/setup/types";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

type Preset = {
  label: string;
  fields: Omit<AgentFirstModelState, "model_alias">;
};

const PRESETS: Preset[] = [
  {
    label: "Qwen 2.5 7B (fast, general)",
    fields: {
      path: "./models/qwen2.5-7b-instruct-q4_k_m.gguf",
      port: "8080",
      gpu_layers: "999",
      ctx: "8192",
      strengths: ["general", "coding"],
      cost_tier: "low",
    },
  },
  {
    label: "Llama 3.1 8B",
    fields: {
      path: "./models/llama-3.1-8b-instruct-q4_k_m.gguf",
      port: "8080",
      gpu_layers: "999",
      ctx: "8192",
      strengths: ["general"],
      cost_tier: "low",
    },
  },
  {
    label: "Gemma 3 4B (vision)",
    fields: {
      path: "./models/gemma-3-4b-it-q4_k_m.gguf",
      port: "8081",
      gpu_layers: "999",
      ctx: "8192",
      strengths: ["general", "vision"],
      cost_tier: "low",
    },
  },
  {
    label: "Custom (fill in manually)",
    fields: {
      path: "",
      port: "8080",
      gpu_layers: "999",
      ctx: "8192",
      strengths: [],
      cost_tier: "low",
    },
  },
];

const ALL_STRENGTHS: ModelStrength[] = [
  "general",
  "coding",
  "research",
  "vision",
  "summarization",
];

export function AgentFirstModel({ nav }: { nav: WizardNav }) {
  const { state, setAgentFirstModel } = nav;
  const s = state.agentFirstModel;

  function applyPreset(label: string) {
    const preset = PRESETS.find((p) => p.label === label);
    if (preset) setAgentFirstModel(preset.fields);
  }

  function toggleStrength(strength: ModelStrength) {
    const next = s.strengths.includes(strength)
      ? s.strengths.filter((x) => x !== strength)
      : [...s.strengths, strength];
    setAgentFirstModel({ strengths: next });
  }

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Define one model to get started. More models can be added directly in
        the config file later.
      </p>
      <div className="wizard-form">
        <FormField
          label="Preset"
          hint="Selecting a preset fills in the fields below — you can still edit them."
        >
          <select
            defaultValue=""
            onChange={(e) => applyPreset(e.target.value)}
          >
            <option value="" disabled>
              Choose a preset…
            </option>
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Model alias"
          hint="A short name used to reference this model in routing rules."
        >
          <input
            type="text"
            value={s.model_alias}
            onChange={(e) => setAgentFirstModel({ model_alias: e.target.value })}
            placeholder="e.g. qwen2.5-7b"
          />
        </FormField>

        <FormField
          label="Path to GGUF file"
          hint="Absolute or relative path to the quantized model file."
        >
          <input
            type="text"
            value={s.path}
            onChange={(e) => setAgentFirstModel({ path: e.target.value })}
            placeholder="./models/my-model-q4_k_m.gguf"
          />
        </FormField>

        <div className="wizard-form-row">
          <FormField label="Port">
            <input
              type="number"
              min={1024}
              max={65535}
              value={s.port}
              onChange={(e) => setAgentFirstModel({ port: e.target.value })}
            />
          </FormField>
          <FormField label="GPU layers" hint="999 = all layers on GPU.">
            <input
              type="number"
              min={0}
              value={s.gpu_layers}
              onChange={(e) => setAgentFirstModel({ gpu_layers: e.target.value })}
            />
          </FormField>
          <FormField label="Context size (tokens)">
            <input
              type="number"
              min={512}
              value={s.ctx}
              onChange={(e) => setAgentFirstModel({ ctx: e.target.value })}
            />
          </FormField>
        </div>

        <FormField
          label="Strengths"
          hint="Used by the router to match requests to the right model."
        >
          <div className="wizard-strength-checks">
            {ALL_STRENGTHS.map((strength) => (
              <label key={strength} className="wizard-toggle">
                <input
                  type="checkbox"
                  checked={s.strengths.includes(strength)}
                  onChange={() => toggleStrength(strength)}
                />
                <span className="wizard-toggle-label">{strength}</span>
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Cost tier">
          <select
            value={s.cost_tier}
            onChange={(e) => setAgentFirstModel({ cost_tier: e.target.value as CostTier })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </FormField>
      </div>
    </div>
  );
}
