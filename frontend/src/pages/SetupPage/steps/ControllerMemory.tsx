import { FormField } from "../../../components/ui";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

export function ControllerMemory({ nav }: { nav: WizardNav }) {
  const { state, setControllerMemory } = nav;
  const s = state.controllerMemory;

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Semantic memory lets the controller inject relevant conversation history
        and documents into chat context automatically.
      </p>

      <label className="wizard-toggle">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => setControllerMemory({ enabled: e.target.checked })}
        />
        <span className="wizard-toggle-label">
          Enable semantic memory (ChromaDB + local embedding model)
        </span>
      </label>

      {s.enabled ? (
        <>
          <div className="wizard-subsection wizard-form">
            <FormField
              label="Memory store path"
              hint="Where ChromaDB persists its vector data."
            >
              <input
                type="text"
                value={s.path}
                onChange={(e) => setControllerMemory({ path: e.target.value })}
                placeholder="./logs/agent_memory"
              />
            </FormField>

            <FormField
              label="Embedding model path"
              hint="Path to the local sentence-transformers model directory."
            >
              <input
                type="text"
                value={s.embedding_model_path}
                onChange={(e) =>
                  setControllerMemory({ embedding_model_path: e.target.value })
                }
                placeholder="./models/embedding/all-MiniLM-L6-v2"
              />
            </FormField>

            <FormField
              label="Top-K results"
              hint="Number of memory chunks to inject per request."
            >
              <input
                type="number"
                min={1}
                max={20}
                value={s.top_k}
                onChange={(e) => setControllerMemory({ top_k: e.target.value })}
              />
            </FormField>

            <label className="wizard-toggle">
              <input
                type="checkbox"
                checked={s.auto_inject}
                onChange={(e) => setControllerMemory({ auto_inject: e.target.checked })}
              />
              <span className="wizard-toggle-label">Auto-inject into chat</span>
            </label>
          </div>

          <div className="wizard-callout">
            <strong>Install required extras first:</strong>
            <pre className="wizard-code-block">{`uv pip install -e '.[controller-memory]'
bash scripts/install_embedding_model.sh`}</pre>
          </div>
        </>
      ) : null}
    </div>
  );
}
