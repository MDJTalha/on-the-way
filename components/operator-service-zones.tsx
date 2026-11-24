"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ServiceZone = {
  id: string;
  country_code: string;
  city_name: string;
  zone_name: string;
  currency_code: string;
  active: boolean;
  has_boundary: boolean;
  created_at: string;
  updated_at: string;
};

type AccessState = "checking" | "allowed" | "signin" | "forbidden" | "error";

export default function OperatorServiceZones() {
  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [filter, setFilter] = useState("all");
  const [access, setAccess] = useState<AccessState>("checking");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyZone, setBusyZone] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [boundary, setBoundary] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadZones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operators/service-zones?status=" + encodeURIComponent(filter), { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { setAccess("signin"); setZones([]); return; }
      if (response.status === 403) { setAccess("forbidden"); setZones([]); return; }
      if (!response.ok) throw new Error(data.error || "Service zones could not be loaded.");
      setZones(data.zones ?? []);
      setCanManage(data.canManage === true);
      setAccess("allowed");
    } catch (cause) {
      setAccess("error");
      setError(cause instanceof Error ? cause.message : "Service zones are unavailable.");
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void loadZones(); }, [loadZones]);

  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let geometry: unknown;
    try { geometry = JSON.parse(boundary); }
    catch { setError("Boundary must be valid GeoJSON JSON."); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/operators/service-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, cityName, zoneName, currencyCode, boundary: geometry }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Service zone could not be created.");
      setNotice(data.message || "Service zone created inactive.");
      setCountryCode("");
      setCityName("");
      setZoneName("");
      setCurrencyCode("");
      setBoundary("");
      await loadZones();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Service zone could not be created.");
    } finally { setBusy(false); }
  }

  async function changeStatus(zone: ServiceZone, active: boolean) {
    const activationReference = (references[zone.id] ?? "").trim();
    if (active && activationReference.length < 6) {
      setError("Enter the external market-readiness reference before activation.");
      return;
    }
    setBusyZone(zone.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/operators/service-zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId: zone.id, active, activationReference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Service-zone status was not changed.");
      setNotice(data.message || "Service-zone status updated.");
      await loadZones();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Service-zone status could not be changed.");
    } finally { setBusyZone(""); }
  }

  return (
    <section className="operator-review-section" aria-labelledby="service-zones-heading">
      <div className="panel-heading">
        <span className="step-label">MARKET CONFIGURATION</span>
        <h2 id="service-zones-heading">Service zones</h2>
        <p>Define country, city, currency and a mapped operating boundary. New zones remain inactive until an authorized operator completes the market-readiness check.</p>
      </div>
      {access === "checking" && <p role="status">Checking operator access…</p>}
      {access === "signin" && <div className="operator-access-message"><strong>Pi sign-in required</strong><p>Sign in with an account explicitly granted an operator role.</p><a href="/">Open sign-in</a></div>}
      {access === "forbidden" && <div className="operator-access-message"><strong>Operator access not granted</strong><p>Your account does not have operator or platform administrator permissions.</p></div>}
      {access === "allowed" && <>
        {!canManage && <p className="requirement-note">You have read-only access. Global service-zone creation and activation require a platform administrator.</p>}
        {canManage && <form className="driver-form" onSubmit={createZone}>
          <div className="driver-vehicle-fields">
            <label>Country code<input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase())} placeholder="ISO code, e.g. PK" /></label>
            <label>City<input required minLength={2} maxLength={100} value={cityName} onChange={e => setCityName(e.target.value)} placeholder="Operating city" /></label>
            <label>Zone name<input required minLength={2} maxLength={100} value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Named service area" /></label>
            <label>Currency code<input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} placeholder="ISO 4217, e.g. PKR" /></label>
          </div>
          <label>GeoJSON MultiPolygon boundary<textarea required rows={5} value={boundary} onChange={e => setBoundary(e.target.value)} placeholder='{"type":"MultiPolygon","coordinates":[...]}' /></label>
          <p className="operator-review-footnote">Use a valid GeoJSON MultiPolygon in WGS84 coordinates (longitude, latitude). Invalid or empty geometry is rejected by PostGIS. Do not paste private customer or driver locations.</p>
          <button className="request-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create inactive zone"} <span>→</span></button>
        </form>}
        <div className="operator-review-toolbar">
          <label htmlFor="service-zone-filter">Zone status</label>
          <select id="service-zone-filter" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All zones</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          <button type="button" onClick={() => void loadZones()} disabled={loading}>{loading ? "Loading…" : "Refresh zones"}</button>
        </div>
        {loading ? <p role="status">Loading service zones…</p> : zones.length === 0 ? <p className="operator-empty-state">No service zones match this filter.</p> : zones.map(zone => (
          <article className="operator-driver-card" key={zone.id}>
            <div className="operator-driver-summary">
              <div><strong>{zone.zone_name}</strong><span>{zone.city_name}, {zone.country_code.trim()} · {zone.currency_code.trim()}</span></div>
              <span className={"operator-driver-status " + (zone.active ? "status-verified" : "status-pending")}>{zone.active ? "active" : "inactive"}</span>
            </div>
            <p className="operator-driver-meta">Mapped boundary: {zone.has_boundary ? "present" : "missing"} · Updated {new Date(zone.updated_at).toLocaleString()}</p>
            {canManage && (zone.active ? <button type="button" disabled={busyZone === zone.id} onClick={() => void changeStatus(zone, false)}>{busyZone === zone.id ? "Saving…" : "Deactivate zone"}</button> : <div className="operator-driver-actions">
              <label>External market-readiness reference<input value={references[zone.id] ?? ""} onChange={e => setReferences(current => ({ ...current, [zone.id]: e.target.value }))} minLength={6} maxLength={120} placeholder="Required for activation" /></label>
              <button type="button" className="operator-approve-button" disabled={busyZone === zone.id || !zone.has_boundary} onClick={() => void changeStatus(zone, true)}>{busyZone === zone.id ? "Saving…" : "Activate zone"}</button>
            </div>)}
          </article>
        ))}
      </>}
      {error && <p className="operator-health-error" role="alert">{error}</p>}
      {notice && <p className="operator-review-notice" role="status">{notice}</p>}
      <p className="operator-review-footnote">Zone activation only changes market eligibility. It does not enable dispatch, fare quotes, ride acceptance or Pi payments.</p>
    </section>
  );
}
