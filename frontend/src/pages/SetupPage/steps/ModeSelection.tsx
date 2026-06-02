import type { WizardNav } from "../../../features/setup/useOnboardingWizard";
import type { ModeChoice } from "../../../features/setup/types";

type ModeCard = {
  id: ModeChoice;
  title: string;
  badge: string;
  description: string;
  detail: string;
};

const CARDS: ModeCard[] = [
  {
    id: "controller",
    title: "Controller",
    badge: "Coordinates agents",
    description:
      "This machine routes chat requests, tracks agent nodes, and hosts the web UI. It does not need llama.cpp installed locally.",
    detail: "Choose this for your central hub — a Raspberry Pi, home server, or any always-on machine.",
  },
  {
    id: "agent",
    title: "Agent",
    badge: "Runs models",
    description:
      "This machine runs llama-server processes and is managed by a controller. It reports its status and accepts jobs from the controller.",
    detail: "Choose this for GPU machines, Mac Studios, or any box with local inference power.",
  },
  {
    id: "standalone",
    title: "Standalone",
    badge: "Single machine",
    description:
      "One machine does everything — runs models locally and serves the UI. No controller or other agents needed.",
    detail: "Choose this for a simple local setup where you don't need multi-node coordination.",
  },
];

export function ModeSelection({ nav }: { nav: WizardNav }) {
  const { state, setMode } = nav;

  return (
    <div className="wizard-mode-selection">
      <h3>What is this machine?</h3>
      <p className="muted wizard-mode-intro">
        Choose the role for this machine. Everything else in the wizard depends on this choice.
      </p>
      <div className="wizard-mode-cards">
        {CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className={[
              "wizard-mode-card",
              state.mode === card.id ? "selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setMode(card.id)}
          >
            <div className="wizard-mode-card-header">
              <span className="wizard-mode-card-title">{card.title}</span>
              <span className="wizard-mode-card-badge">{card.badge}</span>
            </div>
            <p className="wizard-mode-card-desc">{card.description}</p>
            <p className="wizard-mode-card-detail muted">{card.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
