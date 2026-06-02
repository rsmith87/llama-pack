import { useState } from "react";
import { Button } from "../../../components/ui";
import {
  generateCommands,
  generateConfig,
} from "../../../features/setup/generateConfig";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

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

  const yaml = generateConfig(state);
  const commands = generateCommands(state);
  const regKey = state.controllerIdentity.controller_registration_key;

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Your configuration is ready. Copy or download{" "}
        <code>config.yaml</code> and place it in the project root, then run the
        setup commands.
      </p>

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
