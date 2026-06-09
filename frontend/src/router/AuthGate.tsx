import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getSetupStatus } from "../api/setup";
import { useAuthSession } from "../features/auth/authSession";
import { Panel } from "../components/ui";

const SETUP_PATH = "/ui/setup";

export function AuthGate() {
  const { authChecked, isAuthenticated } = useAuthSession();
  const location = useLocation();
  const [authRequired, setAuthRequired] = useState(false);
  const [setupStatusPending, setSetupStatusPending] = useState(true);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);

  const onSetupPage = location.pathname === SETUP_PATH;

  useEffect(() => {
    let alive = true;
    void getSetupStatus()
      .then((status) => {
        if (!alive) return;
        setAuthRequired(Boolean(status.auth_enabled));
        setBootstrapRequired(Boolean(status.auth_bootstrap_required));
      })
      .catch(() => {
        if (!alive) return;
        setAuthRequired(false);
        setBootstrapRequired(false);
      })
      .finally(() => {
        if (alive) setSetupStatusPending(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Redirect to setup when bootstrap is required
  if (!setupStatusPending && bootstrapRequired && !onSetupPage) {
    return <Navigate to={SETUP_PATH} replace />;
  }

  // Loading state
  if (setupStatusPending || (authRequired && !authChecked)) {
    return <div className="muted">Checking session...</div>;
  }

  // Auth required but not authenticated
  if (authRequired && !isAuthenticated && !onSetupPage) {
    return (
      <Panel title="Login Required" eyebrow="Session">
        <p className="muted">Log in to Neuraxis to continue.</p>
      </Panel>
    );
  }

  return <Outlet />;
}