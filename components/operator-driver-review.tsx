"use client";

import { useCallback, useEffect, useState } from "react";

type DriverApplication = {
  account_id: string;
  display_name: string | null;
  service_city: string | null;
  preferred_vehicle_type: string | null;
  verification_status: string;
  availability_status: string;
  application_submitted_at: string | null;
  consent_version: string | null;
};

type QueueResponse = { applications?: DriverApplication[]; error?: string };

export default function OperatorDriverReview() {
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "signin" | "forbidden" | "error">("checking");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operators/drivers?status=" + encodeURIComponent(filter), { cache: "no-store" });
      const data = await response.json() as QueueResponse;
      if (response.status === 401) { setAccessState("signin"); setApplications([]); return; }
      if (response.status === 403) { setAccessState("forbidden"); setApplications([]); return; }
      if (!response.ok) throw new Error(data.error || "Could not load the review queue.");
      setApplications(data.applications ?? []);
      setAccessState("allowed");
    } catch (cause) {
      setAccessState("error");
      setError(cause instanceof Error ? cause.message : "Review queue unavailable.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const decide = async (application: DriverApplication, decision: "under_review" | "verified" | "rejected" | "suspended") => {
    const reason = (reasons[application.account_id] ?? "").trim();
    const verificationReference = (references[application.account_id] ?? "").trim();
    if (decision === "verified" && verificationReference.length < 6) {
      setError("Enter the external verification case reference before approving this driver.");
      return;
    }
    if ((decision === "rejected" || decision === "suspended") && reason.length < 10) {
      setError("Enter a reason of at least 10 characters before this decision.");
      return;
    }
    setBusyId(application.account_id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/operators/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverAccountId: application.account_id,
          decision,
          reason,
          verificationReference,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The review decision was not saved.");
      setNotice("Review decision saved. Driver availability remains offline.");
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review decision could not be saved.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="operator-review-section" aria-labelledby="driver-review-heading">
      <div className="panel-heading">
        <span className="step-label">CONTROLLED OPERATIONS</span>
        <h2 id="driver-review-heading">Driver application review</h2>
        <p>Only authorized operators can access this queue. Approval records a review decision; it does not activate a driver or replace the required identity, licence and vehicle checks.</p>
      </div>
      <div className="operator-review-toolbar">
        <label htmlFor="driver-review-filter">Application status</label>
        <select id="driver-review-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
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
      {accessState === "signin" && <div className="operator-access-message"><strong>Pi sign-in required</strong><p>Sign in through the passenger app first. This account must also be explicitly granted an operator role by the platform owner.</p><a href="/">Open sign-in</a></div>}
      {accessState === "forbidden" && <div className="operator-access-message"><strong>Operator access not granted</strong><p>Your signed-in account does not have the operator or platform administrator role. Ask the platform owner to provision the correct role.</p></div>}
      {accessState === "error" && <p className="operator-health-error" role="alert">{error}</p>}
      {notice && <p className="operator-review-notice" role="status">{notice}</p>}
      {error && accessState !== "error" && <p className="operator-health-error" role="alert">{error}</p>}
      {accessState === "allowed" && !loading && applications.length === 0 && <p className="operator-empty-state">No applications match this filter.</p>}
      {accessState === "allowed" && applications.map((application) => (
        <article className="operator-driver-card" key={application.account_id}>
          <div className="operator-driver-summary">
            <div><strong>{application.display_name || "Pi Pioneer"}</strong><span>{application.service_city || "City not provided"} · {application.preferred_vehicle_type || "Vehicle not selected"}</span></div>
            <span className={"operator-driver-status status-" + application.verification_status}>{application.verification_status.replaceAll("_", " ")}</span>
          </div>
          <p className="operator-driver-meta">Submitted: {application.application_submitted_at ? new Date(application.application_submitted_at).toLocaleString() : "Not recorded"} · Availability: {application.availability_status} · Consent: {application.consent_version || "Not recorded"}</p>
          {["pending", "under_review"].includes(application.verification_status) && (
            <div className="operator-driver-actions">
              {application.verification_status === "pending" && <button type="button" disabled={busyId === application.account_id} onClick={() => void decide(application, "under_review")}>{busyId === application.account_id ? "Saving…" : "Start review"}</button>}
              <label>External verification case reference
                <input value={references[application.account_id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [application.account_id]: event.target.value }))} placeholder="Required for approval" maxLength={120} />
              </label>
              <button type="button" className="operator-approve-button" disabled={busyId === application.account_id} onClick={() => void decide(application, "verified")}>Approve verification</button>
              <label>Decision reason
                <textarea value={reasons[application.account_id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [application.account_id]: event.target.value }))} placeholder="Required for rejection or suspension" maxLength={500} rows={2} />
              </label>
              <div className="operator-decision-row">
                <button type="button" disabled={busyId === application.account_id} onClick={() => void decide(application, "rejected")}>Reject</button>
                <button type="button" disabled={busyId === application.account_id} onClick={() => void decide(application, "suspended")}>Suspend</button>
              </div>
            </div>
          )}
        </article>
      ))}
      <p className="operator-review-footnote">No identity documents are stored or displayed in this review queue. The verification reference must point to a separately controlled evidence process. Verified drivers remain offline until a separate availability workflow is implemented.</p>
    </section>
  );
}
