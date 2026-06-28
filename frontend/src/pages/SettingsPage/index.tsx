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
import { ErrorBanner, Panel } from "../../components/ui";
import { useAppMode } from "../../features/appMode/appModeContext";
import { useAuthSession } from "../../features/auth/authSession";
import { useGlobalStatus } from "../../features/globalStatus/globalStatusContext";
import { managesLocalAccounts, runtimeTopology } from "../../features/runtimeMode/runtimeMode";
import { modelRootRows, normalizedModelRoots, parseJsonObject, parseJsonRecord, safeRootsText } from "../../features/settings/settingsForms";
import { AccessPane, RuntimeSettingsPane, StoragePane, ToolCatalogPane, ToolExecutionPane } from "./panes";
import type { AuthKey } from "../../types/index";

const EMPTY_RUNTIME_SETTINGS: RuntimeSettings = {
  hf_models_dirs: [],
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
  context_summarization_enabled: true,
  context_summarization_trigger_ratio: 0.75,
  context_summarization_target_ratio: 0.55,
  context_summarization_recent_messages: 4,
  context_summarization_max_tokens: 768,
  thread_history_compaction_enabled: true,
  thread_history_context_ratio: 0.55,
  thread_history_min_prompt_tokens: 6000,
  thread_history_recent_messages: 4,
  thread_history_summary_max_chars: 2000,
  thread_history_summary_item_max_chars: 240,
  agent_tools_enabled: false,
  agent_tools_max_iterations: 4,
  agent_tools_tool_timeout_seconds: 10,
  agent_tools_answer_verification_mode: "warn",
  agent_tools_answer_verification_max_retries: 1,
  agent_tools_safe_roots: [],
};

export function SettingsPage() {
  const appMode = useAppMode();
  const isAgentMode = appMode === "agent";
  const { controllerUrl } = useGlobalStatus();
  const topology = runtimeTopology(appMode, controllerUrl);
  const canManageLocalAccounts = managesLocalAccounts(topology);
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
  const [modelRootsStatus, setModelRootsStatus] = useState("");
  const [authKeys, setAuthKeys] = useState<AuthKey[]>([]);
  const [keyUsername, setKeyUsername] = useState("");
  const [keyRole, setKeyRole] = useState("operator");
  const [createdKey, setCreatedKey] = useState<Record<string, unknown> | null>(null);
  const [disks, setDisks] = useState<ModelDiskInfo[]>([]);
  const [error, setError] = useState("");
  const paneLabels = useMemo<Record<string, string>>(() => ({
    runtime: isAgentMode ? "Agent Runtime" : "Runtime",
    chatTools: "Tool Execution",
    toolCatalog: "Tool Catalog",
    storage: "Storage",
    access: "Access",
  }), [isAgentMode]);
  const paneDescriptions = useMemo<Record<string, string>>(() => ({
    runtime: isAgentMode ? "Editable worker settings for this agent." : "Editable controller, routing, worker, and memory behavior.",
    chatTools: "Editable limits for chat tool use.",
    toolCatalog: "Read-only catalog inspection with advanced profile editing.",
    storage: "Editable model roots plus disk diagnostics.",
    access: "Local account and API key operations.",
  }), [isAgentMode]);
  const visiblePanes = useMemo(
    () => {
      const panes = isAgentMode ? ["runtime", "chatTools", "storage"] : ["runtime", "chatTools", "toolCatalog", "storage"];
      return canManageLocalAccounts ? [...panes, "access"] : panes;
    },
    [canManageLocalAccounts, isAgentMode],
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

  function updateModelRoot(index: number, value: string) {
    setRuntimeSettings((current) => {
      const roots = modelRootRows(current.hf_models_dirs);
      roots[index] = value;
      return { ...current, hf_models_dirs: roots };
    });
  }

  function addModelRoot() {
    setRuntimeSettings((current) => ({ ...current, hf_models_dirs: [...modelRootRows(current.hf_models_dirs), ""] }));
  }

  function removeModelRoot(index: number) {
    setRuntimeSettings((current) => {
      const roots = modelRootRows(current.hf_models_dirs).filter((_, itemIndex) => itemIndex !== index);
      return { ...current, hf_models_dirs: modelRootRows(roots) };
    });
  }

  async function saveModelRoots() {
    if (authRole !== "admin") {
      setError("Admin role required.");
      return;
    }
    setError("");
    setModelRootsStatus("");
    try {
      const updated = await patchRuntimeSettings({
        hf_models_dirs: normalizedModelRoots(runtimeSettings.hf_models_dirs),
      });
      setRuntimeDocument(updated);
      setRuntimeSettings(updated.settings);
      setModelRootsStatus("Model roots saved");
      void listModelDisks()
        .then((payload) => setDisks(Array.isArray(payload) ? payload : []))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load model disks."));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save model roots.");
    }
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
        agent_tools_answer_verification_mode: runtimeSettings.agent_tools_answer_verification_mode,
        agent_tools_answer_verification_max_retries: runtimeSettings.agent_tools_answer_verification_max_retries,
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
        <div><span className="eyebrow">System</span><h2>Settings</h2></div>
        <span className="muted">{authUser ? `${authUser} (${authRole || "operator"})` : "Not logged in"}</span>
      </div>
      <ErrorBanner message={error} />
      <Panel className="settings-panel">
        <div className="settings-shell">
        <nav className="settings-tabs" aria-label="Settings Sections">
          {visiblePanes.map((pane) => (
            <button key={pane} type="button" className={`settings-tab ${activePane === pane ? "active" : ""}`} aria-current={activePane === pane ? "page" : undefined} aria-label={paneLabels[pane]} onClick={() => setActivePane(pane)}>
              <strong>{paneLabels[pane]}</strong>
              <span>{paneDescriptions[pane]}</span>
            </button>
          ))}
        </nav>
        <div className="settings-content">

        {activePane === "runtime" ? (
          <RuntimeSettingsPane
            isAgentMode={isAgentMode}
            runtimeDocument={runtimeDocument}
            runtimeSettings={runtimeSettings}
            agentWorkerLabelsText={agentWorkerLabelsText}
            agentWorkerCapacityText={agentWorkerCapacityText}
            clientCorsOriginsText={clientCorsOriginsText}
            runtimeStatus={runtimeStatus}
            updateRuntimeBoolean={updateRuntimeBoolean}
            updateRuntimeNumber={updateRuntimeNumber}
            updateRuntimeString={updateRuntimeString}
            setAgentWorkerLabelsText={setAgentWorkerLabelsText}
            setAgentWorkerCapacityText={setAgentWorkerCapacityText}
            setClientCorsOriginsText={setClientCorsOriginsText}
            saveRuntimeSettings={() => void saveRuntimeSettings()}
          />
        ) : null}

        {activePane === "chatTools" ? (
          <ToolExecutionPane
            runtimeDocument={runtimeDocument}
            runtimeSettings={runtimeSettings}
            agentToolsSafeRootsText={agentToolsSafeRootsText}
            chatToolsStatus={chatToolsStatus}
            updateRuntimeBoolean={updateRuntimeBoolean}
            updateRuntimeNumber={updateRuntimeNumber}
            updateRuntimeString={updateRuntimeString}
            setAgentToolsSafeRootsText={setAgentToolsSafeRootsText}
            saveChatTools={() => void saveChatTools()}
          />
        ) : null}

        {activePane === "toolCatalog" && !isAgentMode ? (
          <ToolCatalogPane
            toolCatalog={toolCatalog}
            selectedTool={selectedTool}
            toolSearch={toolSearch}
            toolTypeFilter={toolTypeFilter}
            toolTypes={toolTypes}
            filteredTools={filteredTools}
            toolDefinitionsText={toolDefinitionsText}
            toolProfilesText={toolProfilesText}
            activeToolProfile={activeToolProfile}
            toolCatalogStatus={toolCatalogStatus}
            setToolSearch={setToolSearch}
            setToolTypeFilter={setToolTypeFilter}
            setSelectedToolName={setSelectedToolName}
            setToolDefinitionsText={setToolDefinitionsText}
            setToolProfilesText={setToolProfilesText}
            setActiveToolProfile={setActiveToolProfile}
            saveToolCatalog={() => void saveToolCatalog()}
          />
        ) : null}

        {topology === "node_agent" ? (
          <p className="muted settings-pane-note">
            User accounts are managed on the controller at {controllerUrl}.
          </p>
        ) : null}

        {activePane === "access" && canManageLocalAccounts ? (
          <AccessPane
            authRole={authRole || ""}
            keyUsername={keyUsername}
            keyRole={keyRole}
            createdKey={createdKey}
            authKeys={authKeys}
            setKeyUsername={setKeyUsername}
            setKeyRole={setKeyRole}
            createAuthKey={() => void createAuthKey()}
            refreshAuthKeys={() => void refreshAuthKeys()}
            revokeAuthKey={(id) => void revokeAuthKey(id)}
          />
        ) : null}

        {activePane === "storage" ? (
          <StoragePane
            runtimeDocument={runtimeDocument}
            runtimeSettings={runtimeSettings}
            disks={disks}
            modelRootsStatus={modelRootsStatus}
            updateModelRoot={updateModelRoot}
            removeModelRoot={removeModelRoot}
            addModelRoot={addModelRoot}
            saveModelRoots={() => void saveModelRoots()}
          />
        ) : null}
        </div>
        </div>
      </Panel>
    </div>
  );
}
