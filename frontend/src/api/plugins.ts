import { apiGet, apiPost } from "./client";

export type PluginNavigationItem = {
  label?: string;
  path?: string;
};

export type EnabledPlugin = {
  id: string;
  name: string;
  version: string;
  status: "enabled";
  frontend?: {
    entry?: string | null;
    style?: string | null;
  } | null;
  navigation?: PluginNavigationItem[];
  secondary_navigation?: PluginNavigationItem[];
  ui_routes?: PluginNavigationItem[];
};

export type PluginStatus = {
  plugins: Array<{
    id: string;
    status: string;
    version: string;
    health: Array<Record<string, string>>;
    warnings: string[];
    errors: string[];
    config?: Record<string, unknown>;
  }>;
};

export type PluginActionResult = {
  id: string;
  status: string;
  version: string;
  warnings: string[];
  errors: string[];
};

export type PluginMigrationStatus = {
  plugin_id: string;
  targets: PluginMigrationTarget[];
};

export type PluginMigrationTarget = {
    id: string;
    directory: string;
    database_name?: string | null;
    database_path?: string | null;
    database_url?: string | null;
    current_revision?: string | null;
    head_revision?: string | null;
    status: string;
    pending: boolean;
    last_error?: string | null;
};

export type PluginMigrationUpgradeResult = {
  plugin_id: string;
  target: PluginMigrationTarget;
};

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
