import { useState } from "react";
import { applySetup } from "../../../api/setup";
import { Button } from "../../../components/ui";
import {
  generateCommands,
  generateConfig,
} from "../../../features/setup/generateConfig";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";
import type { ActiveSetupRequest, ActiveSetupResult } from "../../../types";

type Tab = "config" | "commands" | "reg-key";

function downloadConfig(yaml: string) {
  const blob = new Blob([yaml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.yaml";
  a.click();
  URL.revokeObjectURL(url);
}

export function ConfigAndCommands({ nav }: { nav: WizardNav }) {
  const { state } = nav;
  const isController = state.mode === "controller";
  const [tab, setTab] = useState<Tab>("config");
  const [copied, setCopied] = useState(false);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ActiveSetupResult | null>(null);
  const [applyError, setApplyError] = useState("");

  const yaml = generateConfig(state);
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
        Your configuration is ready. Apply it from the UI or review the generated
        config and commands before writing files.
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
          </div>
        ) : null}
      </div>

      <div className="wizard-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "config"}
          className={`wizard-tab-btn${tab === "config" ? " active" : ""}`}
          onClick={() => setTab("config")}
        >
          Config
        </button>
        <button
          role="tab"
          aria-selected={tab === "commands"}
          className={`wizard-tab-btn${tab === "commands" ? " active" : ""}`}
          onClick={() => setTab("commands")}
        >
          Commands
        </button>
        {isController ? (
          <button
            role="tab"
            aria-selected={tab === "reg-key"}
            className={`wizard-tab-btn${tab === "reg-key" ? " active" : ""}`}
            onClick={() => setTab("reg-key")}
          >
            Registration Key
          </button>
        ) : null}
      </div>

      {tab === "config" ? (
        <div className="wizard-tab-content">
          <pre className="wizard-code-block">{yaml}</pre>
          <div className="wizard-config-actions">
            <Button variant="primary" onClick={() => downloadConfig(yaml)}>
              Download config.yaml
            </Button>
            <Button variant="ghost" onClick={() => copyText(yaml)}>
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "commands" ? (
        <div className="wizard-tab-content">
          <pre className="wizard-code-block">{commands}</pre>
          <div className="wizard-config-actions">
            <Button variant="ghost" onClick={() => copyText(commands)}>
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "reg-key" && isController ? (
        <div className="wizard-tab-content">
          <p className="wizard-step-desc">
            Share this key with every agent that needs to register with this
            controller. Store it securely — treat it like a password.
          </p>
          {regKey ? (
            <>
              <pre className="wizard-code-block wizard-secret">{regKey}</pre>
              <div className="wizard-config-actions">
                <Button variant="ghost" onClick={() => copyText(regKey)}>
                  {copied ? "Copied!" : "Copy key"}
                </Button>
              </div>
            </>
          ) : (
            <p className="wizard-step-desc">
              No registration key was set. Go back to Controller Identity to
              generate one.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
