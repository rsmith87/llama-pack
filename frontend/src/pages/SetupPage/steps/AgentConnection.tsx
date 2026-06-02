import { FormField } from "../../../components/ui";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

export function AgentConnection({ nav }: { nav: WizardNav }) {
  const { state, setAgentConnection } = nav;
  const s = state.agentConnection;

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Configure how this agent connects to and registers with its controller.
      </p>
      <div className="wizard-form">
        <FormField
          label="Controller URL"
          hint="The base URL of the controller this agent reports to."
        >
          <input
            type="text"
            value={s.controller_url}
            onChange={(e) => setAgentConnection({ controller_url: e.target.value })}
            placeholder="http://192.168.1.10:9137"
          />
        </FormField>

        <FormField
          label="Node name"
          hint="A unique identifier for this agent node on the controller."
        >
          <input
            type="text"
            value={s.node_name}
            onChange={(e) => setAgentConnection({ node_name: e.target.value })}
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
            onChange={(e) => setAgentConnection({ agent_url: e.target.value })}
            placeholder="http://192.168.1.20:9137"
          />
        </FormField>

        <FormField
          label="Agent API key"
          hint={
            s.agent_api_key === "***"
              ? "Key is already configured — clear to replace."
              : "The key this agent accepts on inbound requests from the controller."
          }
        >
          <input
            type="text"
            value={s.agent_api_key}
            onChange={(e) => setAgentConnection({ agent_api_key: e.target.value })}
            placeholder="lm_agent_..."
          />
        </FormField>

        <FormField
          label="Controller registration key"
          hint={
            s.controller_registration_key_outbound === "***"
              ? "Key is already configured — clear to replace."
              : "The key set on the controller — this agent sends it when registering."
          }
        >
          <input
            type="text"
            value={s.controller_registration_key_outbound}
            onChange={(e) =>
              setAgentConnection({ controller_registration_key_outbound: e.target.value })
            }
            placeholder="Hex key from the controller setup"
          />
        </FormField>
      </div>
    </div>
  );
}
