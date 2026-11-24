"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OperatorDriverReview from "@/components/operator-driver-review";
import OperatorVehicleReview from "@/components/operator-vehicle-review";
import OperatorServiceZones from "@/components/operator-service-zones";
import OperatorAuditHistory from "@/components/operator-audit-history";

type Health = {
  status?: string;
  service?: string;
  database?: string;
};

const capabilities = [
  { title: "Fleet visibility", description: "Organize vehicles, drivers and operating areas under controlled fleet access.", dependency: "Fleet and vehicle administration APIs" },
  { title: "Driver verification", description: "Review onboarding records and maintain a clear approval history.", dependency: "Secure document review and operator authorization" },
  { title: "Dispatch oversight", description: "Monitor ride assignments, exceptions and operational hand-offs.", dependency: "Driver availability, matching and trip state services" },
  { title: "Payment reconciliation", description: "Review verified Pi payment events against completed bookings.", dependency: "Pi payment approval, completion and ledger services" },
  { title: "Service configuration", description: "Manage service categories, operating zones and local fare policies.", dependency: "Market configuration and audited fare management" },
  { title: "Audit and support", description: "Keep accountable records for support cases and administrative actions.", dependency: "Operator roles, audit events and support case APIs" },
];

export default function BusinessPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const refreshHealth = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Health service did not return a successful response.");
      setHealth(data);
      setLastChecked(new Date());
    } catch (cause) {
      setHealth(null);
      setError(cause instanceof Error ? cause.message : "Unable to check the service.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void refreshHealth(); }, [refreshHealth]);

  const serviceReady = health?.status === "ok" && health.database === "connected";

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="brand" href="/"><span className="brand-mark">O<span>W</span></span><span className="brand-name">on the way</span></Link>
        <nav className="portal-nav" aria-label="Main navigation"><Link href="/">Ride</Link><Link href="/driver">Drive</Link><Link className="active" href="/business">Business</Link></nav>
        <span className="portal-state"><i /> OPERATOR CONSOLE PREVIEW</span>
      </header>

      <section className="portal-hero business-hero">
        <div><span className="eyebrow"><span className="eyebrow-line" /> FOR FLEETS & OPERATORS</span><h1>Operate with<br /><em>clarity.</em></h1><p className="portal-lead">A single operational foundation for mobility partners, fleet teams and local service operators.</p><div className="portal-tags"><span>Role-based access</span><span>Auditable workflows</span><span>City-configurable</span></div></div>
        <aside className="portal-callout"><span className="callout-symbol">⌘</span><strong>Operator tools are not connected yet.</strong><p>This is a capability preview. No live fleet, driver, booking, financial or operational metrics are represented here.</p></aside>
      </section>

      <section className="operator-health" aria-labelledby="operator-health-heading">
        <div className="operator-health-copy">
          <span className="step-label">LIVE PLATFORM CHECK</span>
          <h2 id="operator-health-heading">Service foundation</h2>
          <p>This check reports only API and database connectivity. It does not indicate that dispatch, payments or marketplace operations are production-ready.</p>
        </div>
        <div className="operator-health-status" aria-live="polite">
          <span className={checking ? "health-indicator checking" : serviceReady ? "health-indicator healthy" : "health-indicator unavailable"} />
          <div><strong>{checking ? "Checking services…" : serviceReady ? "API and database connected" : "Service check unavailable"}</strong><small>{lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : error || "Waiting for health response"}</small></div>
          <button type="button" onClick={() => void refreshHealth()} disabled={checking}>{checking ? "Checking" : "Refresh"}</button>
        </div>
        {error && <p className="operator-health-error" role="alert">{error}</p>}
      </section>

      <OperatorDriverReview />
      <OperatorVehicleReview />
      <OperatorServiceZones />
      <OperatorAuditHistory />

      <section className="business-section"><div className="panel-heading"><span className="step-label">PLATFORM CAPABILITIES</span><h2>One operating layer for mobility</h2><p>Each capability is linked to the real service required before operators can use it.</p></div><div className="capability-grid">{capabilities.map((item, index) => <article className="capability-card" key={item.title}><span className="capability-index">0{index + 1}</span><h3>{item.title}</h3><p>{item.description}</p><span className="capability-status">NOT CONNECTED</span><small className="capability-dependency">Requires: {item.dependency}</small></article>)}</div></section>

      <section className="access-band"><div><span className="step-label">ACCESS MODEL</span><h2>Each team sees only what it is authorized to manage.</h2><p>Fleet, city, country and global administration must be separated by role and resource-level permissions.</p></div><Link className="request-button access-link" href="/driver">Open driver onboarding <span>→</span></Link></section>
      <footer className="portal-footer"><span>Independent project · Not affiliated with or endorsed by Pi Network.</span><Link href="/">Back to passenger booking →</Link></footer>
    </main>
  );
}
