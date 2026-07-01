import type { ReactNode } from "react";
import { Button, DataTable, FormField, StatusBadge } from "../../components/ui";
import type { ModelDiskInfo, RuntimeSettings, RuntimeSettingsDocument, ToolCatalog, ToolCatalogItem } from "../../api/settings";
import type { AuthKey } from "../../types";
import { formatBytes, jsonPreview, modelRootRows, summaryValue } from "../../features/settings/settingsForms";

export function sourceFor(document: RuntimeSettingsDocument | null, key: keyof RuntimeSettings) {
  return document?.sources?.[key] || "default";
}

export function SettingSection({
  title,
  description,
  badge,
  badgeTone,
  source,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  badgeTone: "success" | "muted" | "warning";
  source: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-section" aria-label={title}>
      <div className="settings-section-heading">
        <div>
          <div className="settings-section-title">
            <h3>{title}</h3>
            <StatusBadge tone={badgeTone}>{badge}</StatusBadge>
          </div>
          <p className="muted">{description}</p>
        </div>
        <span className="settings-source-chip">Source: {source}</span>
      </div>
      {children}
    </section>
  );
}

export function ToolExecutionPane({
  runtimeDocument,
  runtimeSettings,
  agentToolsSafeRootsText,
  chatToolsStatus,
  updateRuntimeBoolean,
  updateRuntimeNumber,
  updateRuntimeString,
  setAgentToolsSafeRootsText,
  saveChatTools,
}: {
  runtimeDocument: RuntimeSettingsDocument | null;
  runtimeSettings: RuntimeSettings;
  agentToolsSafeRootsText: string;
  chatToolsStatus: string;
  updateRuntimeBoolean: (key: keyof RuntimeSettings, value: boolean) => void;
  updateRuntimeNumber: (key: keyof RuntimeSettings, value: string) => void;
  updateRuntimeString: (key: keyof RuntimeSettings, value: string) => void;
  setAgentToolsSafeRootsText: (value: string) => void;
  saveChatTools: () => void;
}) {
  return (
    <div className="settings-pane active">
      <SettingSection
        title="Tool Execution"
        description="Set the runtime guardrails used when chat sessions call local tools."
        badge="Editable"
        badgeTone="success"
        source={sourceFor(runtimeDocument, "agent_tools_enabled")}
      >
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
        <FormField label="Answer Verification Mode">
          <select aria-label="Answer Verification Mode" value={runtimeSettings.agent_tools_answer_verification_mode} onChange={(event) => updateRuntimeString("agent_tools_answer_verification_mode", event.target.value)}>
            <option value="off">off</option>
            <option value="warn">warn</option>
            <option value="strict">strict</option>
          </select>
          <span className="settings-source">{sourceFor(runtimeDocument, "agent_tools_answer_verification_mode")}</span>
        </FormField>
        <FormField label="Answer Verification Max Retries">
          <input aria-label="Answer Verification Max Retries" type="number" min={0} max={2} value={runtimeSettings.agent_tools_answer_verification_max_retries} onChange={(event) => updateRuntimeNumber("agent_tools_answer_verification_max_retries", event.target.value)} />
          <span className="settings-source">{sourceFor(runtimeDocument, "agent_tools_answer_verification_max_retries")}</span>
        </FormField>
      </div>
      <div className="settings-grid settings-grid-wide">
        <FormField label="Agent Tools Safe Roots">
          <textarea aria-label="Agent Tools Safe Roots" rows={6} value={agentToolsSafeRootsText} onChange={(event) => setAgentToolsSafeRootsText(event.target.value)} />
          <span className="settings-source">{sourceFor(runtimeDocument, "agent_tools_safe_roots")}</span>
        </FormField>
      </div>
      </SettingSection>
      <div className="modal-actions settings-utilities">
        <Button type="button" onClick={saveChatTools}>Save Chat Tools</Button>
        {chatToolsStatus ? <span className="muted">{chatToolsStatus}</span> : null}
      </div>
    </div>
  );
}

function keyId(key: AuthKey) {
  return String(key.id || "");
}

function keyHint(key: AuthKey) {
  return String((key as Record<string, unknown>).key_hint || key.hint || "-");
}

export function RuntimeSettingsPane({
  isAgentMode,
  runtimeDocument,
  runtimeSettings,
  agentWorkerLabelsText,
  agentWorkerCapacityText,
  clientCorsOriginsText,
  runtimeStatus,
  updateRuntimeBoolean,
  updateRuntimeNumber,
  updateRuntimeString,
  setAgentWorkerLabelsText,
  setAgentWorkerCapacityText,
  setClientCorsOriginsText,
  saveRuntimeSettings,
}: {
  isAgentMode: boolean;
  runtimeDocument: RuntimeSettingsDocument | null;
  runtimeSettings: RuntimeSettings;
  agentWorkerLabelsText: string;
  agentWorkerCapacityText: string;
  clientCorsOriginsText: string;
  runtimeStatus: string;
  updateRuntimeBoolean: (key: keyof RuntimeSettings, value: boolean) => void;
  updateRuntimeNumber: (key: keyof RuntimeSettings, value: string) => void;
  updateRuntimeString: (key: keyof RuntimeSettings, value: string) => void;
  setAgentWorkerLabelsText: (value: string) => void;
  setAgentWorkerCapacityText: (value: string) => void;
  setClientCorsOriginsText: (value: string) => void;
  saveRuntimeSettings: () => void;
}) {
  return (
    <div className="settings-pane active">
      <SettingSection
        title={isAgentMode ? "Agent Runtime" : "Runtime Settings"}
        description={isAgentMode ? "Tune the local worker loop and capacity advertised by this agent." : "Set controller behavior that can change while the product is running."}
        badge="Editable"
        badgeTone="success"
        source={sourceFor(runtimeDocument, isAgentMode ? "agent_worker_max_jobs" : "routing_fanout_max")}
      >
      <div className="settings-grid">
        {!isAgentMode ? (
          <>
            <FormField label="Controller Retention Days">
              {sourceFor(runtimeDocument, "controller_retention_days")}
              <input aria-label="Controller Retention Days" type="number" min={1} value={runtimeSettings && runtimeSettings.controller_retention_days ? runtimeSettings.controller_retention_days : 30} onChange={(event) => updateRuntimeNumber("controller_retention_days", event.target.value)} />
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
            <FormField label="Display Timezone">
              <input aria-label="Display Timezone" list="display-timezone-options" value={runtimeSettings.display_timezone} onChange={(event) => updateRuntimeString("display_timezone", event.target.value)} />
              <datalist id="display-timezone-options">
                <option value="UTC" />
                <option value="America/Chicago" />
                <option value="America/New_York" />
                <option value="America/Los_Angeles" />
                <option value="Europe/London" />
              </datalist>
              <span className="settings-source">{sourceFor(runtimeDocument, "display_timezone")}</span>
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
      </SettingSection>
      {!isAgentMode ? (
        <>
          <SettingSection
            title="Memory and Context"
            description="Control when long chat context is summarized before it affects model performance."
            badge="Editable"
            badgeTone="success"
            source={sourceFor(runtimeDocument, "context_summarization_enabled")}
          >
          <div className="settings-grid">
            <FormField label="Context Summarization Enabled">
              <label className="checkbox-label">
                <input aria-label="Context Summarization Enabled" type="checkbox" checked={runtimeSettings.context_summarization_enabled} onChange={(event) => updateRuntimeBoolean("context_summarization_enabled", event.target.checked)} />
                <span>{runtimeSettings.context_summarization_enabled ? "Enabled" : "Disabled"}</span>
              </label>
              <span className="settings-source">{sourceFor(runtimeDocument, "context_summarization_enabled")}</span>
            </FormField>
            <FormField label="Context Summarization Trigger Ratio">
              <input aria-label="Context Summarization Trigger Ratio" type="number" min={0.01} max={1} step="0.01" value={runtimeSettings.context_summarization_trigger_ratio} onChange={(event) => updateRuntimeNumber("context_summarization_trigger_ratio", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "context_summarization_trigger_ratio")}</span>
            </FormField>
            <FormField label="Context Summarization Target Ratio">
              <input aria-label="Context Summarization Target Ratio" type="number" min={0.01} max={1} step="0.01" value={runtimeSettings.context_summarization_target_ratio} onChange={(event) => updateRuntimeNumber("context_summarization_target_ratio", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "context_summarization_target_ratio")}</span>
            </FormField>
            <FormField label="Context Summarization Recent Messages">
              <input aria-label="Context Summarization Recent Messages" type="number" min={1} max={100} value={runtimeSettings.context_summarization_recent_messages} onChange={(event) => updateRuntimeNumber("context_summarization_recent_messages", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "context_summarization_recent_messages")}</span>
            </FormField>
            <FormField label="Context Summarization Max Tokens">
              <input aria-label="Context Summarization Max Tokens" type="number" min={64} max={8192} value={runtimeSettings.context_summarization_max_tokens} onChange={(event) => updateRuntimeNumber("context_summarization_max_tokens", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "context_summarization_max_tokens")}</span>
            </FormField>
          </div>
          </SettingSection>
          <SettingSection
            title="Thread History"
            description="Keep thread history compact while preserving recent messages for follow-up work."
            badge="Editable"
            badgeTone="success"
            source={sourceFor(runtimeDocument, "thread_history_compaction_enabled")}
          >
          <div className="settings-grid">
            <FormField label="Thread History Compaction Enabled">
              <label className="checkbox-label">
                <input aria-label="Thread History Compaction Enabled" type="checkbox" checked={runtimeSettings.thread_history_compaction_enabled} onChange={(event) => updateRuntimeBoolean("thread_history_compaction_enabled", event.target.checked)} />
                <span>{runtimeSettings.thread_history_compaction_enabled ? "Enabled" : "Disabled"}</span>
              </label>
              <span className="settings-source">{sourceFor(runtimeDocument, "thread_history_compaction_enabled")}</span>
            </FormField>
            <FormField label="Thread History Context Ratio">
              <input aria-label="Thread History Context Ratio" type="number" min={0.01} max={1} step="0.01" value={runtimeSettings.thread_history_context_ratio} onChange={(event) => updateRuntimeNumber("thread_history_context_ratio", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "thread_history_context_ratio")}</span>
            </FormField>
            <FormField label="Thread History Min Prompt Tokens">
              <input aria-label="Thread History Min Prompt Tokens" type="number" min={1} value={runtimeSettings.thread_history_min_prompt_tokens} onChange={(event) => updateRuntimeNumber("thread_history_min_prompt_tokens", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "thread_history_min_prompt_tokens")}</span>
            </FormField>
            <FormField label="Thread History Recent Messages">
              <input aria-label="Thread History Recent Messages" type="number" min={1} max={100} value={runtimeSettings.thread_history_recent_messages} onChange={(event) => updateRuntimeNumber("thread_history_recent_messages", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "thread_history_recent_messages")}</span>
            </FormField>
            <FormField label="Thread History Summary Max Chars">
              <input aria-label="Thread History Summary Max Chars" type="number" min={100} value={runtimeSettings.thread_history_summary_max_chars} onChange={(event) => updateRuntimeNumber("thread_history_summary_max_chars", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "thread_history_summary_max_chars")}</span>
            </FormField>
            <FormField label="Thread History Summary Item Max Chars">
              <input aria-label="Thread History Summary Item Max Chars" type="number" min={20} value={runtimeSettings.thread_history_summary_item_max_chars} onChange={(event) => updateRuntimeNumber("thread_history_summary_item_max_chars", event.target.value)} />
              <span className="settings-source">{sourceFor(runtimeDocument, "thread_history_summary_item_max_chars")}</span>
            </FormField>
          </div>
          </SettingSection>
        </>
      ) : null}
      <div className="modal-actions settings-utilities">
        <Button type="button" onClick={saveRuntimeSettings}>Save Runtime Settings</Button>
        {runtimeStatus ? <span className="muted">{runtimeStatus}</span> : null}
      </div>
    </div>
  );
}

export function ToolCatalogPane({
  toolCatalog,
  selectedTool,
  toolSearch,
  toolTypeFilter,
  toolTypes,
  filteredTools,
  toolDefinitionsText,
  toolProfilesText,
  activeToolProfile,
  toolCatalogStatus,
  setToolSearch,
  setToolTypeFilter,
  setSelectedToolName,
  setToolDefinitionsText,
  setToolProfilesText,
  setActiveToolProfile,
  saveToolCatalog,
}: {
  toolCatalog: ToolCatalog;
  selectedTool: ToolCatalogItem | null;
  toolSearch: string;
  toolTypeFilter: string;
  toolTypes: string[];
  filteredTools: ToolCatalogItem[];
  toolDefinitionsText: string;
  toolProfilesText: string;
  activeToolProfile: string;
  toolCatalogStatus: string;
  setToolSearch: (value: string) => void;
  setToolTypeFilter: (value: string) => void;
  setSelectedToolName: (value: string) => void;
  setToolDefinitionsText: (value: string) => void;
  setToolProfilesText: (value: string) => void;
  setActiveToolProfile: (value: string) => void;
  saveToolCatalog: () => void;
}) {
  return (
    <div className="settings-pane active">
      <SettingSection
        title="Tool Catalog"
        description="Inspect the effective tool registry available to chat sessions."
        badge="Read-only"
        badgeTone="muted"
        source={`${toolCatalog.tool_count} configured tools`}
      >
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
      </SettingSection>
      <SettingSection
        title="Tool Profiles"
        description="Edit database-backed profile overrides without changing bootstrap configuration files."
        badge="Advanced"
        badgeTone="warning"
        source={toolCatalog.active_profile || "none"}
      >
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
      </SettingSection>
      <div className="modal-actions settings-utilities">
        <Button type="button" onClick={saveToolCatalog}>Save Tool Catalog</Button>
        {toolCatalogStatus ? <span className="muted">{toolCatalogStatus}</span> : null}
      </div>
    </div>
  );
}

export function StoragePane({
  runtimeDocument,
  runtimeSettings,
  disks,
  modelRootsStatus,
  updateModelRoot,
  removeModelRoot,
  addModelRoot,
  saveModelRoots,
}: {
  runtimeDocument: RuntimeSettingsDocument | null;
  runtimeSettings: RuntimeSettings;
  disks: ModelDiskInfo[];
  modelRootsStatus: string;
  updateModelRoot: (index: number, value: string) => void;
  removeModelRoot: (index: number) => void;
  addModelRoot: () => void;
  saveModelRoots: () => void;
}) {
  return (
    <div className="settings-pane active">
      <SettingSection
        title="Model Roots"
        description="Configure the directories where this installation stores and discovers local models."
        badge="Editable"
        badgeTone="success"
        source={sourceFor(runtimeDocument, "hf_models_dirs")}
      >
      <div className="model-roots-editor">
        {modelRootRows(runtimeSettings.hf_models_dirs).map((root, index) => (
          <div className="model-root-row" key={index}>
            <FormField label={`Model Root ${index + 1}`}>
              <input
                aria-label={`Model Root ${index + 1}`}
                value={root}
                onChange={(event) => updateModelRoot(index, event.target.value)}
              />
            </FormField>
            <button type="button" aria-label={`Remove Model Root ${index + 1}`} onClick={() => removeModelRoot(index)}>Remove</button>
          </div>
        ))}
        <div className="modal-actions settings-utilities">
          <button type="button" onClick={addModelRoot}>Add Model Root</button>
          <Button type="button" onClick={saveModelRoots}>Save Model Roots</Button>
          {modelRootsStatus ? <span className="muted">{modelRootsStatus}</span> : null}
        </div>
      </div>
      </SettingSection>
      <SettingSection
        title="Disk Diagnostics"
        description="Read-only filesystem capacity and model consumption reported for configured roots."
        badge="Read-only"
        badgeTone="muted"
        source="runtime probe"
      >
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
      </SettingSection>
    </div>
  );
}

export function AccessPane({
  authRole,
  keyUsername,
  keyRole,
  createdKey,
  authKeys,
  setKeyUsername,
  setKeyRole,
  createAuthKey,
  refreshAuthKeys,
  revokeAuthKey,
  formatDisplayDateTime,
}: {
  authRole: string;
  keyUsername: string;
  keyRole: string;
  createdKey: Record<string, unknown> | null;
  authKeys: AuthKey[];
  setKeyUsername: (value: string) => void;
  setKeyRole: (value: string) => void;
  createAuthKey: () => void;
  refreshAuthKeys: () => void;
  revokeAuthKey: (id: string) => void;
  formatDisplayDateTime: (value: string | null | undefined) => string;
}) {
  return (
    <div className="settings-pane active">
      <SettingSection
        title="Local Accounts"
        description="Manage human access to this console. Gateway app keys live under Gateway, App Keys."
        badge="Operational"
        badgeTone="warning"
        source={authRole || "operator"}
      >
      <div className="controller-filters settings-filters">
        <FormField label="Key username"><input value={keyUsername} onChange={(event) => setKeyUsername(event.target.value)} /></FormField>
        <FormField label="Key role"><select value={keyRole} onChange={(event) => setKeyRole(event.target.value)}><option value="operator">operator</option><option value="admin">admin</option><option value="viewer">viewer</option></select></FormField>
        <button type="button" onClick={createAuthKey}>Create Auth Key</button>
        <button type="button" onClick={refreshAuthKeys}>Refresh Auth Keys</button>
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
          { key: "created", header: "Created", render: (key) => formatDisplayDateTime(key.created_at) },
          { key: "action", header: "Action", render: (key) => {
            const id = keyId(key);
            return <button type="button" aria-label={`Revoke ${id}`} disabled={!id || Boolean(key.revoked)} onClick={() => revokeAuthKey(id)}>Revoke</button>;
          } },
        ]}
      />
      </SettingSection>
    </div>
  );
}
