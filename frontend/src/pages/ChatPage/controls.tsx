import { Button, FormField, Panel, StatusBadge } from "../../components/ui";
import type { AdvancedDefaults, ChatDefaults, ContextBudget } from "../../types/chat";
import type { LocalModel, ModelProfileCatalog, ModelProfileFamily } from "../../types";
import { firstProfileForFamily, modelOptionLabel, modelTarget } from "../../features/chat";
import { modelName } from "../../features/models";
import { contextBudgetPercent, contextBudgetSummary, formatCompactTokenCount } from "../../features/chat/chatView";

export function ChatControlsPanel({
  noModelLoaded,
  selectedModel,
  runningModels,
  profileFamilies,
  selectedFamily,
  selectedProfile,
  selectedProfileFamily,
  profileCatalog,
  target,
  targetOptions,
  preset,
  defaults,
  advanced,
  advancedOpen,
  pending,
  status,
  capabilities,
  capabilityDetail,
  inspectDetail,
  kvDetail,
  kvSlotActionId,
  contextBudget,
  contextBudgetError,
  activeConversationId,
  conversationApp,
  conversationPurpose,
  conversationPriority,
  conversationRequestType,
  includeInternal,
  threadRouteDetail,
  chatBootstrapLoaded,
  controllerChatUrl,
  onSelectModel,
  onTargetChange,
  onSelectedFamilyChange,
  onSelectedProfileChange,
  onPresetChange,
  onDefaultsChange,
  onAdvancedChange,
  onToggleAdvanced,
  onRefreshCapabilities,
  onCopyCapabilitiesJson,
  onInspectPrompt,
  onRefreshKvSlots,
  onKvSlotActionIdChange,
  onClearSelectedKvSlot,
  onActiveConversationIdChange,
  onConversationAppChange,
  onConversationPurposeChange,
  onConversationPriorityChange,
  onConversationRequestTypeChange,
  onIncludeInternalChange,
  onCreateConversation,
  onRefreshConversation,
}: {
  noModelLoaded: boolean;
  selectedModel: string;
  runningModels: LocalModel[];
  profileFamilies: ModelProfileFamily[];
  selectedFamily: string;
  selectedProfile: string;
  selectedProfileFamily: ModelProfileFamily | undefined;
  profileCatalog: ModelProfileCatalog;
  target: string;
  targetOptions: string[];
  preset: string;
  defaults: ChatDefaults;
  advanced: AdvancedDefaults;
  advancedOpen: boolean;
  pending: boolean;
  status: string;
  capabilities: Record<string, unknown> | null;
  capabilityDetail: string;
  inspectDetail: string;
  kvDetail: string;
  kvSlotActionId: string;
  contextBudget: ContextBudget | null;
  contextBudgetError: string;
  activeConversationId: string;
  conversationApp: string;
  conversationPurpose: string;
  conversationPriority: string;
  conversationRequestType: string;
  includeInternal: boolean;
  threadRouteDetail: string;
  chatBootstrapLoaded: boolean;
  controllerChatUrl: string;
  onSelectModel: (model: string) => void;
  onTargetChange: (target: string) => void;
  onSelectedFamilyChange: (family: string) => void;
  onSelectedProfileChange: (profile: string) => void;
  onPresetChange: (preset: string) => void;
  onDefaultsChange: (patch: Partial<ChatDefaults>) => void;
  onAdvancedChange: <K extends keyof AdvancedDefaults>(key: K, value: AdvancedDefaults[K]) => void;
  onToggleAdvanced: () => void;
  onRefreshCapabilities: () => void;
  onCopyCapabilitiesJson: () => void;
  onInspectPrompt: () => void;
  onRefreshKvSlots: () => void;
  onKvSlotActionIdChange: (value: string) => void;
  onClearSelectedKvSlot: () => void;
  onActiveConversationIdChange: (value: string) => void;
  onConversationAppChange: (value: string) => void;
  onConversationPurposeChange: (value: string) => void;
  onConversationPriorityChange: (value: string) => void;
  onConversationRequestTypeChange: (value: string) => void;
  onIncludeInternalChange: (value: boolean) => void;
  onCreateConversation: () => void;
  onRefreshConversation: () => void;
}) {
  return (
    <Panel title="Controls" eyebrow="Route and defaults" className={`side-panel${noModelLoaded ? " chat-controls-unavailable" : ""}`}>
      {noModelLoaded ? <p className="chat-controls-warning" role="status">Load a model before using chat controls.</p> : null}
      <fieldset className="stacked-controls chat-controls-fieldset" disabled={noModelLoaded} aria-disabled={noModelLoaded}>
        <FormField label="Model"><select value={selectedModel} onChange={(event) => {
          const nextModel = runningModels.find((model) => modelName(model) === event.target.value);
          onSelectModel(event.target.value);
          if (nextModel && modelTarget(nextModel)) onTargetChange(modelTarget(nextModel));
        }}>{runningModels.length ? runningModels.map((model) => <option key={`${modelName(model)}-${modelTarget(model) || "local"}`} value={modelName(model)}>{modelOptionLabel(model)}</option>) : <option value="">No loaded models</option>}</select></FormField>
        {profileFamilies.length ? (
          <>
            <FormField label="Model Family"><select value={selectedFamily} onChange={(event) => {
              const family = event.target.value;
              onSelectedFamilyChange(family);
              onSelectedProfileChange(firstProfileForFamily(profileCatalog, family));
            }}>{profileFamilies.map((family) => <option key={family.family} value={family.family}>{family.family}</option>)}</select></FormField>
            <FormField label="Context Profile"><select value={selectedProfile} onChange={(event) => onSelectedProfileChange(event.target.value)}>
              {(selectedProfileFamily?.profiles || []).map((profile) => <option key={profile.profile} value={profile.profile}>{profile.label || profile.profile}</option>)}
            </select></FormField>
          </>
        ) : null}
        <FormField label="Target"><select value={target} onChange={(event) => onTargetChange(event.target.value)}>{targetOptions.map((option) => <option key={option} value={option}>{option === "auto" ? "Auto" : option === "local" ? "Local" : option}</option>)}</select></FormField>
        <FormField label="Preset"><select value={preset} onChange={(event) => onPresetChange(event.target.value)}><option value="balanced">Balanced</option><option value="precise">Precise</option><option value="creative">Creative</option></select></FormField>
        <FormField label="Temperature"><input type="number" step="0.05" value={defaults.temperature} onChange={(event) => onDefaultsChange({ temperature: Number(event.target.value || 0) })} /></FormField>
        <FormField label="Max tokens"><input type="number" value={defaults.max_tokens} onChange={(event) => onDefaultsChange({ max_tokens: Number(event.target.value || 0) })} /></FormField>
        <FormField label="Top P"><input type="number" step="0.05" value={defaults.top_p} onChange={(event) => onDefaultsChange({ top_p: Number(event.target.value || 0) })} /></FormField>
        <Button type="button" onClick={onToggleAdvanced}>Advanced</Button>
        {advancedOpen ? (
          <AdvancedChatControls
            advanced={advanced}
            capabilities={capabilities}
            capabilityDetail={capabilityDetail}
            inspectDetail={inspectDetail}
            kvDetail={kvDetail}
            kvSlotActionId={kvSlotActionId}
            onAdvancedChange={onAdvancedChange}
            onRefreshCapabilities={onRefreshCapabilities}
            onCopyCapabilitiesJson={onCopyCapabilitiesJson}
            onInspectPrompt={onInspectPrompt}
            onRefreshKvSlots={onRefreshKvSlots}
            onKvSlotActionIdChange={onKvSlotActionIdChange}
            onClearSelectedKvSlot={onClearSelectedKvSlot}
          />
        ) : null}
        <StatusBadge tone={pending ? "warning" : "success"}>{status}</StatusBadge>
        <ContextBudgetSummary budget={contextBudget} error={contextBudgetError} />
        <ThreadControls
          activeConversationId={activeConversationId}
          conversationApp={conversationApp}
          conversationPurpose={conversationPurpose}
          conversationPriority={conversationPriority}
          conversationRequestType={conversationRequestType}
          includeInternal={includeInternal}
          pending={pending}
          chatBootstrapLoaded={chatBootstrapLoaded}
          controllerChatUrl={controllerChatUrl}
          threadRouteDetail={threadRouteDetail}
          onActiveConversationIdChange={onActiveConversationIdChange}
          onConversationAppChange={onConversationAppChange}
          onConversationPurposeChange={onConversationPurposeChange}
          onConversationPriorityChange={onConversationPriorityChange}
          onConversationRequestTypeChange={onConversationRequestTypeChange}
          onIncludeInternalChange={onIncludeInternalChange}
          onCreateConversation={onCreateConversation}
          onRefreshConversation={onRefreshConversation}
        />
      </fieldset>
    </Panel>
  );
}

function AdvancedChatControls({
  advanced,
  capabilities,
  capabilityDetail,
  inspectDetail,
  kvDetail,
  kvSlotActionId,
  onAdvancedChange,
  onRefreshCapabilities,
  onCopyCapabilitiesJson,
  onInspectPrompt,
  onRefreshKvSlots,
  onKvSlotActionIdChange,
  onClearSelectedKvSlot,
}: {
  advanced: AdvancedDefaults;
  capabilities: Record<string, unknown> | null;
  capabilityDetail: string;
  inspectDetail: string;
  kvDetail: string;
  kvSlotActionId: string;
  onAdvancedChange: <K extends keyof AdvancedDefaults>(key: K, value: AdvancedDefaults[K]) => void;
  onRefreshCapabilities: () => void;
  onCopyCapabilitiesJson: () => void;
  onInspectPrompt: () => void;
  onRefreshKvSlots: () => void;
  onKvSlotActionIdChange: (value: string) => void;
  onClearSelectedKvSlot: () => void;
}) {
  return (
    <div className="advanced-chat-panel">
      <FormField label="Top K"><input type="number" value={advanced.top_k} onChange={(event) => onAdvancedChange("top_k", Number(event.target.value || 0))} /></FormField>
      <FormField label="Min P"><input type="number" step="0.01" value={advanced.min_p} onChange={(event) => onAdvancedChange("min_p", Number(event.target.value || 0))} /></FormField>
      <FormField label="Repeat penalty"><input type="number" step="0.01" value={advanced.repeat_penalty} onChange={(event) => onAdvancedChange("repeat_penalty", Number(event.target.value || 0))} /></FormField>
      <FormField label="Seed"><input type="number" value={advanced.seed} onChange={(event) => onAdvancedChange("seed", Number(event.target.value || 0))} /></FormField>
      <FormField label="Stop tokens"><input value={advanced.stop} onChange={(event) => onAdvancedChange("stop", event.target.value)} placeholder="</s>, User:" /></FormField>
      <label className="checkbox-label"><input type="checkbox" checked={advanced.reasoning} onChange={(event) => onAdvancedChange("reasoning", event.target.checked)} />Reasoning</label>
      <label className="checkbox-label"><input type="checkbox" checked={advanced.cache_prompt} onChange={(event) => onAdvancedChange("cache_prompt", event.target.checked)} />Cache prompt</label>
      <FormField label="KV slot"><input type="number" value={advanced.slot_id} onChange={(event) => onAdvancedChange("slot_id", event.target.value)} placeholder="auto" /></FormField>
      <FormField label="Structured mode"><select value={advanced.structuredMode} onChange={(event) => onAdvancedChange("structuredMode", event.target.value as AdvancedDefaults["structuredMode"])}><option value="none">None</option><option value="json_schema">JSON Schema</option><option value="grammar">Grammar</option></select></FormField>
      <FormField label="JSON schema"><textarea value={advanced.jsonSchemaText} disabled={advanced.structuredMode !== "json_schema"} onChange={(event) => onAdvancedChange("jsonSchemaText", event.target.value)} rows={4} /></FormField>
      <FormField label="Grammar"><textarea value={advanced.grammarText} disabled={advanced.structuredMode !== "grammar"} onChange={(event) => onAdvancedChange("grammarText", event.target.value)} rows={4} /></FormField>
      <div className="modal-actions">
        <Button type="button" onClick={onRefreshCapabilities}>Refresh Capabilities</Button>
        <Button type="button" onClick={onCopyCapabilitiesJson} disabled={!capabilities}>Copy Capabilities JSON</Button>
        <Button type="button" onClick={onInspectPrompt}>Inspect prompt/template</Button>
        <Button type="button" onClick={onRefreshKvSlots}>Refresh KV slots</Button>
      </div>
      <div className="modal-actions">
        <FormField label="KV slot action id"><input type="number" value={kvSlotActionId} onChange={(event) => onKvSlotActionIdChange(event.target.value)} placeholder="slot id" /></FormField>
        <Button type="button" onClick={onClearSelectedKvSlot} disabled={!kvSlotActionId.trim()}>Clear slot</Button>
      </div>
      <p className="muted">Structured output: {advanced.structuredMode === "none" ? "disabled" : advanced.structuredMode}</p>
      <pre className="detail-json compact-json">{capabilityDetail}</pre>
      <pre className="detail-json compact-json">{inspectDetail}</pre>
      <pre className="detail-json compact-json">{kvDetail}</pre>
    </div>
  );
}

function ContextBudgetSummary({ budget, error }: { budget: ContextBudget | null; error: string }) {
  if (!budget) {
    return error ? <p className="muted" data-testid="context-budget-summary">{error}</p> : null;
  }
  return (
    <div className={`context-budget context-budget-${budget.status}`} data-testid="context-budget-summary">
      <div className="context-budget-header">
        <strong>{contextBudgetSummary(budget)}</strong>
        <span>{contextBudgetPercent(budget)}%</span>
      </div>
      <div
        className="context-budget-meter"
        role="progressbar"
        aria-label="Context used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={contextBudgetPercent(budget)}
      >
        <span style={{ width: `${contextBudgetPercent(budget)}%` }} />
      </div>
      <div className="context-budget-breakdown">
        <span>Prompt {formatCompactTokenCount(budget.prompt_tokens_estimated)}</span>
        <span>Reserved output {formatCompactTokenCount(budget.reserved_completion_tokens)}</span>
      </div>
      <small>{budget.precision === "approximate" ? "Approximate estimate" : "Tokenizer estimate"}</small>
    </div>
  );
}

function ThreadControls({
  activeConversationId,
  conversationApp,
  conversationPurpose,
  conversationPriority,
  conversationRequestType,
  includeInternal,
  pending,
  chatBootstrapLoaded,
  controllerChatUrl,
  threadRouteDetail,
  onActiveConversationIdChange,
  onConversationAppChange,
  onConversationPurposeChange,
  onConversationPriorityChange,
  onConversationRequestTypeChange,
  onIncludeInternalChange,
  onCreateConversation,
  onRefreshConversation,
}: {
  activeConversationId: string;
  conversationApp: string;
  conversationPurpose: string;
  conversationPriority: string;
  conversationRequestType: string;
  includeInternal: boolean;
  pending: boolean;
  chatBootstrapLoaded: boolean;
  controllerChatUrl: string;
  threadRouteDetail: string;
  onActiveConversationIdChange: (value: string) => void;
  onConversationAppChange: (value: string) => void;
  onConversationPurposeChange: (value: string) => void;
  onConversationPriorityChange: (value: string) => void;
  onConversationRequestTypeChange: (value: string) => void;
  onIncludeInternalChange: (value: boolean) => void;
  onCreateConversation: () => void;
  onRefreshConversation: () => void;
}) {
  return (
    <div className="thread-controls">
      <FormField label="Conversation ID"><input value={activeConversationId} onChange={(event) => onActiveConversationIdChange(event.target.value)} placeholder="conversation id" /></FormField>
      <FormField label="Conversation App"><input value={conversationApp} onChange={(event) => onConversationAppChange(event.target.value)} /></FormField>
      <FormField label="Conversation Purpose"><input value={conversationPurpose} onChange={(event) => onConversationPurposeChange(event.target.value)} /></FormField>
      <FormField label="Conversation Priority"><select value={conversationPriority} onChange={(event) => onConversationPriorityChange(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></FormField>
      <FormField label="Conversation Request Type"><select value={conversationRequestType} onChange={(event) => onConversationRequestTypeChange(event.target.value)}><option value="general">General</option><option value="coding">Coding</option><option value="analysis">Analysis</option></select></FormField>
      <label className="checkbox-label"><input type="checkbox" checked={includeInternal} onChange={(event) => onIncludeInternalChange(event.target.checked)} />Include internal events</label>
      <div className="modal-actions">
        <Button type="button" onClick={onCreateConversation} disabled={pending || !chatBootstrapLoaded || Boolean(controllerChatUrl)}>New Conversation</Button>
        <Button type="button" onClick={onRefreshConversation} disabled={pending || !activeConversationId}>Refresh Conversation</Button>
      </div>
      <pre className="detail-json">{threadRouteDetail}</pre>
    </div>
  );
}
