import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { IoLogOutOutline } from "react-icons/io5";
import { currentUser, login, logout } from "../../api/auth";
import { setAuthTokenProvider } from "../../api/client";
import { getSetupStatus } from "../../api/setup";
import { Button } from "../../components/ui";

export const AUTH_TOKEN_STORAGE_KEY = "lm_ui_token";
export const REMEMBERED_USERNAME_STORAGE_KEY = "lm_ui_remembered_username";

export type AuthSessionContextValue = {
  authToken: string;
  authUser: string;
  authRole: string;
  authChecked: boolean;
  isAuthenticated: boolean;
  /** Whether the backend has authentication enabled at all. `null` while the
   * setup status is still loading. */
  authEnabled: boolean | null;
  /** Whether the backend still needs the admin bootstrap. `null` while the
   * setup status is still loading. */
  bootstrapRequired: boolean | null;
  /** Whether the setup status request is still in flight. */
  setupStatusPending: boolean;
  loginWithKey: (username: string, apiKey: string) => Promise<void>;
  acceptSession: (session: { token: string; username: string; role: string }) => void;
  logoutSession: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "");
  const [authUser, setAuthUser] = useState("");
  const [authRole, setAuthRole] = useState("");
  const [authChecked, setAuthChecked] = useState(() => !localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [bootstrapRequired, setBootstrapRequired] = useState<boolean | null>(null);
  const [setupStatusPending, setSetupStatusPending] = useState(true);

  useLayoutEffect(() => {
    setAuthTokenProvider(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "");
  }, []);

  useEffect(() => {
    let alive = true;
    void getSetupStatus()
      .then((status) => {
        if (!alive) return;
        setAuthEnabled(Boolean(status.auth_enabled));
        setBootstrapRequired(Boolean(status.auth_bootstrap_required));
      })
      .catch(() => {
        if (!alive) return;
        setAuthEnabled(false);
        setBootstrapRequired(false);
      })
      .finally(() => {
        if (alive) setSetupStatusPending(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      setAuthChecked(true);
      return;
    }
    if (authUser) {
      setAuthChecked(true);
      return;
    }
    setAuthChecked(false);
    void currentUser()
      .then((response) => {
        setAuthUser(response.username);
        setAuthRole(response.role || "operator");
        setAuthChecked(true);
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setAuthToken("");
        setAuthUser("");
        setAuthRole("");
        setAuthChecked(true);
      });
  }, [authToken, authUser]);

  async function loginWithKey(username: string, apiKey: string) {
    const response = await login({ username, api_key: apiKey });
    acceptSession(response);
  }

  function acceptSession(session: { token: string; username: string; role: string }) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token);
    setAuthToken(session.token);
    setAuthUser(session.username);
    setAuthRole(session.role);
    setAuthChecked(true);
  }

  async function logoutSession() {
    try {
      await logout();
    } finally {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setAuthToken("");
      setAuthUser("");
      setAuthRole("");
      setAuthChecked(true);
    }
  }

  const value = useMemo<AuthSessionContextValue>(() => ({
    authToken,
    authUser,
    authRole,
    authChecked,
    isAuthenticated: Boolean(authToken),
    authEnabled,
    bootstrapRequired,
    setupStatusPending,
    loginWithKey,
    acceptSession,
    logoutSession,
  }), [authToken, authUser, authRole, authChecked, authEnabled, bootstrapRequired, setupStatusPending]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return value;
}

export function AuthLoginForm() {
  const { authUser, authRole, isAuthenticated, loginWithKey, logoutSession } = useAuthSession();
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBERED_USERNAME_STORAGE_KEY) || "");
  const [apiKey, setApiKey] = useState("");
  const [rememberUsername, setRememberUsername] = useState(() => Boolean(localStorage.getItem(REMEMBERED_USERNAME_STORAGE_KEY)));
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await loginWithKey(username, apiKey);
      if (rememberUsername) {
        localStorage.setItem(REMEMBERED_USERNAME_STORAGE_KEY, username);
      } else {
        localStorage.removeItem(REMEMBERED_USERNAME_STORAGE_KEY);
      }
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <input value={username} onChange={(event) => setUsername(event.target.value)} type="text" placeholder="username" />
      <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder="api key" />
      <label className="auth-remember">
        <input
          checked={rememberUsername}
          onChange={(event) => setRememberUsername(event.target.checked)}
          type="checkbox"
        />
        <span>Remember username</span>
      </label>
      <Button type="submit">Login</Button>
      <Button type="button" onClick={() => void logoutSession()} disabled={!isAuthenticated}>Logout</Button>
      <span className="muted text-xs font-bold">{authUser ? `${authUser} (${authRole || "operator"})` : "Not logged in"}</span>
      {error ? <span className="error-text" role="alert">{error}</span> : null}
    </form>
  );
}

export function AuthLogoutButton() {
  const { authUser, authRole, isAuthenticated, logoutSession } = useAuthSession();
  const title = authUser ? `Log out ${authUser} (${authRole || "operator"})` : "Log out";

  return (
    <Button
      type="button"
      onClick={() => void logoutSession()}
      disabled={!isAuthenticated}
      aria-label="Log out"
      title={title}
      className="auth-logout-button"
    >
      <IoLogOutOutline aria-hidden="true" />
    </Button>
  );
}
