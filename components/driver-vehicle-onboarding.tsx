"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type VehicleRecord = {
  id: string;
  vehicle_type: "car" | "bike" | "rickshaw";
  make: string;
  model: string;
  model_year: number;
  registration_country: string;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
};

type PendingSubmission = { key: string; payload: string };

export default function DriverVehicleOnboarding({ canSubmit }: { canSubmit: boolean }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleRecord["vehicle_type"]>("car");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState(String(new Date().getFullYear()));
  const [registrationCountry, setRegistrationCountry] = useState("PK");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingSubmission = useRef<PendingSubmission | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/drivers/vehicles", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle records could not be loaded.");
      setVehicles(data.vehicles ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vehicle records are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadVehicles(); }, [loadVehicles]);

  async function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = {
      vehicleType,
      make: make.trim(),
      model: model.trim(),
      modelYear: Number(modelYear),
      registrationCountry: registrationCountry.trim().toUpperCase(),
      consent,
    };
    const serialized = JSON.stringify(payload);
    if (!pendingSubmission.current || pendingSubmission.current.payload !== serialized) {
      pendingSubmission.current = { key: crypto.randomUUID(), payload: serialized };
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/drivers/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pendingSubmission.current.key },
        body: serialized,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle details could not be submitted.");
      setVehicles((current) => [data.vehicle, ...current.filter((item) => item.id !== data.vehicle.id)]);
      pendingSubmission.current = null;
      setMake("");
      setModel("");
      setModelYear(String(new Date().getFullYear()));
      setConsent(false);
      setNotice(data.replayed ? "The previous vehicle submission was recovered." : data.message || "Vehicle details submitted for review.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vehicle submission could not be completed. Retry without changing the details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="driver-vehicle-panel" aria-labelledby="driver-vehicle-heading">
      <div className="panel-heading">
        <span className="step-label">03 / VEHICLE ONBOARDING</span>
        <h2 id="driver-vehicle-heading">Register a vehicle</h2>
        <p>Submit vehicle details for an authorized operator to review. Do not enter registration plate numbers or upload identity, ownership or insurance documents here; those require a separate secure evidence workflow.</p>
      </div>
      {loading ? <p role="status">Loading your vehicle records…</p> : vehicles.length === 0 ? <p className="operator-empty-state">No vehicles have been submitted yet.</p> : (
        <div className="driver-vehicle-list">
          {vehicles.map((vehicle) => (
            <article className="driver-vehicle-card" key={vehicle.id}>
              <div><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.vehicle_type} · {vehicle.model_year} · {vehicle.registration_country.trim()}</span></div>
              <span className={"operator-driver-status status-" + vehicle.verification_status}>{vehicle.verification_status.replaceAll("_", " ")}</span>
            </article>
          ))}
        </div>
      )}
      {!canSubmit && <p className="requirement-note">Vehicle submissions are unavailable while the driver application is rejected or suspended. Resolve the application status with an authorized operator first.</p>}
      {canSubmit && (
        <form className="driver-form driver-vehicle-form" onSubmit={submitVehicle}>
          <div className="driver-vehicle-fields">
            <label>Vehicle category<select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleRecord["vehicle_type"])}><option value="car">Car</option><option value="bike">Motorcycle / bike</option><option value="rickshaw">Rickshaw</option></select></label>
            <label>Make<input required minLength={2} maxLength={60} value={make} onChange={(event) => setMake(event.target.value)} placeholder="e.g. Toyota" /></label>
            <label>Model<input required minLength={1} maxLength={60} value={model} onChange={(event) => setModel(event.target.value)} placeholder="e.g. Corolla" /></label>
            <label>Model year<input required type="number" min="1970" max={new Date().getFullYear() + 1} value={modelYear} onChange={(event) => setModelYear(event.target.value)} /></label>
            <label>Registration country<input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={registrationCountry} onChange={(event) => setRegistrationCountry(event.target.value.toUpperCase())} /></label>
          </div>
          <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I confirm these vehicle details are accurate and consent to their use for driver eligibility review. I understand this submission does not verify ownership, insurance or roadworthiness.</span></label>
          <button className="request-button" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit vehicle for review"} <span>→</span></button>
        </form>
      )}
      {error && <p className="operator-health-error" role="alert">{error}</p>}
      {notice && <p className="operator-review-notice" role="status">{notice}</p>}
      <p className="operator-review-footnote">Vehicle status remains pending until an operator checks the required evidence in a separate controlled process. A case reference alone is not proof of verification.</p>
    </section>
  );
}
