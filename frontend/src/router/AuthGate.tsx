import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthSession } from "../features/auth/authSession";

const SETUP_PATH = "/ui/setup";

/**
 * AuthGate only handles the bootstrap redirect: if the backend has not been
 * bootstrapped yet (no admin key configured), force the user to /ui/setup.
 *
 * Auth-required-but-not-authenticated is handled by `AppLayout`, which
 * renders a full-viewport login screen (brand + login form only) when auth
 * is enabled and the user has no session.
 */
export function AuthGate() {
  const location = useLocation();
  const { bootstrapRequired } = useAuthSession();
  const onSetupPage = location.pathname === SETUP_PATH;

  if (bootstrapRequired === true && !onSetupPage) {
    return <Navigate to={SETUP_PATH} replace />;
  }

  return <Outlet />;
}
