"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import DriverVehicleOnboarding from "@/components/driver-vehicle-onboarding";

type VehicleType = "car" | "bike" | "rickshaw";
type DriverApplication = {
  verification_status: string;
  availability_status: string;
  service_city: string;
  service_country_code: string;
  preferred_vehicle_type: VehicleType;
  application_submitted_at: string;
};
type DriverAvailability = { availability_status: string; eligible: boolean; blockers: string[] };

export default function DriverPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [piReady, setPiReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [serviceCity, setServiceCity] = useState("");
  const [serviceCountryCode, setServiceCountryCode] = useState("PK");
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [consent, setConsent] = useState(false);
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [availability, setAvailability] = useState<DriverAvailability | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadApplication = useCallback(async () => {
    const response = await fetch("/api/drivers/me", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (data.application) {
      setApplication(data.application);
      setServiceCity(data.application.service_city || "");
      setServiceCountryCode(data.application.service_country_code?.trim() || "PK");
      setVehicleType(data.application.preferred_vehicle_type || "car");
      if (data.application.verification_status === "verified") {
        const availabilityResponse = await fetch("/api/drivers/availability", { cache: "no-store" });
        if (availabilityResponse.ok) {
          const availabilityData = await availabilityResponse.json();
          setAvailability(availabilityData.availability);
        } else {
          setAvailability({ availability_status: data.application.availability_status || "offline", eligible: false, blockers: ["Driver availability access is not enabled for this account yet."] });
        }
      } else {
        setAvailability(null);
      }
    } else {
      setApplication(null);
      setAvailability(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!active || !data.authenticated) return;
        setAuthenticated(true);
        setUsername(data.user?.username || "");
        await loadApplication();
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [loadApplication]);

  async function signInWithPi() {
    if (!window.Pi) { setNotice("Pi SDK is unavailable. Open this application in Pi Browser."); return; }
    setAuthBusy(true);
    setNotice("");
    try {
      const auth = await window.Pi.authenticate(["username"], () => undefined);
      const response = await fetch("/api/auth/pi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: auth.accessToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pi identity verification failed.");
      setAuthenticated(true);
      setUsername(data.user.username);
      await loadApplication();
      setNotice("Pi identity verified. You can now submit your driver application.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pi sign-in could not be completed.");
    } finally { setAuthBusy(false); }
  }

  async function signOut() {
    setAuthBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("The server did not confirm sign-out.");
      setAuthenticated(false);
      setUsername("");
      setApplication(null);
      setAvailability(null);
      setConsent(false);
      setNotice("You have signed out.");
    } catch {
      setNotice("Sign-out could not be confirmed. Please retry.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function changeAvailability() {
    if (!availability) return;
    const nextStatus = availability.availability_status === "available" ? "offline" : "available";
    setAvailabilityBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/drivers/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilityStatus: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (Array.isArray(data.blockers)) setAvailability({ ...availability, eligible: false, blockers: data.blockers });
        throw new Error(data.error || "Availability could not be changed.");
      }
      setAvailability({ ...availability, availability_status: data.availabilityStatus });
      setNotice(nextStatus === "available" ? "You are now marked available for eligible requests." : "You are now offline.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Availability could not be changed.");
    } finally { setAvailabilityBusy(false); }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/drivers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCity, serviceCountryCode, vehicleType, consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The application could not be submitted.");
      setApplication(data.application);
      setConsent(false);
      setNotice(data.message || "Your application has been recorded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The driver application service could not be reached.");
    } finally { setBusy(false); }
  }

  return <main className="portal-shell">
    <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="afterInteractive" onReady={() => {
      try {
        if (!window.Pi) throw new Error("Pi SDK unavailable");
        window.Pi.init({ version: "2.0", sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX !== "false" });
        setPiReady(true);
      } catch { setNotice("Pi SDK could not be initialized. Open this app in Pi Browser."); }
    }} onError={() => setNotice("Pi SDK could not be loaded. Check your connection.")} />
    <header className="portal-header">
      <Link className="brand" href="/"><span className="brand-mark">O<span>W</span></span><span className="brand-name">on the way</span></Link>
      <nav className="portal-nav" aria-label="Main navigation"><Link href="/">Ride</Link><Link className="active" href="/driver">Drive</Link><Link href="/business">Business</Link></nav>
      <button className="portal-auth-button" onClick={authenticated ? signOut : signInWithPi} disabled={authBusy || (!authenticated && !piReady)}>
        {authenticated ? `Sign out · ${username}` : authBusy ? "Connecting…" : piReady ? "Sign in with Pi" : "Loading Pi…"}
      </button>
    </header>

    <section className="portal-hero">
      <div><span className="eyebrow"><span className="eyebrow-line" /> DRIVE WITH ON THE WAY</span><h1>Your time.<br/><em>Your route.</em></h1><p className="portal-lead">Apply to join the driver marketplace. Your account remains offline until identity, licence, vehicle and local operating checks are completed.</p><div className="portal-tags"><span>Flexible availability</span><span>Transparent offers</span><span>Pi-first direction</span></div></div>
      <aside className="portal-callout"><strong>Verification before activation.</strong><p>Submitting this application records your preferred city and vehicle category. It does not approve you, activate driver availability or create a trip.</p></aside>
    </section>

    <section className="driver-layout">
      <div className="portal-panel">
        <div className="panel-heading"><span className="step-label">01 / DRIVER APPLICATION</span><h2>Join the marketplace</h2><p>Sign in with Pi first. Do not upload identity documents or sensitive information here; secure document verification is a separate workflow.</p></div>
        {checkingSession ? <div className="requirement-note">Checking your verified Pi session…</div> : !authenticated ? <div className="draft-confirmation"><span>π</span><h3>Pi sign-in required</h3><p>Sign in with Pi to associate your driver application with your verified account.</p><button type="button" onClick={signInWithPi} disabled={!piReady || authBusy}>{authBusy ? "Connecting…" : "Continue with Pi"}</button></div> : application?.verification_status === "verified" ? <div className="draft-confirmation" role="status"><span>✓</span><h3>Driver verification approved</h3><p>Your profile is verified. You remain offline until a matching vehicle is verified and your operating city has an active service zone.</p><p><b>Current status:</b> {availability?.availability_status || application.availability_status}</p></div> : (
          <form className="driver-form" onSubmit={submitApplication}>
            <label>Preferred operating city<input required minLength={2} maxLength={80} value={serviceCity} onChange={e=>setServiceCity(e.target.value)} placeholder="e.g. Lahore"/></label>
            <label>Operating country code<input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={serviceCountryCode} onChange={e=>setServiceCountryCode(e.target.value.toUpperCase())} placeholder="PK" aria-describedby="country-code-help"/><small id="country-code-help">Use the ISO 3166-1 alpha-2 code, such as PK, AE, GB or US.</small></label>
            <fieldset><legend>Vehicle category</legend><div className="vehicle-choice">{(["car","bike","rickshaw"] as VehicleType[]).map(v=><button type="button" key={v} className={vehicleType===v?"vehicle-chip selected":"vehicle-chip"} aria-pressed={vehicleType===v} onClick={()=>setVehicleType(v)}>{v==="car"?"🚘":v==="bike"?"🏍️":"🛺"} {v[0].toUpperCase()+v.slice(1)}</button>)}</div></fieldset>
            <label className="consent-row"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I consent to On the Way recording this driver application and using these details to assess my eligibility for the selected operating market. I understand this does not constitute approval or activation.</span></label>
            <button className="request-button" type="submit" disabled={busy}>{busy?"Submitting…":application?"Update application":"Submit driver application"} <span>→</span></button>
            {application && <div className="requirement-note"><b>Application status:</b> {application.verification_status.replaceAll("_"," ")} · <b>Availability:</b> {application.availability_status}</div>}
          </form>
        )}
        {application?.verification_status === "verified" && availability && <div className="driver-availability-panel" aria-live="polite"><div><b>Driver availability</b><span className={availability.availability_status === "available" ? "driver-live-state online" : "driver-live-state"}>{availability.availability_status}</span></div>{!availability.eligible && availability.blockers.length > 0 && <ul>{availability.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}<button type="button" className="request-button" onClick={changeAvailability} disabled={availabilityBusy || (!availability.eligible && availability.availability_status !== "available")}>{availabilityBusy ? "Updating…" : availability.availability_status === "available" ? "Go offline" : "Go online"}</button><small>Online activation requires a verified vehicle and an active service zone. Approval alone never activates availability.</small></div>}
        {notice && <div className="notice" role="status" aria-live="polite">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Dismiss message">×</button></div>}
        {authenticated && application && <DriverVehicleOnboarding canSubmit={!['rejected','suspended'].includes(application.verification_status)} />}
      </div>
      <aside className="driver-requirements"><span className="step-label">02 / VERIFICATION CHECKLIST</span><h2>Before a driver can go online</h2><ul><li><b>Identity</b><span>Government-issued identity and secure identity review.</span></li><li><b>Driving eligibility</b><span>Valid licence and locally required permits.</span></li><li><b>Vehicle</b><span>Registration, ownership authorization and applicable inspection.</span></li><li><b>Safety</b><span>Insurance and local operating requirements.</span></li></ul><div className="requirement-note">Application status is stored as pending. No document upload, automated KYC, driver approval or dispatch is active yet.</div></aside>
    </section>
    <footer className="portal-footer"><span>Independent project · Not affiliated with or endorsed by Pi Network.</span><Link href="/">Back to passenger booking →</Link></footer>
  </main>;
}
