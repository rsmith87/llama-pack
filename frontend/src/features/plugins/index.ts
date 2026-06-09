import { getEnabledPlugins, getPluginStatus, getPluginMigrationStatus } from "../../api/plugins";
import { PluginRow, PluginStatus, EnabledPlugin, PluginMigrationStatus } from "../../types/plugins";

function mergePluginRows(enabled: EnabledPlugin[], status: PluginStatus | null, migrations: Record<string, PluginMigrationStatus | null>): PluginRow[] {
  const enabledById = new Map(enabled.map((plugin) => [plugin.id, plugin]));
  const statusPlugins = status?.plugins || [];
  const ids = new Set([...enabledById.keys(), ...statusPlugins.map((plugin) => plugin.id)]);
  return Array.from(ids).sort().map((id) => {
    const metadata = enabledById.get(id);
    const statusItem = statusPlugins.find((plugin) => plugin.id === id);
    return {
      id,
      name: metadata?.name || id,
      version: statusItem?.version || metadata?.version || "",
      status: statusItem?.status || metadata?.status || "unknown",
      frontendEntry: metadata?.frontend?.entry || null,
      routes: [...(metadata?.navigation || []), ...(metadata?.ui_routes || [])]
        .map((item) => item.path)
        .filter((path): path is string => typeof path === "string" && path.length > 0),
      warnings: statusItem?.warnings || [],
      errors: statusItem?.errors || [],
      health: statusItem?.health || [],
      config: statusItem?.config,
      migrationStatus: migrations[id],
    };
  });
}

function listText(values: string[], empty = "None") {
  return values.length ? values.join(", ") : empty;
}

function actionLabelFor(plugin: PluginRow) {
  return plugin.status === "enabled" ? "Deactivate" : "Activate";
}

async function loadPluginRows(): Promise<PluginRow[]> {
  const [enabledPayload, statusPayload] = await Promise.all([getEnabledPlugins(), getPluginStatus()]);
  const enabledPlugins = Array.isArray(enabledPayload) ? enabledPayload : [];
  const ids = new Set([...enabledPlugins.map((plugin) => plugin.id), ...(statusPayload.plugins || []).map((plugin) => plugin.id)]);
  const migrationEntries = await Promise.all(
    Array.from(ids).sort().map(async (pluginId) => {
      try {
        return [pluginId, await getPluginMigrationStatus(pluginId)] as const;
      } catch {
        return [pluginId, null] as const;
      }
    })
  );
  return mergePluginRows(enabledPlugins, statusPayload, Object.fromEntries(migrationEntries));
}

function migrationSummary(status?: PluginMigrationStatus | null) {
  if (!status) return "Unavailable";
  if (!status.targets.length) return "No targets";
  const pending = status.targets.filter((target) => target.pending).length;
  if (pending) return `${pending} pending`;
  return "Current";
}

function statusTone(status: string) {
  if (status === "enabled") return "success";
  if (status === "disabled") return "muted";
  if (status === "incompatible") return "warning";
  return "danger";
}

export { 
  loadPluginRows,
  listText,
  actionLabelFor,
  migrationSummary,
  statusTone
}