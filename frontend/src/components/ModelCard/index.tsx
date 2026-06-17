import "./styles.css";
import { useId, useState, type ReactNode } from "react";
import type { LocalModel } from "../../types/models";
import { Button, StatusBadge } from "../ui";
import { isActiveModel, isLoadingModel } from "../../features/models/modelStatus";
import { modelName, statusTone } from "../../features/models";
import { IoStar, IoHome, IoCheckmarkCircle, IoStop, IoPlaySharp, IoChatbubbles, IoSend, IoTerminal, IoStatsChart, IoRefresh, IoLayers } from "react-icons/io5";

/* ---------- helpers ---------- */

function numberLabel(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function sizeLabel(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${numberLabel(value)} B`;
}

/**
 * Read a potentially model-related field from an object that may be either
 * a LocalModel (fields directly) or a GgufFile (fields prefixed with "model_").
 */
function field(model: Record<string, unknown>, localKey: string, ggufKey: string): unknown {
  return model[localKey] ?? model[ggufKey] ?? undefined;
}

function num(model: Record<string, unknown>, localKey: string, ggufKey: string): number | undefined {
  const v = field(model, localKey, ggufKey);
  return typeof v === "number" ? v : undefined;
}

function str(model: Record<string, unknown>, localKey: string, ggufKey: string): string | undefined {
  const v = field(model, localKey, ggufKey);
  return typeof v === "string" ? v : undefined;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function profileText(profile: Record<string, unknown>, key: string): string | null {
  const value = profile[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function profileNumber(profile: Record<string, unknown>, key: string): number | null {
  const value = profile[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function profileTitle(profile: Record<string, unknown>): string {
  return profileText(profile, "label") || profileText(profile, "profile_key") || "Profile";
}

function profileMeta(profile: Record<string, unknown>): string[] {
  const items: string[] = [];
  const profileKey = profileText(profile, "profile_key");
  const kind = profileText(profile, "kind");
  const ctx = profileNumber(profile, "ctx");
  const gpuLayers = profileNumber(profile, "gpu_layers");
  if (profileKey) items.push(profileKey);
  if (kind) items.push(kind);
  if (ctx !== null) items.push(`ctx ${numberLabel(ctx)}`);
  if (gpuLayers !== null) items.push(`${numberLabel(gpuLayers)} GPU layers`);
  return items;
}

function profileTags(profile: Record<string, unknown>): string[] {
  const items: string[] = [];
  const resourceTier = profileText(profile, "resource_tier");
  const kvCachePolicy = profileText(profile, "kv_cache_policy");
  const costTier = profileText(profile, "cost_tier");
  const strengths = strArray(profile.strengths);
  const extraArgs = strArray(profile.extra_args);
  if (resourceTier) items.push(resourceTier);
  if (kvCachePolicy) items.push(kvCachePolicy);
  if (costTier) items.push(costTier);
  if (strengths.length > 0) items.push(strengths.join(", "));
  if (extraArgs.length > 0) items.push(extraArgs.join(" "));
  return items;
}

/* ---------- props ---------- */

export type ModelCardProps = {
  /** The model or GGUF-file-like object to display. */
  model: LocalModel | Record<string, unknown>;

  /** Override the displayed node name. */
  resolvedNode?: string | null;

  /** Unique key for back-to-back actions. */
  actingModel?: string;

  /** Optional suffix appended to action aria-labels. */
  actionLabelSuffix?: string;

  // -- open / inspect --
  onOpen?: () => void;

  // -- lifecycle --
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;

  // -- actions --
  onChat?: () => void;
  onBenchmark?: () => void;
  onTransfer?: () => void;
  onLogs?: () => void;

  // -- library management (GGUF library page) --
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;

  /** Extra content rendered below the detail grid. */
  children?: ReactNode;
};

/* ---------- component ---------- */

export function ModelCard({
  model,
  resolvedNode,
  actingModel = "",
  actionLabelSuffix = "",
  onOpen,
  onStart,
  onStop,
  onRestart,
  onChat,
  onBenchmark,
  onTransfer,
  onLogs,
  onAdd,
  onEdit,
  onDelete,
  children,
}: ModelCardProps) {
  const [profilesOpen, setProfilesOpen] = useState(false);
  const profilesPanelId = useId();
  const raw = model as Record<string, unknown>;
  const name = modelName(model as Parameters<typeof modelName>[0]);
  const active = isActiveModel(model as Parameters<typeof isActiveModel>[0]);
  const loading = isLoadingModel(model as Parameters<typeof isLoadingModel>[0]);
  const status = str(raw, "status", "status") || "available";
  const port = num(raw, "port", "model_port");
  const pid = num(raw, "pid", "pid");
  const ctx = num(raw, "ctx", "model_ctx");
  const gpuLayers = num(raw, "gpu_layers", "model_gpu_layers");
  const host = str(raw, "host", "host");
  const reasoning = str(raw, "reasoning", "model_reasoning");
  const reasoningBudget = num(raw, "reasoning_budget", "model_reasoning_budget");
  const promptTemplate = str(raw, "prompt_template", "model_prompt_template");
  const bytes = num(raw, "size_bytes", "size_bytes");
  const favorite = Boolean(raw.favorite);
  const registered = Boolean(raw.registered);
  const registeredAs = str(raw, "registered_as", "registered_as");
  const filePath = str(raw, "path", "path") || str(raw, "model_path", "model_path") || "";
  const fileDir = str(raw, "model_dir", "model_dir") || "";
  const vision = Boolean(raw.vision || (raw as { supports?: { vision?: boolean } }).supports?.vision);
  const fileId = str(raw, "file_id", "file_id") || str(raw, "id", "id") || "";
  const catalog = (typeof raw.model_catalog === "object" && raw.model_catalog) ? raw.model_catalog as Record<string, unknown> : null;
  const profileRows = Array.isArray(raw.model_profiles) ? raw.model_profiles as Array<Record<string, unknown>> : [];
  const deploymentRows = Array.isArray(raw.model_deployments) ? raw.model_deployments as Array<Record<string, unknown>> : [];
  const strengths = strArray(raw.strengths).length > 0 ? strArray(raw.strengths) : strArray(catalog?.strengths);
  const costTier = typeof raw.cost_tier === "string" && raw.cost_tier ? raw.cost_tier : typeof catalog?.cost_tier === "string" ? catalog.cost_tier : undefined;
  const profileLabels = profileRows
    .map((profile) => (typeof profile.label === "string" && profile.label ? profile.label : typeof profile.profile_key === "string" ? profile.profile_key : ""))
    .filter((label) => label.length > 0);
  const deploymentLabels = deploymentRows
    .map((deployment) => {
      const host = typeof deployment.host === "string" ? deployment.host : "";
      const port = typeof deployment.port === "number" ? deployment.port : null;
      const profileKey = typeof deployment.profile_key === "string" && deployment.profile_key ? deployment.profile_key : "";
      if (!host || port === null) return "";
      return `${host}:${port}${profileKey ? ` (${profileKey})` : ""}`;
    })
    .filter((label) => label.length > 0);

  const hasActions = Boolean(profileRows.length > 0 || onStart || onStop || onRestart || onChat || onBenchmark || onTransfer || onLogs || onAdd || onEdit || onDelete);
  const labelSuffix = actionLabelSuffix ? ` ${actionLabelSuffix}` : "";

  const details: Array<[string, string]> = [];
  if (port !== undefined) details.push(["Port", String(port)]);
  if (pid !== undefined) details.push(["PID", String(pid)]);
  if (ctx !== undefined) details.push(["Context", numberLabel(ctx)]);
  if (gpuLayers !== undefined) details.push(["GPU Layers", String(gpuLayers)]);
  if (host) details.push(["Host", host]);
  if (reasoning) {
    details.push(["Reasoning", reasoningBudget !== undefined ? `${reasoning} / ${numberLabel(reasoningBudget)}` : reasoning]);
  }
  if (promptTemplate) details.push(["Template", promptTemplate]);
  if (bytes !== undefined) {
    const label = sizeLabel(bytes);
    if (label) details.push(["Size", label]);
  }
  if (strengths.length > 0) details.push(["Strengths", strengths.join(", ")]);
  if (costTier) details.push(["Cost Tier", costTier]);
  if (profileLabels.length > 0) details.push(["Profiles", `${profileLabels.length} ${profileLabels.length === 1 ? "profile" : "profiles"}`]);
  if (deploymentLabels.length > 0) details.push(["Deployments", deploymentLabels.join(", ")]);
  if (fileId) details.push(["File ID", fileId]);
  if (fileDir) details.push(["Directory", fileDir]);
  if (registeredAs) details.push(["Added as", registeredAs]);

  /** Render a button action row if at least one handler is provided. */
  function actions() {
    if (!hasActions) return null;
    return (
      <div className="model-actions">
        {onAdd ? (
          <Button onClick={onAdd} aria-label={`Add ${name}`}>
            Add
          </Button>
        ) : null}
        {onEdit ? (
          <Button variant="ghost" onClick={onEdit} aria-label={`Edit ${name}`}>
            Edit
          </Button>
        ) : null}
        {onStart ? (
          <Button variant="success" onClick={onStart} disabled={actingModel === `start:${name}`} aria-label={`Start ${name}${labelSuffix}`}>
            <IoPlaySharp />
          </Button>
        ) : null}
        {onStop ? (
          <Button variant="danger" onClick={onStop} disabled={actingModel === `stop:${name}`} aria-label={`Stop ${name}${labelSuffix}`}>
            <IoStop />
          </Button>
        ) : null}
        {onRestart ? (
          <Button onClick={onRestart} disabled={actingModel === `restart:${name}`} aria-label={`Restart ${name}${labelSuffix}`}>
            <IoRefresh />
          </Button>
        ) : null}
        {onChat ? (
          <Button variant="warning" onClick={onChat} aria-label={`Chat with ${name}${labelSuffix}`}>
            <IoChatbubbles />
          </Button>
        ) : null}
        {onBenchmark ? (
          <Button type="button" onClick={onBenchmark} aria-label={`Benchmark ${name}${labelSuffix}`}>
            <IoStatsChart />
          </Button>
        ) : null}
        {onTransfer ? (
          <Button variant="success" onClick={onTransfer} aria-label={`Send ${name}${labelSuffix}`}>
            <IoSend />
          </Button>
        ) : null}
        {onLogs ? (
          <Button type="button" onClick={onLogs} aria-label={`View logs for ${name}${labelSuffix}`}>
            <IoTerminal />
          </Button>
        ) : null}
        {profileRows.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            aria-controls={profilesPanelId}
            aria-expanded={profilesOpen}
            aria-label={`${profilesOpen ? "Hide" : "Show"} profiles for ${name}`}
            onClick={() => setProfilesOpen((open) => !open)}
          >
            <IoLayers />
          </Button>
        ) : null}
        {onDelete ? (
          <Button variant="danger" onClick={onDelete} aria-label={`Remove ${name}`}>
            Delete
          </Button>
        ) : null}
      </div>
    );
  }

  const stateClass = loading ? "loading" : active ? "active" : "";

  return (
    <article className={`library-card ${stateClass}`.trim()}>
      {onOpen ? (
        <button type="button" className="library-card-button" onClick={onOpen} aria-label={`Open ${name}`}>
          <strong>{name}</strong>
        </button>
      ) : (
        <div className="library-card-button">
          <strong>{name}</strong>
        </div>
      )}

      {/* Badge row */}
      <div className="library-card-badges">
        <StatusBadge tone={statusTone(status)}>
          <IoCheckmarkCircle /> {status}
        </StatusBadge>
        <StatusBadge tone="muted">
          <IoHome /> {resolvedNode || (registered ? "local" : "discovered")}
        </StatusBadge>
        {favorite ? (
          <StatusBadge tone="warning">
            <IoStar /> favorite
          </StatusBadge>
        ) : null}
        {vision ? (
          <StatusBadge tone="muted">Vision</StatusBadge>
        ) : null}
      </div>

      {/* Detail grid */}
      {filePath || details.length > 0 ? (
        <dl className="model-card-detail-grid">
          {filePath ? (
            <div>
              <dt>Path</dt>
              <dd>{filePath}</dd>
            </div>
          ) : null}
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children}

      {actions()}

      {profileRows.length > 0 && profilesOpen ? (
        <section id={profilesPanelId} className="model-profile-panel" aria-label={`Profiles for ${name}`}>
          {profileRows.map((profile, index) => {
            const meta = profileMeta(profile);
            const tags = profileTags(profile);
            const profileKey = profileText(profile, "profile_key") || String(index);
            return (
              <article className="model-profile-item" key={profileKey}>
                <div>
                  <strong>{profileTitle(profile)}</strong>
                  {meta.length > 0 ? <span>{meta.join(" · ")}</span> : null}
                </div>
                {tags.length > 0 ? (
                  <div className="model-profile-tags">
                    {tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </article>
  );
}
