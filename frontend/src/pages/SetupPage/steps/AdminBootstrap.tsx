import { useState } from "react";
import { bootstrapAdmin } from "../../../api/setup";
import { Button, FormField } from "../../../components/ui";
import { useAuthSession } from "../../../features/auth/authSession";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

export function AdminBootstrap({ nav: _nav }: { nav: WizardNav }) {
  const { isAuthenticated, authUser, acceptSession } = useAuthSession();

  const [username, setUsername] = useState("admin");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in (bootstrapped in a prior step or pre-existing session).
  if (isAuthenticated) {
    return (
      <div className="wizard-step">
        <p className="wizard-step-desc">
          Admin key already created. You are signed in as{" "}
          <strong>{authUser}</strong>.
        </p>
        <p className="wizard-step-desc">Continue to the next step.</p>
      </div>
    );
  }

  if (apiKey) {
    return (
      <div className="wizard-step">
        <p className="wizard-step-desc">
          Admin key created. Copy it now — it will not be shown again.
        </p>
        <div className="wizard-secret">
          <pre className="wizard-code-block">{apiKey}</pre>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigator.clipboard.writeText(apiKey)}
          >
            Copy key
          </Button>
        </div>
        <p className="wizard-step-desc">
          You are now signed in as <strong>{username}</strong>. Continue to
          generate your config.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await bootstrapAdmin({ username });
      acceptSession({ token: result.token, username: result.username, role: result.role });
      setApiKey(result.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bootstrap failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Create the first admin key for this server. You will use this key to
        sign in to the UI and manage the API.
      </p>
      <form className="wizard-form" onSubmit={handleSubmit}>
        <FormField
          label="Admin username"
          hint="A display name for the first admin account."
        >
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={1}
          />
        </FormField>
        {error ? <p className="wizard-validation-error">{error}</p> : null}
        <div>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create Admin Key"}
          </Button>
        </div>
      </form>
    </div>
  );
}

