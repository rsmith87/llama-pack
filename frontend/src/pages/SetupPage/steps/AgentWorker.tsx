import { Button, FormField } from "../../../components/ui";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

export function AgentWorker({ nav }: { nav: WizardNav }) {
  const { state, setAgentWorker } = nav;
  const s = state.agentWorker;

  function addLabel() {
    setAgentWorker({ labels: [...s.labels, { key: "", value: "" }] });
  }

  function updateLabel(i: number, field: "key" | "value", val: string) {
    const next = s.labels.map((l, idx) => (idx === i ? { ...l, [field]: val } : l));
    setAgentWorker({ labels: next });
  }

  function removeLabel(i: number) {
    setAgentWorker({ labels: s.labels.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        The job worker lets this agent claim and process jobs queued by the
        controller (LLM generation, embedding, batch, model transfer).
      </p>

      <label className="wizard-toggle">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => setAgentWorker({ enabled: e.target.checked })}
        />
        <span className="wizard-toggle-label">Enable job worker</span>
      </label>

      {s.enabled ? (
        <div className="wizard-subsection wizard-form">
          <FormField
            label="Max concurrent jobs"
            hint="How many jobs this agent runs in parallel."
          >
            <input
              type="number"
              min={1}
              value={s.max_jobs}
              onChange={(e) => setAgentWorker({ max_jobs: e.target.value })}
            />
          </FormField>

          <div className="wizard-labels-section">
            <span className="wizard-labels-heading">Labels</span>
            <p className="wizard-step-desc">
              Key-value labels the controller can use to route specific jobs to
              this worker.
            </p>
            {s.labels.map((label, i) => (
              <div key={i} className="wizard-label-row">
                <input
                  type="text"
                  value={label.key}
                  onChange={(e) => updateLabel(i, "key", e.target.value)}
                  placeholder="key"
                />
                <span className="wizard-label-sep">:</span>
                <input
                  type="text"
                  value={label.value}
                  onChange={(e) => updateLabel(i, "value", e.target.value)}
                  placeholder="value"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLabel(i)}
                  aria-label="Remove label"
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addLabel}>
              + Add label
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
