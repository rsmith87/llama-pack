export type PluginRow = {
  id: string;
  name: string;
  version: string;
  status: string;
  frontendEntry?: string | null;
  routes: string[];
  warnings: string[];
  errors: string[];
  health: Array<Record<string, string>>;
  config?: Record<string, unknown>;
  migrationStatus?: PluginMigrationStatus | null;
};

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
