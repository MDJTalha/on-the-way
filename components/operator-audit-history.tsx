"use client";
import { useCallback, useEffect, useState } from "react";
type AuditEvent = {
  id: string; entity_type: "driver" | "vehicle" | "service_zone" | "booking"; entity_id: string;
  actor_display_name: string | null; event_type: string; from_status: string | null; to_status: string | null;
  created_at: string; details: { evidence_checks?: Record<string, boolean> };
};
type AuditResponse = { events?: AuditEvent[]; pagination?: { hasMore: boolean }; error?: string };
const labels: Record<string, string> = { driver: "Driver", vehicle: "Vehicle", service_zone: "Service zone", booking: "Booking" };
export default function OperatorAuditHistory() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [entity, setEntity] = useState("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<"checking" | "allowed" | "signin" | "forbidden" | "error">("checking");
  const [error, setError] = useState("");
  const load = useCallback(async (nextOffset: number, replace: boolean) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/operators/audit?entity=" + encodeURIComponent(entity) + "&limit=30&offset=" + nextOffset, { cache: "no-store" });
      const data = await response.json() as AuditResponse;
      if (response.status === 401) { setAccess("signin"); setEvents([]); return; }
      if (response.status === 403) { setAccess("forbidden"); setEvents([]); return; }
      if (!response.ok) throw new Error(data.error || "Audit history could not be loaded.");
      setEvents(current => replace ? data.events ?? [] : [...current, ...(data.events ?? [])]);
      setHasMore(data.pagination?.hasMore ?? false); setOffset(nextOffset); setAccess("allowed");
    } catch (cause) { setAccess("error"); setError(cause instanceof Error ? cause.message : "Audit history is unavailable."); }
    finally { setLoading(false); }
  }, [entity]);
  useEffect(() => { void load(0, true); }, [load]);
  return <section className="operator-review-section" aria-labelledby="audit-history-heading">
    <div className="panel-heading"><span className="step-label">ACCOUNTABILITY & TRACEABILITY</span><h2 id="audit-history-heading">Operational audit history</h2>
      <p>Append-only lifecycle events across driver applications, vehicles, service zones and bookings. Sensitive review notes, verification references and personal documents are not exposed.</p></div>
    <div className="operator-review-toolbar"><label htmlFor="audit-entity-filter">Event type</label>
      <select id="audit-entity-filter" value={entity} onChange={event => { setEntity(event.target.value); setOffset(0); }}>
        <option value="all">All activity</option><option value="driver">Driver applications</option><option value="vehicle">Vehicles</option><option value="service_zone">Service zones</option><option value="booking">Bookings</option>
      </select><button type="button" onClick={() => void load(0, true)} disabled={loading}>{loading ? "Loading…" : "Refresh history"}</button></div>
    {access === "checking" && <p role="status">Checking operator access…</p>}
    {access === "signin" && <div className="operator-access-message"><strong>Pi sign-in required</strong><p>Sign in with an account explicitly granted an operator role.</p><a href="/">Open sign-in</a></div>}
    {access === "forbidden" && <div className="operator-access-message"><strong>Operator access not granted</strong><p>This account cannot view operational audit records.</p></div>}
    {access === "error" && <p className="operator-health-error" role="alert">{error}</p>}
    {access === "allowed" && events.length === 0 && !loading && <p className="operator-empty-state">No audit events match this filter.</p>}
    {events.map(event => <article className="operator-driver-card" key={event.id}>
      <div className="operator-driver-summary"><div><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{labels[event.entity_type]} · {event.entity_id}</span></div><span className="operator-driver-status">{event.to_status ?? "recorded"}</span></div>
      <p className="operator-driver-meta">{new Date(event.created_at).toLocaleString()} · By {event.actor_display_name || "System"} · {event.from_status ? event.from_status + " → " : ""}{event.to_status ?? "event recorded"}</p>
      {event.details?.evidence_checks && <p className="operator-driver-meta">Evidence attestations: {Object.values(event.details.evidence_checks).filter(Boolean).length} checks recorded. Document contents are not stored here.</p>}
    </article>)}
    {access === "allowed" && hasMore && <div className="operator-review-toolbar"><button type="button" disabled={loading} onClick={() => void load(offset + 30, false)}>{loading ? "Loading…" : "Load older events"}</button></div>}
    {access === "allowed" && !hasMore && events.length > 0 && <p className="operator-review-footnote">End of currently available history. Records are read-only in this interface.</p>}
  </section>;
}