import "./styles.css";
import { useEffect, useState } from "react";
import { getSetupStatus, getCurrentConfig } from "../../api/setup";
import { Button } from "../../components/ui";
import type { SetupStatus } from "../../types/api";
import type { ModeChoice } from "../../features/setup/types";
import { STEP_LABELS } from "../../features/setup/types";
import { type WizardNav, useOnboardingWizard } from "../../features/setup/useOnboardingWizard";

// Step components
import { ModeSelection } from "./steps/ModeSelection";
import { AdminBootstrap } from "./steps/AdminBootstrap";
import { ConfigAndCommands } from "./steps/ConfigAndCommands";
import { Verification } from "./steps/Verification";
import { ControllerIdentity } from "./steps/ControllerIdentity";
import { ControllerFirstNode } from "./steps/ControllerFirstNode";
import { ControllerMemory } from "./steps/ControllerMemory";
import { AgentConnection } from "./steps/AgentConnection";
import { AgentRuntimePaths } from "./steps/AgentRuntimePaths";
import { AgentFirstModel } from "./steps/AgentFirstModel";
import { AgentWorker } from "./steps/AgentWorker";

function modeFromStatus(status: SetupStatus | null): ModeChoice {
  if (status?.mode === "controller") return "controller";
  return "standalone";
}

function StepIndicator({ nav }: { nav: WizardNav }) {
  const { steps, stepIndex } = nav;
  return (
    <div className="wizard-step-indicator" aria-label="Setup progress">
      {steps.map((step, i) => (
        <div
          key={step}
          className={[
            "wizard-step-pip",
            i < stepIndex ? "done" : "",
            i === stepIndex ? "active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title={STEP_LABELS[step]}
        >
          <span className="wizard-step-pip-label">{STEP_LABELS[step]}</span>
        </div>
      ))}
    </div>
  );
}

function WizardFooter({ nav }: { nav: WizardNav }) {
  const { isFirst, isLast, canSkip, goNext, goBack } = nav;
  return (
    <div className="wizard-footer">
      <div className="wizard-footer-actions">
        {!isFirst ? (
          <Button variant="ghost" onClick={goBack}>
            Back
          </Button>
        ) : null}
        {canSkip ? (
          <Button variant="link" onClick={goNext}>
            Skip
          </Button>
        ) : null}
        {!isLast ? (
          <Button variant="primary" onClick={goNext}>
            Continue
          </Button>
        ) : (
          <Button variant="success" onClick={goNext}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

function StepRouter({ nav }: { nav: WizardNav }) {
  const { currentStep } = nav;
  switch (currentStep) {
    case "mode":
      return <ModeSelection nav={nav} />;
    case "controller-identity":
      return <ControllerIdentity nav={nav} />;
    case "controller-first-node":
      return <ControllerFirstNode nav={nav} />;
    case "controller-memory":
      return <ControllerMemory nav={nav} />;
    case "agent-connection":
      return <AgentConnection nav={nav} />;
    case "agent-runtime-paths":
      return <AgentRuntimePaths nav={nav} />;
    case "agent-first-model":
      return <AgentFirstModel nav={nav} />;
    case "agent-worker":
      return <AgentWorker nav={nav} />;
    case "admin-bootstrap":
      return <AdminBootstrap nav={nav} />;
    case "config-commands":
      return <ConfigAndCommands nav={nav} />;
    case "verification":
      return <Verification nav={nav} />;
    default:
      return null;
  }
}

export function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const nav = useOnboardingWizard(modeFromStatus(status));

  useEffect(() => {
    getSetupStatus()
      .catch(() => {
        // Server not yet available; wizard still usable for config generation
      })
      .then((s) => {
        if (s) setStatus(s);
      });
    getCurrentConfig()
      .catch(() => {})
      .then((cfg) => {
        if (cfg) nav.seedFromConfig(cfg);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="setup-page-react wizard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">First Run</span>
          <h2>Setup Wizard</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {nav.currentStep !== "mode" ? (
            <span className="muted">{nav.state.mode} mode</span>
          ) : null}
          <a href="/ui/docs" className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>Docs</a>
        </div>
      </div>

      <StepIndicator nav={nav} />

      <div className="wizard-step-body">
        <StepRouter nav={nav} />
      </div>

      {nav.currentStep !== "mode" ? <WizardFooter nav={nav} /> : null}
    </div>
  );
}
