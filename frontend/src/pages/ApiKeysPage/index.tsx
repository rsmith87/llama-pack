import "./styles.css";
import { useRef, useState } from "react";
import { createExternalKey, getExternalKeyAnalytics, listExternalKeys, revokeExternalKey } from "../../api/externalKeys";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { Button, DataTable, ErrorBanner, FormField, Modal, Panel } from "../../components/ui";
import type { ExternalApiKey, ExternalApiKeyAnalytics, ExternalApiKeyCreated } from "../../types/api";

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

function lastRouteLabel(row: ExternalApiKey) {
  if (!row.last_used_route && !row.last_used_model) {
    return "-";
  }
  const route = row.last_used_route || row.last_used_node || "unknown route";
  return row.last_used_model ? `${route} · ${row.last_used_model}` : route;
}

function topCounts(counts?: Record<string, number>) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "-";
  return entries.slice(0, 3).map(([name, count]) => `${name} (${count})`).join(", ");
}

function KeyRevealBanner({
  created,
  onDismiss,
}: {
  created: ExternalApiKeyCreated;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const keyRef = useRef<HTMLInputElement>(null);

  function copyKey() {
    const val = created.key || "";
    navigator.clipboard.writeText(val).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="api-key-reveal-banner" role="alert">
      <div className="api-key-reveal-header">
        <strong>API key generated — copy it now</strong>
        <span className="muted api-key-reveal-warning">
          This key will not be shown again.
        </span>
      </div>
      <div className="api-key-reveal-row">
        <input
          ref={keyRef}
          className="api-key-reveal-input"
          type="text"
          readOnly
          value={created.key || ""}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Generated API key"
        />
        <Button variant="primary" size="sm" onClick={copyKey}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div className="api-key-reveal-meta muted">
        Site: <strong>{created.site_name}</strong>
        {created.site_url ? (
          <>
            {" · "}
            <a href={created.site_url} target="_blank" rel="noopener noreferrer">
              {created.site_url}
            </a>
          </>
        ) : null}
      </div>
      <div className="api-key-reveal-hint muted">
        Send as <code>X-Llama-Manager-Key: {created.key}</code> on requests to{" "}
        <code>POST /v1/chat/completions</code> or <code>POST /api/chat</code>.
      </div>
      <Button variant="ghost" size="sm" className="api-key-reveal-dismiss" onClick={onDismiss}>
        I've copied the key — dismiss
      </Button>
    </div>
  );
}

function KeyAnalyticsModal({
  selectedKey,
  analytics,
  loading,
  error,
  onClose,
}: {
  selectedKey: ExternalApiKey | null;
  analytics: ExternalApiKeyAnalytics | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <Modal title={selectedKey ? `${selectedKey.site_name || "External app"} analytics` : "External app analytics"} open={Boolean(selectedKey)} onClose={onClose}>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <p className="muted">Loading analytics...</p> : null}
      {!loading && analytics ? (
        <div className="api-key-analytics">
          <div className="api-key-metrics">
            <div className="api-key-metric">
              <span className="muted">Total calls</span>
              <strong>{analytics.total_calls || 0}</strong>
            </div>
            <div className="api-key-metric">
              <span className="muted">Endpoints</span>
              <strong>{topCounts(analytics.endpoint_counts)}</strong>
            </div>
            <div className="api-key-metric">
              <span className="muted">Models</span>
              <strong>{topCounts(analytics.model_counts)}</strong>
            </div>
            <div className="api-key-metric">
              <span className="muted">Request types</span>
              <strong>{topCounts(analytics.request_type_counts)}</strong>
            </div>
          </div>
          <div className="api-key-analytics-section">
            <h3>Recent calls</h3>
            <DataTable
              rows={analytics.recent_calls || []}
              emptyMessage="No external calls recorded for this key."
              getRowKey={(row, index) => `${row.created_at || "call"}-${index}`}
              columns={[
                { key: "created_at", header: "Time", render: (row) => formatDateTime(row.created_at) },
                { key: "endpoint", header: "Endpoint", render: (row) => String(row.endpoint || "-") },
                { key: "model", header: "Model", render: (row) => String(row.model || "-") },
                { key: "route", header: "Route", render: (row) => String(row.route || row.node || "-") },
                { key: "request_type", header: "Type", render: (row) => String(row.request_type || "-") },
              ]}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function ApiKeysPage() {
  const { data: keys, loading, error, refresh, setError } = useAsyncResource<ExternalApiKey[]>(
    () => listExternalKeys().then((data) => data.keys || []),
    [],
  );
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<ExternalApiKeyCreated | null>(null);
  const [analyticsKey, setAnalyticsKey] = useState<ExternalApiKey | null>(null);
  const [analytics, setAnalytics] = useState<ExternalApiKeyAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");


  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const name = siteName.trim();
    const url = siteUrl.trim();
    if (!name || !url) {
      setError("Site name and site URL are required.");
      return;
    }
    setCreating(true);
    setError("");
    setNewKey(null);
    try {
      const created = await createExternalKey({ site_name: name, site_url: url });
      setNewKey(created);
      setSiteName("");
      setSiteUrl("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setError("");
    try {
      await revokeExternalKey(keyId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  }

  async function openAnalytics(row: ExternalApiKey) {
    if (!row.id) return;
    setAnalyticsKey(row);
    setAnalytics(null);
    setAnalyticsError("");
    setAnalyticsLoading(true);
    try {
      setAnalytics(await getExternalKeyAnalytics(row.id));
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : "Failed to load key analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);

  return (
    <div className="api-keys-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Gateway Access</span>
          <h2>External App Keys</h2>
        </div>
        <span className="muted">Issue chat-only keys for apps that should call completions without managing infrastructure</span>
      </div>

      <ErrorBanner message={error} />

      {newKey ? (
        <KeyRevealBanner created={newKey} onDismiss={() => setNewKey(null)} />
      ) : null}

      <Panel eyebrow="New key" title="Generate external app key">
        <form className="api-key-form" onSubmit={handleGenerate}>
          <div className="api-key-form-fields">
            <FormField label="Site name">
              <input
                className="input"
                type="text"
                placeholder="My Application"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
                maxLength={120}
                autoComplete="off"
              />
            </FormField>
            <FormField label="Site URL" hint="Used for display only; not validated as a callback.">
              <input
                className="input"
                type="url"
                placeholder="https://example.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                required
                maxLength={512}
                autoComplete="off"
              />
            </FormField>
          </div>
          <Button type="submit" variant="primary" size="md" disabled={creating}>
            {creating ? "Generating…" : "Generate external app key"}
          </Button>
        </form>
      </Panel>

      <Panel
        eyebrow="Active"
        title="External app keys"
        actions={
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        }
      >
        <DataTable<ExternalApiKey>
          columns={[
            {
              key: "site_name",
              header: "Site name",
              render: (row) => (
                <button type="button" className="api-key-link-button" onClick={() => void openAnalytics(row)}>
                  {String(row.site_name || "-")}
                </button>
              ),
            },
            {
              key: "site_url",
              header: "Site URL",
              render: (row) =>
                row.site_url ? (
                  <a href={row.site_url} target="_blank" rel="noopener noreferrer" className="api-key-url-link">
                    {row.site_url}
                  </a>
                ) : (
                  "-"
                ),
            },
            { key: "key_hint", header: "Key hint", render: (row) => <code>{String(row.key_hint || "-")}</code> },
            {
              key: "created_at",
              header: "Created",
              render: (row) => formatDateTime(row.created_at),
            },
            {
              key: "last_used_at",
              header: "Last used",
              render: (row) => formatDateTime(row.last_used_at),
            },
            {
              key: "last_used_route",
              header: "Last route",
              render: (row) => lastRouteLabel(row),
            },
            {
              key: "last_used_endpoint",
              header: "Endpoint",
              render: (row) => String(row.last_used_endpoint || "-"),
            },
            {
              key: "actions",
              header: "",
              render: (row) =>
                row.id ? (
                  <div className="api-key-actions">
                    <Button variant="ghost" size="sm" onClick={() => void openAnalytics(row)}>
                      Analytics
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevoke(row.id!)}
                    >
                      Revoke
                    </Button>
                  </div>
                ) : null,
            },
          ]}
          rows={activeKeys}
          emptyMessage="No active external app keys. Generate one above."
          getRowKey={(row, i) => row.id || String(i)}
        />
      </Panel>

      {revokedKeys.length > 0 ? (
        <Panel eyebrow="History" title="Revoked keys">
          <DataTable<ExternalApiKey>
            columns={[
              { key: "site_name", header: "Site name", render: (row) => String(row.site_name || "-") },
              { key: "site_url", header: "Site URL", render: (row) => String(row.site_url || "-") },
              { key: "key_hint", header: "Key hint", render: (row) => <code>{String(row.key_hint || "-")}</code> },
              { key: "last_used_at", header: "Last used", render: (row) => formatDateTime(row.last_used_at) },
              {
                key: "created_at",
                header: "Created",
                render: (row) => formatDateTime(row.created_at),
              },
            ]}
            rows={revokedKeys}
            emptyMessage=""
            getRowKey={(row, i) => row.id || String(i)}
          />
        </Panel>
      ) : null}

      <KeyAnalyticsModal
        selectedKey={analyticsKey}
        analytics={analytics}
        loading={analyticsLoading}
        error={analyticsError}
        onClose={() => setAnalyticsKey(null)}
      />
    </div>
  );
}
