import { useState } from "react";
import { applySetup } from "../../../api/setup";
import { Button } from "../../../components/ui";
import { generateCommands } from "../../../features/setup/generateConfig";
import { useAuthSession } from "../../../features/auth/authSession";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";
import type { ActiveSetupRequest, ActiveSetupResult } from "../../../types";

export function ConfigAndCommands({ nav }: { nav: WizardNav }) {
  const { state } = nav;
  const { acceptSession } = useAuthSession();
  const isController = state.mode === "controller";
  const [copied, setCopied] = useState(false);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ActiveSetupResult | null>(null);
  const [applyError, setApplyError] = useState("");

  const commands = generateCommands(state);
  const regKey = state.controllerIdentity.controller_registration_key;

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function buildActiveSetupRequest(): ActiveSetupRequest {
    if (state.mode === "controller") {
      return {
        mode: "controller",
        config_path: "config.yaml",
        env_path: ".llama_pack.env",
        overwrite_existing: allowOverwrite,
        inputs: {
          controller: {
            log_dir: state.controllerIdentity.log_dir,
            controller_registration_key: state.controllerIdentity.controller_registration_key,
            node_heartbeat_timeout_seconds: Number(state.controllerIdentity.node_heartbeat_timeout_seconds || 90),
            controller_instance_id: state.controllerIdentity.controller_instance_id || "local-controller",
          },
        },
      };
    }
    return {
      mode: state.mode,
      config_path: state.mode === "agent" ? "agent.config.yaml" : "config.yaml",
      env_path: ".llama_pack.env",
      overwrite_existing: allowOverwrite,
      inputs: {
        agent: {
          controller_url: state.agentConnection.controller_url,
          node_name: state.agentConnection.node_name,
          agent_url: state.agentConnection.agent_url,
          agent_api_key: state.agentConnection.agent_api_key,
          controller_registration_key_outbound: state.agentConnection.controller_registration_key_outbound,
          llama_server_bin: state.agentRuntimePaths.llama_server_bin,
          llama_cpp_dir: state.agentRuntimePaths.llama_cpp_dir,
          python_bin: state.agentRuntimePaths.python_bin,
          hf_models_dir: state.agentRuntimePaths.hf_models_dir,
          log_dir: state.agentRuntimePaths.log_dir,
        },
      },
    };
  }

  function parseApplyError(err: unknown): string {
    if (!(err instanceof Error)) return "Setup apply failed";
    const jsonStart = err.message.indexOf("{");
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(err.message.slice(jsonStart)) as Partial<ActiveSetupResult>;
        return parsed.message || err.message;
      } catch {
        return err.message;
      }
    }
    return err.message;
  }

  async function handleApply() {
    setApplying(true);
    setApplyError("");
    setApplyResult(null);
    try {
      const result = await applySetup(buildActiveSetupRequest());
      if (
        result.admin_bootstrap?.created &&
        result.admin_bootstrap.token &&
        result.admin_bootstrap.username &&
        result.admin_bootstrap.role
      ) {
        acceptSession({
          token: result.admin_bootstrap.token,
          username: result.admin_bootstrap.username,
          role: result.admin_bootstrap.role,
        });
      }
      setApplyResult(result);
    } catch (err) {
      setApplyError(parseApplyError(err));
    } finally {
      setApplying(false);
    }
  }

  const configFileName = state.mode === "agent" ? "agent.config.yaml" : "config.yaml";

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Apply setup from the UI. Generated commands are kept as a fallback reference.
      </p>

      <div className="wizard-apply-panel">
        <h4>Apply setup</h4>
        <p className="wizard-step-desc">
          The backend will write <code>{configFileName}</code> and <code>.llama_pack.env</code>.
        </p>
        <label className="wizard-checkbox-row">
          <input
            type="checkbox"
            checked={allowOverwrite}
            onChange={(event) => setAllowOverwrite(event.target.checked)}
          />
          <span>Allow setup to overwrite existing config.yaml or .llama_pack.env</span>
        </label>
        <Button variant="primary" onClick={() => void handleApply()} disabled={applying}>
          {applying ? "Applying..." : "Apply Setup"}
        </Button>
        {applyError ? <p className="wizard-validation-error">{applyError}</p> : null}
        {applyResult ? (
          <div className={`wizard-apply-result ${applyResult.ok ? "success" : "blocked"}`}>
            <p>{applyResult.message}</p>
            {applyResult.existing_files.length ? <p>Existing files: {applyResult.existing_files.join(", ")}</p> : null}
            {applyResult.backup_files.length ? <p>Backups: {applyResult.backup_files.join(", ")}</p> : null}
            {applyResult.actions.length ? (
              <ul className="wizard-apply-actions" aria-label="Setup actions">
                {applyResult.actions.map((action) => (
                  <li key={action.kind}>
                    <span className={`wizard-action-status ${action.status}`}>{action.status}</span>
                    <span>{action.detail}</span>
                    {action.command ? <code>{action.command}</code> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {applyResult.admin_bootstrap?.created && applyResult.admin_bootstrap.key ? (
              <div className="wizard-apply-admin-key">
                <p>Admin key created. Copy it now - it will not be shown again.</p>
                <pre className="wizard-code-block wizard-secret">{applyResult.admin_bootstrap.key}</pre>
                <Button variant="ghost" size="sm" onClick={() => copyText(applyResult.admin_bootstrap?.key || "")}>
                  {copied ? "Copied!" : "Copy admin key"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <section className="wizard-reference-panel" aria-label="Command reference">
        <h4>Command reference</h4>
        <pre className="wizard-code-block">{commands}</pre>
      </section>

      {isController && regKey ? (
        <section className="wizard-reference-panel" aria-label="Registration key reference">
          <h4>Registration key reference</h4>
          <p className="wizard-step-desc">
            Share this key with agents that need to register with this controller.
          </p>
          <pre className="wizard-code-block wizard-secret">{regKey}</pre>
          <Button variant="ghost" size="sm" onClick={() => copyText(regKey)}>
            {copied ? "Copied!" : "Copy key"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
