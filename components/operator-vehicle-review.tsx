"use client";

import { useCallback, useEffect, useState } from "react";

type VehicleApplication = {
  id: string;
  driver_account_id: string;
  display_name: string | null;
  vehicle_type: string;
  make: string;
  model: string;
  model_year: number;
  registration_country: string;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  service_city: string | null;
  service_country_code: string | null;
};

export default function OperatorVehicleReview() {
  const [vehicles, setVehicles] = useState<VehicleApplication[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "signin" | "forbidden" | "error">("checking");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [evidenceChecks, setEvidenceChecks] = useState<Record<string, Record<string, boolean>>>({});

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operators/vehicles?status=" + encodeURIComponent(filter), { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { setAccessState("signin"); setVehicles([]); return; }
      if (response.status === 403) { setAccessState("forbidden"); setVehicles([]); return; }
      if (!response.ok) throw new Error(data.error || "Could not load the vehicle review queue.");
      setVehicles(data.vehicles ?? []);
      setAccessState("allowed");
    } catch (cause) {
      setAccessState("error");
      setError(cause instanceof Error ? cause.message : "Vehicle review queue unavailable.");
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  async function decide(vehicle: VehicleApplication, decision: "under_review" | "verified" | "rejected" | "suspended") {
    const reason = (reasons[vehicle.id] ?? "").trim();
    const verificationReference = (references[vehicle.id] ?? "").trim();
    const requiredChecks = ["registrationOwnership", "insurance", "inspection", "physicalIdentity"];
    if (decision === "verified" && verificationReference.length < 6) {
      setError("Enter the external vehicle verification case reference before approval.");
      return;
    }
    if (decision === "verified" && !requiredChecks.every((key) => evidenceChecks[vehicle.id]?.[key] === true)) {
      setError("Complete all four vehicle evidence checks before approval.");
      return;
    }
    if ((decision === "rejected" || decision === "suspended") && reason.length < 10) {
      setError("Enter a reason of at least 10 characters before this decision.");
      return;
    }
    setBusyId(vehicle.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/operators/vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vehicle.id, decision, reason, verificationReference, evidenceChecks: evidenceChecks[vehicle.id] ?? {} }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle review decision was not saved.");
      setNotice("Vehicle review decision saved. Driver availability was not activated.");
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vehicle review decision could not be saved.");
    } finally { setBusyId(""); }
  }

  return (
    <section className="operator-review-section" aria-labelledby="vehicle-review-heading">
      <div className="panel-heading">
        <span className="step-label">CONTROLLED FLEET OPERATIONS</span>
        <h2 id="vehicle-review-heading">Vehicle verification review</h2>
        <p>Review vehicle records against separately controlled registration, ownership, insurance and inspection evidence. This queue stores no document images or registration plate numbers.</p>
      </div>
      <div className="operator-review-toolbar">
        <label htmlFor="vehicle-review-filter">Vehicle status</label>
        <select id="vehicle-review-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="pending">Pending</option>
          <option value="under_review">Under review</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
          <option value="all">All statuses</option>
        </select>
        <button type="button" onClick={() => void loadQueue()} disabled={loading}>{loading ? "Loading…" : "Refresh queue"}</button>
      </div>
      {accessState === "checking" && <p role="status">Checking operator access…</p>}
      {accessState === "signin" && <div className="operator-access-message"><strong>Pi sign-in required</strong><p>Sign in first with an account explicitly granted an operator role.</p><a href="/">Open sign-in</a></div>}
      {accessState === "forbidden" && <div className="operator-access-message"><strong>Operator access not granted</strong><p>Your account does not have operator or platform administrator permissions.</p></div>}
      {accessState === "error" && <p className="operator-health-error" role="alert">{error}</p>}
      {notice && <p className="operator-review-notice" role="status">{notice}</p>}
      {error && accessState !== "error" && <p className="operator-health-error" role="alert">{error}</p>}
      {accessState === "allowed" && !loading && vehicles.length === 0 && <p className="operator-empty-state">No vehicles match this filter.</p>}
      {accessState === "allowed" && vehicles.map((vehicle) => (
        <article className="operator-driver-card" key={vehicle.id}>
          <div className="operator-driver-summary">
            <div><strong>{vehicle.make} {vehicle.model} ({vehicle.model_year})</strong><span>{vehicle.display_name || "Pi Pioneer"} · {vehicle.service_city || "City not provided"}, {vehicle.service_country_code?.trim() || "Country not provided"} · {vehicle.vehicle_type}</span></div>
            <span className={"operator-driver-status status-" + vehicle.verification_status}>{vehicle.verification_status.replaceAll("_", " ")}</span>
          </div>
          <p className="operator-driver-meta">Registration country: {vehicle.registration_country.trim()} · Submitted: {new Date(vehicle.created_at).toLocaleString()}</p>
          {["pending", "under_review"].includes(vehicle.verification_status) && (
            <div className="operator-driver-actions">
              {vehicle.verification_status === "pending" && <button type="button" disabled={busyId === vehicle.id} onClick={() => void decide(vehicle, "under_review")}>{busyId === vehicle.id ? "Saving…" : "Start review"}</button>}
              <label>External vehicle verification case reference
                <input value={references[vehicle.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [vehicle.id]: event.target.value }))} placeholder="Required for approval" maxLength={120} />
              </label>
              <fieldset className="operator-evidence-checklist"><legend>Evidence review attestations</legend>
                {([["registrationOwnership", "Registration and registered owner match"], ["insurance", "Required insurance is valid"], ["inspection", "Required roadworthiness inspection passed"], ["physicalIdentity", "Physical vehicle identity matches the record"]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={evidenceChecks[vehicle.id]?.[key] === true} onChange={(event) => setEvidenceChecks((current) => ({ ...current, [vehicle.id]: { ...current[vehicle.id], [key]: event.target.checked } }))} />{label}</label>)}
              </fieldset>
              <button type="button" className="operator-approve-button" disabled={busyId === vehicle.id || !["registrationOwnership", "insurance", "inspection", "physicalIdentity"].every((key) => evidenceChecks[vehicle.id]?.[key] === true)} onClick={() => void decide(vehicle, "verified")}>Approve vehicle</button>
              <label>Decision reason
                <textarea value={reasons[vehicle.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [vehicle.id]: event.target.value }))} placeholder="Required for rejection or suspension" maxLength={500} rows={2} />
              </label>
              <div className="operator-decision-row">
                <button type="button" disabled={busyId === vehicle.id} onClick={() => void decide(vehicle, "rejected")}>Reject</button>
                <button type="button" disabled={busyId === vehicle.id} onClick={() => void decide(vehicle, "suspended")}>Suspend</button>
              </div>
            </div>
          )}
          {vehicle.verification_status === "verified" && vehicle.verified_at && <p className="operator-driver-meta">Verified: {new Date(vehicle.verified_at).toLocaleString()}</p>}
        </article>
      ))}
      <p className="operator-review-footnote">A case reference is an audit pointer, not proof by itself. Operators must independently inspect the underlying evidence before approval. Approving a vehicle does not activate driver availability.</p>
    </section>
  );
}
