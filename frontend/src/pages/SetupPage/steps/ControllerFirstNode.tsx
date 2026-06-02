import { FormField } from "../../../components/ui";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

export function ControllerFirstNode({ nav }: { nav: WizardNav }) {
  const { state, setControllerFirstNode } = nav;
  const s = state.controllerFirstNode;

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Optionally register your first agent node now. You can add more nodes
        directly in the config file later.
      </p>

      <label className="wizard-toggle">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => setControllerFirstNode({ enabled: e.target.checked })}
        />
        <span className="wizard-toggle-label">Add a node now</span>
      </label>

      {s.enabled ? (
        <div className="wizard-subsection wizard-form">
          <FormField
            label="Node name"
            hint="A unique identifier for this agent (used as the config key)."
          >
            <input
              type="text"
              value={s.node_name}
              onChange={(e) => setControllerFirstNode({ node_name: e.target.value })}
              placeholder="e.g. mac-studio"
            />
          </FormField>

          <FormField
            label="Agent URL"
            hint="The URL the controller uses to reach this agent."
          >
            <input
              type="text"
              value={s.agent_url}
              onChange={(e) => setControllerFirstNode({ agent_url: e.target.value })}
              placeholder="http://192.168.1.20:9137"
            />
          </FormField>

          <FormField
            label="Agent API key"
            hint={
              s.agent_api_key === "***"
                ? "Key is already configured — clear to replace."
                : "The API key this agent accepts on inbound requests."
            }
          >
            <input
              type="text"
              value={s.agent_api_key}
              onChange={(e) => setControllerFirstNode({ agent_api_key: e.target.value })}
              placeholder="lm_agent_..."
            />
          </FormField>

          <FormField
            label="Default model"
            hint="Model alias to use when no specific model is requested."
          >
            <input
              type="text"
              value={s.default_model}
              onChange={(e) => setControllerFirstNode({ default_model: e.target.value })}
              placeholder="e.g. qwen2.5-7b"
            />
          </FormField>
        </div>
      ) : null}
    </div>
  );
}
