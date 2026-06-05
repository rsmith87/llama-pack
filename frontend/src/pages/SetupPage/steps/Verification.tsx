import { useCallback, useEffect, useState } from "react";
import { getControllerStatus, getHealth } from "../../../api/health";
import { listNodes } from "../../../api/nodes";
import { getSetupStatus } from "../../../api/setup";
import { Button } from "../../../components/ui";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

type CheckState = "pass" | "fail" | "unknown";

type Check = {
  label: string;
  state: CheckState;
  reason?: string;
};

function CheckIcon({ state }: { state: CheckState }) {
  if (state === "pass") return <span className="wizard-check-icon pass">✓</span>;
  if (state === "fail") return <span className="wizard-check-icon fail">✗</span>;
  return <span className="wizard-check-icon unknown">○</span>;
}

export function Verification({ nav }: { nav: WizardNav }) {
  const mode = nav.state.mode;
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(false);

  const runChecks = useCallback(async () => {
    setLoading(true);
    const results: Check[] = [];

    // ── Check 1: backend online + correct mode ──────────────────────────────
    let serverMode: string | undefined;
    try {
      const health = await getHealth();
      serverMode = health.mode;
      results.push({ label: "Backend online", state: "pass" });
    } catch {
      results.push({ label: "Backend online", state: "fail", reason: "Could not reach server" });
    }

    // ── Check 2: correct mode ───────────────────────────────────────────────
    const expectedMode = mode === "controller" ? "controller" : "agent";
    if (serverMode !== undefined) {
      results.push({
        label: `Correct mode (${expectedMode})`,
        state: serverMode === expectedMode ? "pass" : "fail",
        reason: serverMode !== expectedMode ? `Server reports mode: ${serverMode}` : undefined,
      });
    } else {
      results.push({ label: `Correct mode (${expectedMode})`, state: "unknown" });
    }

    // ── Check 3: auth configured ────────────────────────────────────────────
    try {
      const status = await getSetupStatus();
      results.push({
        label: "Auth configured",
        state: status.auth_enabled ? "pass" : "fail",
        reason: !status.auth_enabled ? "Auth not yet bootstrapped" : undefined,
      });
    } catch {
      results.push({ label: "Auth configured", state: "unknown" });
    }

    // ── Check 4 (controller): at least one node with fresh heartbeat ────────
    if (mode === "controller") {
      try {
        const resp = await listNodes();
        const nodes = resp.nodes ?? [];
        const fresh = nodes.filter((n) => (n as { heartbeat_fresh?: boolean }).heartbeat_fresh);
        results.push({
          label: "At least one node online",
          state: fresh.length > 0 ? "pass" : "fail",
          reason: fresh.length === 0 ? "No nodes with a fresh heartbeat" : undefined,
        });
      } catch {
        results.push({ label: "At least one node online", state: "unknown" });
      }
    }

    // ── Check 4 (agent): controller reachable ──────────────────────────────
    if (mode === "agent") {
      const controllerUrl = nav.state.agentConnection.controller_url;
      if (controllerUrl) {
        try {
          const status = await getControllerStatus();
          results.push({
            label: "Controller reachable",
            state: status.reachable ? "pass" : "fail",
            reason: status.reachable ? undefined : status.error || "Could not connect",
          });
        } catch {
          results.push({ label: "Controller reachable", state: "fail", reason: "Could not connect" });
        }
      } else {
        results.push({ label: "Controller reachable", state: "unknown", reason: "No controller URL set" });
      }
    }

    setChecks(results);
    setLoading(false);
  }, [mode, nav.state.agentConnection.controller_url]);

  useEffect(() => { void runChecks(); }, [runChecks]);

  const allPass = checks.length > 0 && checks.every((c) => c.state === "pass");

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Verifying that everything is running correctly.
      </p>

      <div className="wizard-checks">
        {checks.length === 0 && loading ? (
          <p className="wizard-step-desc">Checking…</p>
        ) : null}
        {checks.map((c) => (
          <div key={c.label} className="wizard-check-row">
            <CheckIcon state={c.state} />
            <span>{c.label}</span>
            {c.reason ? <span className="wizard-check-reason">{c.reason}</span> : null}
          </div>
        ))}
      </div>

      {allPass ? (
        <p className="wizard-step-desc" style={{ color: "var(--success)" }}>
          All checks passed — setup is complete!
        </p>
      ) : null}

      <div>
        <Button variant="ghost" onClick={() => void runChecks()} disabled={loading}>
          {loading ? "Checking…" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
