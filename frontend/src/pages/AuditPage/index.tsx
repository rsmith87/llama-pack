import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { listAuditEvents } from "../../api/audit";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { DataTable, ErrorBanner, FormField, Panel } from "../../components/ui";
import { useAuthSession } from "../../features/auth/authSession";
import { useDateTime } from "../../features/dateTime/dateTimeContext";
import { field } from "../../features/shared/helpers";
import type { AuditEvent } from "../../types/operations";

function asEvents(payload: unknown): AuditEvent[] {
  if (Array.isArray(payload)) return payload as AuditEvent[];
  return (payload as { events?: AuditEvent[] } | null)?.events || [];
}

function dateToIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function AuditPage() {
  const { authUser } = useAuthSession();
  const { formatConfiguredDateTime } = useDateTime();
  const [visibleEvents, setVisibleEvents] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [eventType, setEventType] = useState("");
  const [target, setTarget] = useState("");
  const [dryRun, setDryRun] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [limit, setLimit] = useState(200);

  function buildParams() {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (eventType.trim()) params.set("event_type", eventType.trim());
    if (target.trim()) params.set("target", target.trim());
    if (dryRun) params.set("dry_run", dryRun);
    if (createdFrom) params.set("created_from", dateToIso(createdFrom));
    if (createdTo) params.set("created_to", dateToIso(createdTo));
    return params;
  }

  const { data: events, loading, error, refresh } = useAsyncResource<AuditEvent[]>(
    () => listAuditEvents(`?${buildParams().toString()}`).then(asEvents),
    [],
    [limit, eventType, target, dryRun, createdFrom, createdTo],
  );

  useEffect(() => {
    setVisibleEvents(events);
  }, [events]);

  const detail = useMemo(() => JSON.stringify(selected || {}, null, 2), [selected]);

  function applyMyActions() {
    if (!authUser) return;
    setVisibleEvents(events.filter((event) => String(event.actor || "") === authUser));
  }

  return (
    <div className="audit-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Security</span><h2>Audit</h2></div>
        <span className="muted">Operational action log</span>
      </div>
      <ErrorBanner message={error} />
      <Panel>
        <div className="filter-bar">
          <FormField label="Event type"><input value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="event type" /></FormField>
          <FormField label="Target"><input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="target" /></FormField>
          <FormField label="Dry run">
            <select value={dryRun} onChange={(event) => setDryRun(event.target.value)}>
              <option value="">all</option>
              <option value="true">dry-run only</option>
              <option value="false">executed only</option>
            </select>
          </FormField>
          <FormField label="From"><input type="datetime-local" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} /></FormField>
          <FormField label="To"><input type="datetime-local" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} /></FormField>
          <FormField label="Limit"><input type="number" min={1} max={1000} value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></FormField>
          <button type="button" onClick={() => void refresh()}>{loading ? "Refreshing" : "Refresh Audit"}</button>
          <button type="button" onClick={applyMyActions}>My Actions</button>
        </div>
      </Panel>
      <div className="controller-grid-react">
        <Panel title="Events">
          <DataTable
            rows={visibleEvents}
            emptyMessage="No audit events."
            getRowKey={(event, index) => field(event, "id", String(index))}
            columns={[
              { key: "time", header: "Time", render: (event) => formatConfiguredDateTime(field(event, "created_at")).label },
              { key: "type", header: "Type", render: (event) => field(event, "event_type") },
              { key: "dry", header: "Dry", render: (event) => String(Boolean(event.dry_run)) },
              { key: "target", header: "Target", render: (event) => field(event, "target") },
              { key: "route", header: "Route", render: (event) => field(event, "route") },
              { key: "action", header: "Action", render: (event) => {
                const id = field(event, "id");
                return <button type="button" aria-label={`View ${id}`} onClick={() => setSelected(event)}>View</button>;
              } },
            ]}
          />
        </Panel>
        <Panel title="Event Detail">
          <pre className="detail-json tall-json">{selected ? detail : "Select an event to inspect payload details."}</pre>
        </Panel>
      </div>
    </div>
  );
}
