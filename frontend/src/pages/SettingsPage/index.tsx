import "./styles.css";
import { useMemo, useState } from "react";
import { createKey, listKeys, revokeKey } from "../../api/auth";
import { generateApiKeys } from "../../api/settings";
import { DataTable, ErrorBanner, FormField, Panel, Button } from "../../components/ui";
import { useAuthSession } from "../../features/auth/authSession";
import { downloadText } from "../../features/shared/helpers";
import type { AuthKey } from "../../types/index";

function shellQuote(value: string) {
  return `'${String(value || "").replaceAll("'", "'\"'\"'")}'`;
}

function keyId(key: AuthKey) {
  return String(key.id || "");
}

function keyHint(key: AuthKey) {
  return String((key as Record<string, unknown>).key_hint || key.hint || "-");
}

export function SettingsPage() {
  const { authUser, authRole } = useAuthSession();
  const [mode, setMode] = useState("single");
  const [logDir, setLogDir] = useState("./logs");
  const [controllerUrl, setControllerUrl] = useState("http://<controller-ip>:9137");
  const [controllerApiKey, setControllerApiKey] = useState("");
  const [registrationKey, setRegistrationKey] = useState("");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentName, setAgentName] = useState("local-agent");
  const [agentUrl, setAgentUrl] = useState("http://127.0.0.1:9137");
  const [activePane, setActivePane] = useState("config");
  const [prefix, setPrefix] = useState("llm");
  const [tokenBytes, setTokenBytes] = useState(32);
  const [keyCount, setKeyCount] = useState(1);
  const [applyTarget, setApplyTarget] = useState("controller");
  const [generated, setGenerated] = useState<{ keys?: string[] } | null>(null);
  const [authKeys, setAuthKeys] = useState<AuthKey[]>([]);
  const [keyUsername, setKeyUsername] = useState("");
  const [keyRole, setKeyRole] = useState("operator");
  const [createdKey, setCreatedKey] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [utilityStatus, setUtilityStatus] = useState("");
  const paneLabels: Record<string, string> = {
    config: "Config Helper",
    "api-keys": "Admin Keys",
    outputs: "Generated Files",
  };

  const configYaml = useMemo(() => {
    const lines = [`mode: ${mode}`, `log_dir: ${JSON.stringify(logDir || "./logs")}`, "models: {}"];
    if (mode === "controller") {
      lines.push("nodes:", `  ${agentName || "local-agent"}:`, `    url: ${JSON.stringify(agentUrl || "http://127.0.0.1:9000")}`, `    api_key: ${JSON.stringify(agentApiKey || "CHANGE_ME_AGENT_API_KEY")}`, "    verify_tls: true");
    }
    if (mode === "agent") {
      lines.push(`controller_url: ${JSON.stringify(controllerUrl || "http://127.0.0.1:9137")}`, `controller_registration_key_outbound: ${JSON.stringify(registrationKey || "CHANGE_ME_REGISTRATION_KEY")}`);
      if (controllerApiKey) lines.push(`controller_api_key: ${JSON.stringify(controllerApiKey)}`);
    }
    if (mode === "single" && controllerApiKey) lines.push(`api_key: ${JSON.stringify(controllerApiKey)}`);
    return `${lines.join("\n")}\n`;
  }, [agentApiKey, agentName, agentUrl, controllerApiKey, controllerUrl, logDir, mode, registrationKey]);

  const envExports = useMemo(() => {
    const lines = [`export LLAMA_PACK_CONFIG=config.yaml`, `export LLAMA_PACK_MODE=${mode}`];
    if (mode === "agent") {
      lines.push(`export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND=${shellQuote(registrationKey || "CHANGE_ME_REGISTRATION_KEY")}`);
      lines.push(`export LLAMA_PACK_CONTROLLER_URL=${shellQuote(controllerUrl || "http://127.0.0.1:9137")}`);
      if (controllerApiKey) lines.push(`export LLAMA_PACK_CONTROLLER_API_KEY=${shellQuote(controllerApiKey)}`);
    } else if (mode === "controller") {
      lines.push(`export LLAMA_PACK_AGENT_API_KEY=${shellQuote(agentApiKey || "CHANGE_ME_AGENT_API_KEY")}`);
    } else if (controllerApiKey) {
      lines.push(`export LLAMA_PACK_API_KEY=${shellQuote(controllerApiKey)}`);
    }
    return `${lines.join("\n")}\n`;
  }, [agentApiKey, controllerApiKey, controllerUrl, mode, registrationKey]);

  async function refreshAuthKeys() {
    if (authRole !== "admin") {
      setError("Admin role required.");
      setAuthKeys([]);
      return;
    }
    setError("");
    const payload = await listKeys();
    setAuthKeys(Array.isArray(payload) ? payload as AuthKey[] : payload.keys || []);
  }

  async function createAuthKey() {
    if (authRole !== "admin") {
      setError("Admin role required.");
      return;
    }
    if (!keyUsername.trim()) {
      setError("Enter username for key.");
      return;
    }
    setError("");
    const created = await createKey({ username: keyUsername.trim(), role: keyRole });
    setCreatedKey(created);
    await refreshAuthKeys();
  }

  async function revokeAuthKey(id: string) {
    await revokeKey(id);
    await refreshAuthKeys();
  }

  async function generateKeys() {
    setError("");
    setGenerated(await generateApiKeys({ prefix, token_bytes: tokenBytes, count: keyCount }));
  }

  function applyFirstKey() {
    const key = generated?.keys?.[0];
    if (!key) {
      setError("Generate keys first.");
      return;
    }
    if (applyTarget === "registration") setRegistrationKey(key);
    else if (applyTarget === "agent") setAgentApiKey(key);
    else setControllerApiKey(key);
  }

  async function copyText(label: string, text: string) {
    await globalThis.navigator.clipboard?.writeText(text);
    setUtilityStatus(`${label} copied`);
  }

  function downloadConfigYaml() {
    downloadText("config.yaml", configYaml, "application/x-yaml");
    setUtilityStatus("config.yaml downloaded");
  }

  function downloadEnvExports() {
    downloadText("llama-pack.env.sh", envExports, "text/x-shellscript");
    setUtilityStatus("env.sh downloaded");
  }

  function outputUtilities() {
    return (
      <div className="modal-actions settings-utilities">
        <Button type="button" onClick={() => void copyText("Config YAML", configYaml)}>Copy Config YAML</Button>
        <Button type="button" onClick={downloadConfigYaml}>Download config.yaml</Button>
        <Button type="button" onClick={() => void copyText("Env exports", envExports)}>Copy Env Exports</Button>
        <Button type="button" onClick={downloadEnvExports}>Download env.sh</Button>
        {utilityStatus ? <span className="muted">{utilityStatus}</span> : null}
      </div>
    );
  }

  return (
    <div className="settings-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">System</span><h2>System Settings</h2></div>
        <span className="muted">{authUser ? `${authUser} (${authRole || "operator"})` : "Not logged in"}</span>
      </div>
      <ErrorBanner message={error} />
      <Panel className="settings-panel">
        <div className="settings-tabs" role="tablist" aria-label="Settings Sections">
          {["config", "api-keys", "outputs"].map((pane) => (
            <button key={pane} type="button" className={`settings-tab ${activePane === pane ? "active" : ""}`} aria-selected={activePane === pane} onClick={() => setActivePane(pane)}>{paneLabels[pane]}</button>
          ))}
        </div>

        {activePane === "config" ? (
          <div className="settings-pane active">
            <p className="muted settings-pane-note">
              Config Helper generates setup files and snippets. It does not modify the running service.
            </p>
            <div className="controller-filters settings-filters">
              <FormField label="Log Directory"><input value={logDir} onChange={(event) => setLogDir(event.target.value)} /></FormField>
              <FormField label="Mode"><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="single">single</option><option value="controller">controller</option><option value="agent">agent</option></select></FormField>
              <FormField label="Controller URL"><input value={controllerUrl} onChange={(event) => setControllerUrl(event.target.value)} /></FormField>
            </div>
            <div className="controller-filters settings-filters">
              <FormField label="Controller API Key (Optional)"><input value={controllerApiKey} onChange={(event) => setControllerApiKey(event.target.value)} type="password" /></FormField>
              <FormField label="Registration Key (Agent)"><input value={registrationKey} onChange={(event) => setRegistrationKey(event.target.value)} type="password" /></FormField>
              <FormField label="Agent API Key (Controller Nodes)"><input value={agentApiKey} onChange={(event) => setAgentApiKey(event.target.value)} type="password" /></FormField>
            </div>
            <div className="controller-filters settings-filters">
              <FormField label="Agent Name"><input value={agentName} onChange={(event) => setAgentName(event.target.value)} /></FormField>
              <FormField label="Agent URL"><input value={agentUrl} onChange={(event) => setAgentUrl(event.target.value)} /></FormField>
              <button className="primary" type="button">Update Preview</button>
            </div>
          </div>
        ) : null}

        {activePane === "api-keys" ? (
          <div className="settings-pane active">
            <p className="muted settings-pane-note">
              Admin Keys manage operator access to this console. Gateway app keys live under Gateway, App Keys.
            </p>
            <div className="controller-filters settings-filters">
              <FormField label="Prefix"><input value={prefix} onChange={(event) => setPrefix(event.target.value)} /></FormField>
              <FormField label="Random Bytes"><input type="number" min={16} max={128} value={tokenBytes} onChange={(event) => setTokenBytes(Number(event.target.value))} /></FormField>
              <FormField label="Count"><input type="number" min={1} max={20} value={keyCount} onChange={(event) => setKeyCount(Number(event.target.value))} /></FormField>
              <FormField label="Apply To"><select value={applyTarget} onChange={(event) => setApplyTarget(event.target.value)}><option value="controller">Controller API Key</option><option value="registration">Registration Key (Agent)</option><option value="agent">Agent API Key</option></select></FormField>
              <button type="button" onClick={() => void generateKeys()}>Generate with Script</button>
              <button type="button" onClick={applyFirstKey}>Apply First Key</button>
            </div>
            <pre className="detail-json">{generated ? JSON.stringify(generated, null, 2) : "No generated keys yet."}</pre>
            <div className="controller-filters settings-filters">
              <FormField label="Key username"><input value={keyUsername} onChange={(event) => setKeyUsername(event.target.value)} /></FormField>
              <FormField label="Key role"><select value={keyRole} onChange={(event) => setKeyRole(event.target.value)}><option value="operator">operator</option><option value="admin">admin</option><option value="viewer">viewer</option></select></FormField>
              <button type="button" onClick={() => void createAuthKey()}>Create Auth Key</button>
              <button type="button" onClick={() => void refreshAuthKeys()}>Refresh Auth Keys</button>
            </div>
            <pre className="detail-json compact-json">{createdKey ? JSON.stringify(createdKey, null, 2) : "No key created yet."}</pre>
            <DataTable
              rows={authKeys}
              emptyMessage={authRole === "admin" ? "No keys found." : "Admin role required."}
              getRowKey={(key, index) => keyId(key) || String(index)}
              columns={[
                { key: "username", header: "Username", render: (key) => String(key.username || "-") },
                { key: "role", header: "Role", render: (key) => String(key.role || "-") },
                { key: "hint", header: "Hint", render: keyHint },
                { key: "revoked", header: "Revoked", render: (key) => String(Boolean(key.revoked)) },
                { key: "created", header: "Created", render: (key) => String(key.created_at || "-") },
                { key: "action", header: "Action", render: (key) => {
                  const id = keyId(key);
                  return <button type="button" aria-label={`Revoke ${id}`} disabled={!id || Boolean(key.revoked)} onClick={() => void revokeAuthKey(id)}>Revoke</button>;
                } },
              ]}
            />
          </div>
        ) : null}

        {activePane === "outputs" ? (
          <div className="settings-pane active">
            <p className="muted settings-pane-note">
              Generated Files are copyable outputs from the helper fields; downloading them does not change server config.
            </p>
            {outputUtilities()}
            <h3>Config YAML</h3>
            <pre className="detail-json tall-json">{configYaml}</pre>
            <h3>Env Exports</h3>
            <pre className="detail-json">{envExports}</pre>
          </div>
        ) : null}

        {activePane !== "outputs" ? (
          <div className="settings-output-preview">
            {outputUtilities()}
            <h3>Config YAML</h3>
            <pre className="detail-json tall-json">{configYaml}</pre>
            <h3>Env Exports</h3>
            <pre className="detail-json">{envExports}</pre>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
