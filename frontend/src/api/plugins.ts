import { apiGet, apiPost } from "./client";
import { 
  EnabledPlugin,
  PluginStatus,
  PluginMigrationStatus,
  PluginMigrationUpgradeResult,
  PluginActionResult
} from "../types/plugins";

export function getEnabledPlugins() {
  return apiGet<EnabledPlugin[]>("/plugins/enabled");
}

export function getPluginStatus() {
  return apiGet<PluginStatus>("/plugins/status");
}

export function getPluginMigrationStatus(pluginId: string) {
  return apiGet<PluginMigrationStatus>(`/plugins/${encodeURIComponent(pluginId)}/migrations/status`);
}

export function upgradePluginMigrationTarget(pluginId: string, targetId: string) {
  return apiPost<PluginMigrationUpgradeResult>(
    `/plugins/${encodeURIComponent(pluginId)}/migrations/${encodeURIComponent(targetId)}/upgrade`,
  );
}

export function activatePlugin(pluginId: string) {
  return apiPost<PluginActionResult>(`/plugins/${encodeURIComponent(pluginId)}/activate`);
}

export function deactivatePlugin(pluginId: string) {
  return apiPost<PluginActionResult>(`/plugins/${encodeURIComponent(pluginId)}/deactivate`);
}
