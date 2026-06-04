import { useEffect, useMemo, useState } from "react";
import { getEnabledPlugins, getPluginMigrationStatus, getPluginStatus, type EnabledPlugin, type PluginMigrationStatus, type PluginStatus } from "../../api/plugins";
import { DataTable, ErrorBanner, Panel, StatusBadge, Button } from "../../components/ui";

type PluginRow = {
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

function statusTone(status: string) {
  if (status === "enabled") return "success";
  if (status === "disabled") return "muted";
  if (status === "incompatible") return "warning";
  return "danger";
}

function migrationSummary(status?: PluginMigrationStatus | null) {
  if (!status) return "Unavailable";
  if (!status.targets.length) return "No targets";
  const pending = status.targets.filter((target) => target.pending).length;
  if (pending) return `${pending} pending`;
  return "Current";
}

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

export function PluginsPage() {
  const [enabled, setEnabled] = useState<EnabledPlugin[]>([]);
  const [status, setStatus] = useState<PluginStatus | null>(null);
  const [migrations, setMigrations] = useState<Record<string, PluginMigrationStatus | null>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [enabledPayload, statusPayload] = await Promise.all([getEnabledPlugins(), getPluginStatus()]);
      const enabledPlugins = Array.isArray(enabledPayload) ? enabledPayload : [];
      const migrationEntries = await Promise.all(
        enabledPlugins.map(async (plugin) => {
          try {
            return [plugin.id, await getPluginMigrationStatus(plugin.id)] as const;
          } catch {
            return [plugin.id, null] as const;
          }
        })
      );
      setEnabled(enabledPlugins);
      setStatus(statusPayload);
      setMigrations(Object.fromEntries(migrationEntries));
      const ids = new Set([...enabledPlugins.map((plugin) => plugin.id), ...(statusPayload.plugins || []).map((plugin) => plugin.id)]);
      setSelectedId((existing) => existing && ids.has(existing) ? existing : Array.from(ids).sort()[0] || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plugins unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => mergePluginRows(enabled, status, migrations), [enabled, status, migrations]);
  const selected = rows.find((row) => row.id === selectedId) || rows[0];

  return (
    <div className="plugins-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Extensions</span>
          <h2>Plugins</h2>
          <p className="muted">Runtime metadata, health, assets, and migration status for configured plugins.</p>
        </div>
        <Button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</Button>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <Panel title="Configured Plugins" eyebrow="Status">
        <DataTable
          rows={rows}
          emptyMessage={loading ? "Loading plugins..." : "No plugins configured."}
          getRowKey={(row) => row.id}
          columns={[
            { key: "id", header: "Plugin", render: (row) => <button className="table-link-button" type="button" onClick={() => setSelectedId(row.id)}>{row.name}</button> },
            { key: "status", header: "Status", render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
            { key: "version", header: "Version", render: (row) => row.version || "-" },
            { key: "routes", header: "Routes", render: (row) => row.routes.length },
            { key: "migrations", header: "Migrations", render: (row) => migrationSummary(row.migrationStatus) },
            { key: "issues", header: "Issues", render: (row) => row.errors.length + row.warnings.length },
          ]}
        />
      </Panel>
      {selected ? (
        <Panel title={selected.name} eyebrow="Detail">
          <div className="detail-grid">
            <div><span className="muted">ID</span><strong>{selected.id}</strong></div>
            <div><span className="muted">Version</span><strong>{selected.version || "-"}</strong></div>
            <div><span className="muted">Status</span><StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge></div>
            <div><span className="muted">Frontend entry</span><strong>{selected.frontendEntry || "-"}</strong></div>
            <div><span className="muted">Routes</span><strong>{listText(selected.routes)}</strong></div>
            <div><span className="muted">Warnings</span><strong>{listText(selected.warnings)}</strong></div>
            <div><span className="muted">Errors</span><strong>{listText(selected.errors)}</strong></div>
            <div><span className="muted">Config</span><strong>{selected.config ? JSON.stringify(selected.config) : "{}"}</strong></div>
          </div>
          <h4>Health</h4>
          <DataTable
            rows={selected.health}
            emptyMessage="No health entries."
            getRowKey={(row, index) => `${row.level || "entry"}-${index}`}
            columns={[
              { key: "level", header: "Level", render: (row) => <StatusBadge tone={String(row.level) === "error" ? "danger" : String(row.level) === "warning" ? "warning" : "success"}>{String(row.level || "ok")}</StatusBadge> },
              { key: "message", header: "Message", render: (row) => String(row.message || "") },
            ]}
          />
          <h4>Migrations</h4>
          <DataTable
            rows={selected.migrationStatus?.targets || []}
            emptyMessage="No migration targets."
            getRowKey={(row) => row.id}
            columns={[
              { key: "id", header: "Target", render: (row) => row.id },
              { key: "status", header: "Status", render: (row) => <StatusBadge tone={row.pending ? "warning" : row.status === "current" ? "success" : "muted"}>{row.status}</StatusBadge> },
              { key: "current", header: "Current", render: (row) => row.current_revision || "-" },
              { key: "head", header: "Head", render: (row) => row.head_revision || "-" },
              { key: "directory", header: "Directory", render: (row) => row.directory },
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
