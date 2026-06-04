import { apiGet } from "./client";

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

export function getEnabledPlugins() {
  return apiGet<EnabledPlugin[]>("/plugins/enabled");
}

export function getPluginStatus() {
  return apiGet<PluginStatus>("/plugins/status");
}
