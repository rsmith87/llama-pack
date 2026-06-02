import { Button, FormField } from "../../../components/ui";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

function generateKey(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ControllerIdentity({ nav }: { nav: WizardNav }) {
  const { state, setControllerIdentity } = nav;
  const s = state.controllerIdentity;

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Configure how this controller identifies itself and how agents register
        with it.
      </p>
      <div className="wizard-form">
        <FormField
          label="Log directory"
          hint="Directory for runtime logs and state files."
        >
          <input
            type="text"
            value={s.log_dir}
            onChange={(e) => setControllerIdentity({ log_dir: e.target.value })}
            placeholder="./logs"
          />
        </FormField>

        <FormField
          label="Controller registration key"
          hint={
            s.controller_registration_key === "***"
              ? "Key is already configured — clear to replace."
              : "Agents use this key when registering with the controller. Store it securely."
          }
        >
          <div className="wizard-key-row">
            <input
              type="text"
              value={s.controller_registration_key}
              onChange={(e) =>
                setControllerIdentity({ controller_registration_key: e.target.value })
              }
              placeholder="Paste or auto-generate"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setControllerIdentity({ controller_registration_key: generateKey() })
              }
            >
              Auto-generate
            </Button>
          </div>
        </FormField>

        <FormField
          label="Node heartbeat timeout (seconds)"
          hint="How long before an unresponsive agent is marked offline."
        >
          <input
            type="number"
            min={10}
            value={s.node_heartbeat_timeout_seconds}
            onChange={(e) =>
              setControllerIdentity({ node_heartbeat_timeout_seconds: e.target.value })
            }
          />
        </FormField>

        <FormField
          label="Controller instance ID (optional)"
          hint="A unique name for this controller — useful when running multiple controllers."
        >
          <input
            type="text"
            value={s.controller_instance_id}
            onChange={(e) =>
              setControllerIdentity({ controller_instance_id: e.target.value })
            }
            placeholder="e.g. pi-controller-home"
          />
        </FormField>
      </div>
    </div>
  );
}
