import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { createKey, listKeys, revokeKey } from "../../api/auth";
import {
  getRuntimeSettings,
  getToolCatalog,
  listModelDisks,
  patchRuntimeSettings,
  patchToolCatalog,
  type ModelDiskInfo,
  type RuntimeSettings,
  type RuntimeSettingsDocument,
  type ToolCatalog,
} from "../../api/settings";
import { DataTable, ErrorBanner, FormField, Panel, Button, StatusBadge } from "../../components/ui";
import { useAppMode } from "../../features/appMode/appModeContext";
import { useAuthSession } from "../../features/auth/authSession";
import type { AuthKey } from "../../types/index";

function keyId(key: AuthKey) {
  return String(key.id || "");
}

function keyHint(key: AuthKey) {
  return String((key as Record<string, unknown>).key_hint || key.hint || "-");
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = -1;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(amount >= 10 || unitIndex <= 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const EMPTY_RUNTIME_SETTINGS: RuntimeSettings = {
  controller_retention_days: 30,
  controller_archive_retention_days: 90,
  controller_archive_dir: "./logs/archive",
  routing_fanout_enabled: false,
  routing_fanout_max: 2,
  agent_worker_enabled: false,
  agent_worker_poll_interval_seconds: 2,
  agent_worker_max_jobs: 1,
  agent_worker_labels: {},
  agent_worker_capacity: {},
  client_cors_origins: [],
  agent_tools_enabled: false,
  agent_tools_max_iterations: 4,
  agent_tools_tool_timeout_seconds: 10,
  agent_tools_safe_roots: [],
};

function parseJsonObject(value: string, label: string): Record<string, string | number | boolean | null> {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} must be a JSON object.`);
  }
  for (const entry of Object.values(parsed)) {
    if (entry !== null && typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean") {
      throw new Error(`${label} values must be strings, numbers, booleans, or null.`);
    }
  }
  return parsed as Record<string, string | number | boolean | null>;
}

function parseJsonRecord(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function sourceFor(document: RuntimeSettingsDocument | null, key: keyof RuntimeSettings) {
  return document?.sources?.[key] || "default";
}

function safeRootsText(value: string[] | undefined): string {
  return (value || []).join("\n");
}

function jsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function summaryValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(" ");
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SettingsPage() {
  const appMode = useAppMode();
  const isAgentMode = appMode === "agent";
  const { authUser, authRole } = useAuthSession();
  const [activePane, setActivePane] = useState("runtime");
  const [runtimeDocument, setRuntimeDocument] = useState<RuntimeSettingsDocument | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings>(EMPTY_RUNTIME_SETTINGS);
  const [agentWorkerLabelsText, setAgentWorkerLabelsText] = useState("{}");
  const [agentWorkerCapacityText, setAgentWorkerCapacityText] = useState("{}");
  const [clientCorsOriginsText, setClientCorsOriginsText] = useState("");
  const [agentToolsSafeRootsText, setAgentToolsSafeRootsText] = useState("");
  const [toolCatalog, setToolCatalog] = useState<ToolCatalog>({
    enabled: false,
    safe_roots: [],
    tool_count: 0,
    tools: [],
    definitions: {},
    profiles: {},
    active_profile: null,
    sources: {},
  });
  const [selectedToolName, setSelectedToolName] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [toolTypeFilter, setToolTypeFilter] = useState("all");
  const [toolDefinitionsText, setToolDefinitionsText] = useState("{}");
  const [toolProfilesText, setToolProfilesText] = useState("{}");
  const [activeToolProfile, setActiveToolProfile] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState("");
  const [chatToolsStatus, setChatToolsStatus] = useState("");
  const [toolCatalogStatus, setToolCatalogStatus] = useState("");
  const [authKeys, setAuthKeys] = useState<AuthKey[]>([]);
  const [keyUsername, setKeyUsername] = useState("");
  const [keyRole, setKeyRole] = useState("operator");
  const [createdKey, setCreatedKey] = useState<Record<string, unknown> | null>(null);
  const [disks, setDisks] = useState<ModelDiskInfo[]>([]);
  const [error, setError] = useState("");
  const paneLabels = useMemo<Record<string, string>>(() => ({
    runtime: isAgentMode ? "Agent Runtime" : "Runtime Settings",
    chatTools: "Chat Tools",
    toolCatalog: "Tool Catalog",
    storage: "Storage",
    access: "Access",
  }), [isAgentMode]);
  const visiblePanes = useMemo(
    () => isAgentMode ? ["runtime", "chatTools", "storage"] : ["runtime", "chatTools", "toolCatalog", "storage", "access"],
    [isAgentMode],
  );
  const selectedTool = toolCatalog.tools.find((tool) => tool.name === selectedToolName) || toolCatalog.tools[0] || null;
  const toolTypes = Array.from(new Set(toolCatalog.tools.map((tool) => tool.type))).sort();
  const filteredTools = toolCatalog.tools.filter((tool) => {
    const matchesType = toolTypeFilter === "all" || tool.type === toolTypeFilter;
    const text = `${tool.name} ${tool.type} ${tool.description}`.toLowerCase();
    return matchesType && text.includes(toolSearch.trim().toLowerCase());
  });

  useEffect(() => {
    let cancelled = false;
    void listModelDisks()
      .then((payload) => {
        if (!cancelled) setDisks(Array.isArray(payload) ? payload : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load model disks.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAgentMode) return;
    let cancelled = false;
    void getToolCatalog()
      .then((payload) => {
        if (cancelled) return;
        const tools = Array.isArray(payload.tools) ? payload.tools : [];
        const catalog = {
          ...payload,
          tools,
          definitions: payload.definitions || {},
          profiles: payload.profiles || {},
          safe_roots: Array.isArray(payload.safe_roots) ? payload.safe_roots : [],
          tool_count: Number(payload.tool_count || tools.length),
        };
        setToolCatalog(catalog);
        setToolDefinitionsText(JSON.stringify(catalog.definitions, null, 2));
        setToolProfilesText(JSON.stringify(catalog.profiles, null, 2));
        setActiveToolProfile(catalog.active_profile || "");
        setSelectedToolName((current) => current || tools[0]?.name || "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load tool catalog.");
      });
    return () => {
      cancelled = true;
    };
  }, [isAgentMode]);

  useEffect(() => {
    if (!visiblePanes.includes(activePane)) {
      setActivePane(visiblePanes[0]);
    }
  }, [activePane, visiblePanes]);

  useEffect(() => {
    let cancelled = false;
    void getRuntimeSettings()
      .then((payload) => {
        if (cancelled) return;
        setRuntimeDocument(payload);
        setRuntimeSettings(payload.settings);
        setAgentWorkerLabelsText(JSON.stringify(payload.settings.agent_worker_labels, null, 2));
        setAgentWorkerCapacityText(JSON.stringify(payload.settings.agent_worker_capacity, null, 2));
        setClientCorsOriginsText(payload.settings.client_cors_origins.join("\n"));
        setAgentToolsSafeRootsText(safeRootsText(payload.settings.agent_tools_safe_roots));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load runtime settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function updateRuntimeNumber(key: keyof RuntimeSettings, value: string) {
    setRuntimeSettings((current) => ({ ...current, [key]: Number(value) }));
  }

  function updateRuntimeBoolean(key: keyof RuntimeSettings, value: boolean) {
    setRuntimeSettings((current) => ({ ...current, [key]: value }));
  }

  function updateRuntimeString(key: keyof RuntimeSettings, value: string) {
    setRuntimeSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveRuntimeSettings() {
    if (authRole !== "admin") {
      setError("Admin role required.");
      return;
    }
    setError("");
    setRuntimeStatus("");
    try {
      const agentWorkerSettings = {
        agent_worker_labels: parseJsonObject(agentWorkerLabelsText, "Agent Worker Labels"),
        agent_worker_capacity: parseJsonObject(agentWorkerCapacityText, "Agent Worker Capacity"),
      };
      const payload: Partial<RuntimeSettings> = isAgentMode ? {
        agent_worker_enabled: runtimeSettings.agent_worker_enabled,
        agent_worker_poll_interval_seconds: runtimeSettings.agent_worker_poll_interval_seconds,
        agent_worker_max_jobs: runtimeSettings.agent_worker_max_jobs,
        ...agentWorkerSettings,
      } : {
        ...runtimeSettings,
        ...agentWorkerSettings,
        client_cors_origins: clientCorsOriginsText.split("\n").map((item) => item.trim()).filter(Boolean),
      };
      const updated = await patchRuntimeSettings(payload);
      setRuntimeDocument(updated);
      setRuntimeSettings(updated.settings);
      setAgentWorkerLabelsText(JSON.stringify(updated.settings.agent_worker_labels, null, 2));
      setAgentWorkerCapacityText(JSON.stringify(updated.settings.agent_worker_capacity, null, 2));
      setClientCorsOriginsText(updated.settings.client_cors_origins.join("\n"));
      setAgentToolsSafeRootsText(safeRootsText(updated.settings.agent_tools_safe_roots));
      setRuntimeStatus("Runtime settings saved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save runtime settings.");
    }
  }

  async function saveChatTools() {
    if (authRole !== "admin") {
      setError("Admin role required.");
      return;
    }
    setError("");
    setChatToolsStatus("");
    try {
      const updated = await patchRuntimeSettings({
        agent_tools_enabled: runtimeSettings.agent_tools_enabled,
        agent_tools_max_iterations: runtimeSettings.agent_tools_max_iterations,
        agent_tools_tool_timeout_seconds: runtimeSettings.agent_tools_tool_timeout_seconds,
        agent_tools_safe_roots: agentToolsSafeRootsText.split("\n").map((item) => item.trim()).filter(Boolean),
      });
      setRuntimeDocument(updated);
      setRuntimeSettings(updated.settings);
      setAgentToolsSafeRootsText(safeRootsText(updated.settings.agent_tools_safe_roots));
      setChatToolsStatus("Chat tool settings saved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save chat tool settings.");
    }
  }

  async function saveToolCatalog() {
    if (authRole !== "admin") {
      setError("Admin role required.");
      return;
    }
    setError("");
    setToolCatalogStatus("");
    try {
      const updated = await patchToolCatalog({
        tools: parseJsonRecord(toolDefinitionsText, "Tool Definitions") as Record<string, Record<string, unknown>>,
        profiles: parseJsonRecord(toolProfilesText, "Tool Profiles") as Record<string, { description?: string | null; safe_roots: string[]; tools: string[] }>,
        active_profile: activeToolProfile.trim() || null,
      });
      const tools = Array.isArray(updated.tools) ? updated.tools : [];
      const catalog = {
        ...updated,
        tools,
        definitions: updated.definitions || {},
        profiles: updated.profiles || {},
        safe_roots: Array.isArray(updated.safe_roots) ? updated.safe_roots : [],
        tool_count: Number(updated.tool_count || tools.length),
      };
      setToolCatalog(catalog);
      setToolDefinitionsText(JSON.stringify(catalog.definitions, null, 2));
      setToolProfilesText(JSON.stringify(catalog.profiles, null, 2));
      setActiveToolProfile(catalog.active_profile || "");
      setSelectedToolName((current) => current && tools.some((tool) => tool.name === current) ? current : tools[0]?.name || "");
      setToolCatalogStatus("Tool catalog saved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save tool catalog.");
    }
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
          {visiblePanes.map((pane) => (
            <button key={pane} type="button" className={`settings-tab ${activePane === pane ? "active" : ""}`} aria-selected={activePane === pane} onClick={() => setActivePane(pane)}>{paneLabels[pane]}</button>
          ))}
        </div>

        {activePane === "runtime" ? (
          <div className="settings-pane active">
            <div className="settings-section-heading">
              <h3>{paneLabels.runtime}</h3>
              <span className="muted">Source: {sourceFor(runtimeDocument, isAgentMode ? "agent_worker_max_jobs" : "routing_fanout_max")}</span>
            </div>
            <div className="settings-grid">
              {!isAgentMode ? (
                <>
                  <FormField label="Controller Retention Days">
                    {sourceFor(runtimeDocument, "controller_retention_days")}
                    <input aria-label="Controller Retention Days" type="number" min={1} value={runtimeSettings && runtimeSettings.controller_retention_days ? runtimeSettings.controller_retention_days :30} onChange={(event) => updateRuntimeNumber("controller_retention_days", event.target.value)} />
                    <span className="settings-source">{sourceFor(runtimeDocument, "controller_retention_days") ?? "default"}</span>
                  </FormField>
                  <FormField label="Controller Archive Retention Days">
                    <input aria-label="Controller Archive Retention Days" type="number" min={1} value={runtimeSettings && runtimeSettings.controller_archive_retention_days ? runtimeSettings.controller_archive_retention_days : 90} onChange={(event) => updateRuntimeNumber("controller_archive_retention_days", event.target.value)} />
                    <span className="settings-source">{sourceFor(runtimeDocument, "controller_archive_retention_days")}</span>
                  </FormField>
                  <FormField label="Controller Archive Directory">
                    <input aria-label="Controller Archive Directory" value={runtimeSettings && runtimeSettings.controller_archive_dir ? runtimeSettings.controller_archive_dir : "./logs/archive"} onChange={(event) => updateRuntimeString("controller_archive_dir", event.target.value)} />
                    <span className="settings-source">{sourceFor(runtimeDocument, "controller_archive_dir")}</span>
                  </FormField>
                  <FormField label="Routing Fanout Enabled">
                    <label className="checkbox-label">
                      <input aria-label="Routing Fanout Enabled" type="checkbox" checked={runtimeSettings && runtimeSettings.routing_fanout_enabled ? runtimeSettings.routing_fanout_enabled : false} onChange={(event) => updateRuntimeBoolean("routing_fanout_enabled", event.target.checked)} />
                      <span>{runtimeSettings && runtimeSettings.routing_fanout_enabled ? "Enabled" : "Disabled"}</span>
                    </label>
                    <span className="settings-source">{sourceFor(runtimeDocument, "routing_fanout_enabled")}</span>
                  </FormField>
                  <FormField label="Routing Fanout Max">
                    <input aria-label="Routing Fanout Max" type="number" min={1} max={32} value={runtimeSettings && runtimeSettings.routing_fanout_max ? runtimeSettings.routing_fanout_max : 2} onChange={(event) => updateRuntimeNumber("routing_fanout_max", event.target.value)} />
                    <span className="settings-source">{sourceFor(runtimeDocument, "routing_fanout_max")}</span>
                  </FormField>
                </>
              ) : null}
              <FormField label="Agent Worker Enabled">
                <label className="checkbox-label">
                  <input aria-label="Agent Worker Enabled" type="checkbox" checked={runtimeSettings && runtimeSettings.agent_worker_enabled ? runtimeSettings.agent_worker_enabled : false} onChange={(event) => updateRuntimeBoolean("agent_worker_enabled", event.target.checked)} />
                  <span>{runtimeSettings && runtimeSettings.agent_worker_enabled ? "Enabled" : "Disabled"}</span>
                </label>
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_worker_enabled")}</span>
              </FormField>
              <FormField label="Agent Worker Poll Interval Seconds">
                <input aria-label="Agent Worker Poll Interval Seconds" type="number" min={1} value={runtimeSettings && runtimeSettings.agent_worker_poll_interval_seconds ? runtimeSettings.agent_worker_poll_interval_seconds : 2} onChange={(event) => updateRuntimeNumber("agent_worker_poll_interval_seconds", event.target.value)} />
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_worker_poll_interval_seconds")}</span>
              </FormField>
              <FormField label="Agent Worker Max Jobs">
                <input aria-label="Agent Worker Max Jobs" type="number" min={1} max={128} value={runtimeSettings && runtimeSettings.agent_worker_max_jobs ? runtimeSettings.agent_worker_max_jobs : 1} onChange={(event) => updateRuntimeNumber("agent_worker_max_jobs", event.target.value)} />
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_worker_max_jobs")}</span>
              </FormField>
            </div>
            <div className="settings-grid settings-grid-wide">
              <FormField label="Agent Worker Labels">
                <textarea aria-label="Agent Worker Labels" rows={5} value={agentWorkerLabelsText} onChange={(event) => setAgentWorkerLabelsText(event.target.value)} />
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_worker_labels")}</span>
              </FormField>
              <FormField label="Agent Worker Capacity">
                <textarea aria-label="Agent Worker Capacity" rows={5} value={agentWorkerCapacityText} onChange={(event) => setAgentWorkerCapacityText(event.target.value)} />
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_worker_capacity")}</span>
              </FormField>
              {!isAgentMode ? (
                <FormField label="Client CORS Origins">
                    <textarea aria-label="Client CORS Origins" rows={5} value={clientCorsOriginsText} onChange={(event) => setClientCorsOriginsText(event.target.value)} />
                    <span className="settings-source">{sourceFor(runtimeDocument, "client_cors_origins")}</span>
                </FormField>
              ) : null}
            </div>
            <div className="modal-actions settings-utilities">
              <Button type="button" onClick={() => void saveRuntimeSettings()}>Save Runtime Settings</Button>
              {runtimeStatus ? <span className="muted">{runtimeStatus}</span> : null}
            </div>
          </div>
        ) : null}

        {activePane === "chatTools" ? (
          <div className="settings-pane active">
            <div className="settings-section-heading">
              <h3>Chat Tools</h3>
              <span className="muted">Source: {sourceFor(runtimeDocument, "agent_tools_enabled")}</span>
            </div>
            <div className="settings-grid">
              <FormField label="Agent Tools Enabled">
                <label className="checkbox-label">
                  <input aria-label="Agent Tools Enabled" type="checkbox" checked={runtimeSettings.agent_tools_enabled} onChange={(event) => updateRuntimeBoolean("agent_tools_enabled", event.target.checked)} />
                  <span>{runtimeSettings.agent_tools_enabled ? "Enabled" : "Disabled"}</span>
                </label>
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_tools_enabled")}</span>
              </FormField>
              <FormField label="Agent Tools Max Iterations">
                <input aria-label="Agent Tools Max Iterations" type="number" min={1} max={32} value={runtimeSettings.agent_tools_max_iterations} onChange={(event) => updateRuntimeNumber("agent_tools_max_iterations", event.target.value)} />
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_tools_max_iterations")}</span>
              </FormField>
              <FormField label="Agent Tools Timeout Seconds">
                <input aria-label="Agent Tools Timeout Seconds" type="number" min={1} step="0.5" value={runtimeSettings.agent_tools_tool_timeout_seconds} onChange={(event) => updateRuntimeNumber("agent_tools_tool_timeout_seconds", event.target.value)} />
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_tools_tool_timeout_seconds")}</span>
              </FormField>
            </div>
            <div className="settings-grid settings-grid-wide">
              <FormField label="Agent Tools Safe Roots">
                <textarea aria-label="Agent Tools Safe Roots" rows={6} value={agentToolsSafeRootsText} onChange={(event) => setAgentToolsSafeRootsText(event.target.value)} />
                <span className="settings-source">{sourceFor(runtimeDocument, "agent_tools_safe_roots")}</span>
              </FormField>
            </div>
            <div className="modal-actions settings-utilities">
              <Button type="button" onClick={() => void saveChatTools()}>Save Chat Tools</Button>
              {chatToolsStatus ? <span className="muted">{chatToolsStatus}</span> : null}
            </div>
          </div>
        ) : null}

        {activePane === "toolCatalog" && !isAgentMode ? (
          <div className="settings-pane active">
            <div className="settings-section-heading">
              <h3>Tool Catalog</h3>
              <span className="muted">{toolCatalog.tool_count} configured tools</span>
            </div>
            <div className="controller-filters settings-filters">
              <FormField label="Search Tools">
                <input aria-label="Search Tools" value={toolSearch} onChange={(event) => setToolSearch(event.target.value)} />
              </FormField>
              <FormField label="Tool Type">
                <select aria-label="Tool Type" value={toolTypeFilter} onChange={(event) => setToolTypeFilter(event.target.value)}>
                  <option value="all">All Types</option>
                  {toolTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </FormField>
              <StatusBadge tone={toolCatalog.enabled ? "success" : "warning"}>{toolCatalog.enabled ? "enabled" : "disabled"}</StatusBadge>
            </div>
            <div className="settings-tool-catalog">
              <DataTable
                rows={filteredTools}
                emptyMessage="No configured tools."
                getRowKey={(tool) => tool.name}
                columns={[
                  { key: "name", header: "Name", render: (tool) => tool.name },
                  { key: "type", header: "Type", render: (tool) => tool.type },
                  { key: "description", header: "Description", render: (tool) => tool.description },
                  {
                    key: "safety",
                    header: "Safety",
                    render: (tool) => (
                      <StatusBadge tone={tool.safety.status === "error" ? "danger" : tool.safety.status === "warning" ? "warning" : "success"}>
                        {tool.safety.status}
                      </StatusBadge>
                    ),
                  },
                  {
                    key: "action",
                    header: "Action",
                    render: (tool) => <button type="button" aria-label={`Inspect ${tool.name}`} onClick={() => setSelectedToolName(tool.name)}>Inspect</button>,
                  },
                ]}
              />
              <div className="tool-inspector">
                {selectedTool ? (
                  <>
                    <div className="settings-section-heading">
                      <h3>{selectedTool.name}</h3>
                      <StatusBadge tone={selectedTool.safety.status === "error" ? "danger" : selectedTool.safety.status === "warning" ? "warning" : "success"}>{selectedTool.type}</StatusBadge>
                    </div>
                    <p className="muted">{selectedTool.description}</p>
                    <div className="tool-summary-list">
                      {Object.entries(selectedTool.summary).map(([key, value]) => (
                        <div key={key}><span>{key}</span><strong>{summaryValue(value)}</strong></div>
                      ))}
                    </div>
                    <p className="muted">{selectedTool.safety.message}</p>
                    <h4>Parameters</h4>
                    <pre className="detail-json compact-json">{jsonPreview(selectedTool.parameters)}</pre>
                    <h4>Limits</h4>
                    <pre className="detail-json compact-json">{jsonPreview(selectedTool.limits)}</pre>
                  </>
                ) : (
                  <p className="muted">No tool selected.</p>
                )}
              </div>
            </div>
            <div className="settings-grid settings-grid-wide tool-catalog-editors">
              <FormField label="Tool Definitions JSON">
                <textarea aria-label="Tool Definitions JSON" rows={10} value={toolDefinitionsText} onChange={(event) => setToolDefinitionsText(event.target.value)} />
              </FormField>
              <FormField label="Tool Profiles JSON">
                <textarea aria-label="Tool Profiles JSON" rows={10} value={toolProfilesText} onChange={(event) => setToolProfilesText(event.target.value)} />
              </FormField>
              <FormField label="Active Tool Profile">
                <input aria-label="Active Tool Profile" list="active-tool-profile-options" value={activeToolProfile} onChange={(event) => setActiveToolProfile(event.target.value)} />
                <datalist id="active-tool-profile-options">
                  {Object.keys(toolCatalog.profiles).sort().map((profileName) => (
                    <option key={profileName} value={profileName} />
                  ))}
                </datalist>
              </FormField>
            </div>
            <div className="modal-actions settings-utilities">
              <Button type="button" onClick={() => void saveToolCatalog()}>Save Tool Catalog</Button>
              {toolCatalogStatus ? <span className="muted">{toolCatalogStatus}</span> : null}
            </div>
          </div>
        ) : null}

        {activePane === "access" && !isAgentMode ? (
          <div className="settings-pane active">
            <p className="muted settings-pane-note">
              Admin Keys manage operator access to this console. Gateway app keys live under Gateway, App Keys.
            </p>
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

        {activePane === "storage" ? (
          <div className="settings-pane active">
            <p className="muted settings-pane-note">
              Disks shows configured model roots with filesystem capacity and current space consumed under each root.
            </p>
            <DataTable
              rows={disks}
              emptyMessage="No configured model disks."
              getRowKey={(disk, index) => `${disk.node_name}:${disk.path || index}`}
              columns={[
                { key: "node", header: "Node", render: (disk) => disk.node_name },
                { key: "path", header: "Path", render: (disk) => disk.path },
                {
                  key: "status",
                  header: "Status",
                  render: (disk) => (
                    <StatusBadge tone={disk.status === "error" ? "danger" : disk.status === "warning" ? "warning" : "success"}>
                      {disk.status === "error" ? "error" : disk.status === "warning" ? "low space" : "ok"}
                    </StatusBadge>
                  ),
                },
                { key: "consumed", header: "Consumed", render: (disk) => formatBytes(disk.consumed_bytes) },
                { key: "free", header: "Free", render: (disk) => formatBytes(disk.free_bytes) },
                { key: "used", header: "Used", render: (disk) => formatBytes(disk.used_bytes) },
                { key: "total", header: "Total", render: (disk) => formatBytes(disk.total_bytes) },
                { key: "available", header: "Available %", render: (disk) => `${Number(disk.available_percent || 0).toFixed(1)}%` },
                { key: "warning", header: "Warning", render: (disk) => disk.error || disk.warning || "-" },
              ]}
            />
          </div>
        ) : null}

      </Panel>
    </div>
  );
}
