"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";

type VehicleType = "car" | "bike" | "rickshaw";
type Place = { label: string; latitude: number; longitude: number };
type Booking = {
  id: string;
  vehicle_type: VehicleType;
  status: string;
  pickup_label: string;
  destination_label: string;
  created_at: string;
};
type SearchResult = { display_name: string; lat: string; lon: string };

const vehicles: { id: VehicleType; name: string; detail: string; icon: string }[] = [
  { id: "car", name: "Car", detail: "Everyday comfort", icon: "🚘" },
  { id: "bike", name: "Bike", detail: "Quick solo trips", icon: "🏍️" },
  { id: "rickshaw", name: "Rickshaw", detail: "Flexible city rides", icon: "🛺" },
];

const statusLabel: Record<string, string> = {
  requested: "Request received",
  matching: "Finding a driver",
  driver_assigned: "Driver assigned",
  driver_arriving: "Driver on the way",
  in_progress: "Trip in progress",
  completed: "Completed",
  cancelled: "Cancelled",
  payment_pending: "Payment pending",
  paid: "Paid",
  disputed: "Under review",
};

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `otw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Home() {
  const [vehicle, setVehicle] = useState<VehicleType>("car");
  const [pickup, setPickup] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [pickupQuery, setPickupQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [pickupResults, setPickupResults] = useState<SearchResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState<"pickup" | "destination" | null>(null);
  const [note, setNote] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState("");
  const [piReady, setPiReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [apiState, setApiState] = useState<"checking" | "online" | "offline">("checking");
  const [locating, setLocating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mapMode, setMapMode] = useState<"roadmap" | "satellite">("roadmap");
  // Keep the same key for an identical retry after an uncertain network response.
  const pendingRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const searchSequence = useRef(0);

  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === vehicle) ?? vehicles[0], [vehicle]);

  const loadBookings = useCallback(async () => {
    try {
      const response = await fetch("/api/bookings", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch { /* The screen retains its last confirmed state. */ }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/health", { cache: "no-store" }).then(async (r) => {
        const d = await r.json();
        if (active) setApiState(r.ok && d.database === "connected" ? "online" : "offline");
      }).catch(() => { if (active) setApiState("offline"); }),
      fetch("/api/auth/session", { cache: "no-store" }).then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        if (active && d.authenticated && typeof d.user?.username === "string") setUser(d.user.username);
      }).catch(() => undefined),
    ]);
    return () => { active = false; };
  }, []);

  useEffect(() => { if (user) void loadBookings(); }, [user, loadBookings]);

  async function searchPlace(which: "pickup" | "destination") {
    if (searching !== null) return;
    const sequence = ++searchSequence.current;
    const query = (which === "pickup" ? pickupQuery : destinationQuery).trim();
    if (query.length < 3) {
      setNotice("Enter at least three characters to search for a place.");
      return;
    }
    setSearching(which);
    setNotice("");
    try {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error : "Place search is temporarily unavailable.";
        throw new Error(message);
      }
      const results = payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results)
        ? (payload as { results: SearchResult[] }).results : [];
      if (sequence !== searchSequence.current) return;
      if (which === "pickup") setPickupResults(results);
      else setDestinationResults(results);
      if (!results.length) setNotice("No matching places found. Try a nearby landmark or a more specific address.");
    } catch {
      if (sequence === searchSequence.current) setNotice("Place search is unavailable. You can use your current location for pickup or try again.");
    } finally {
      if (sequence === searchSequence.current) setSearching(null);
    }
  }

  function choosePlace(which: "pickup" | "destination", result: SearchResult) {
    const place = {
      label: result.display_name,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    };
    if (which === "pickup") {
      setPickup(place);
      setPickupQuery(result.display_name);
      setPickupResults([]);
    } else {
      setDestination(place);
      setDestinationQuery(result.display_name);
      setDestinationResults([]);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice("Location services are not supported by this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      let label = `Current location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
      try {
        const response = await fetch(`/api/places/reverse?lat=${latitude}&lon=${longitude}`, { cache: "no-store" });
        if (response.ok) {
          const data: unknown = await response.json();
          if (data && typeof data === "object" && typeof (data as { display_name?: unknown }).display_name === "string") {
            label = (data as { display_name: string }).display_name;
          }
        }
      } catch { /* Coordinates remain usable without a reverse-geocoded label. */ }
      setPickup({ label, latitude, longitude });
      setPickupQuery(label);
      setLocating(false);
    }, () => {
      setNotice("We could not access your location. Check browser permissions or search for your pickup.");
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  async function signIn() {
    if (!window.Pi) { setNotice("Open On the Way in Pi Browser to sign in."); return; }
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
      setUser(data.user.username);
      setNotice("Your Pi identity has been verified.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pi sign-in could not be completed.");
    } finally { setAuthBusy(false); }
  }

  async function signOut() {
    setAuthBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("The server did not confirm sign-out.");
      setUser("");
      setBookings([]);
      setShowHistory(false);
      pendingRequest.current = null;
      setNotice("You have signed out.");
    } catch {
      setNotice("Sign-out could not be confirmed. Please retry.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitRide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!user) { setNotice("Sign in with Pi before requesting a ride."); return; }
    if (!pickup || !destination) { setNotice("Choose a pickup and destination from the place search results."); return; }
    if (pickup.latitude === destination.latitude && pickup.longitude === destination.longitude) {
      setNotice("Pickup and destination must be different places.");
      return;
    }
    setSubmitting(true);
    const requestPayload = {
      pickup,
      destination,
      vehicleType: vehicle,
      passengerNote: note.trim(),
    };
    const fingerprint = JSON.stringify(requestPayload);
    if (!pendingRequest.current || pendingRequest.current.fingerprint !== fingerprint) {
      pendingRequest.current = { fingerprint, key: newIdempotencyKey() };
    }
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pendingRequest.current.key },
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your ride request could not be submitted.");
      pendingRequest.current = null;
      setNotice(data.replayed
        ? "Your original ride request was safely recovered. No duplicate booking was created."
        : "Ride request received. No driver has been assigned and no payment has been taken.");
      setBookings((current) => [data.booking, ...current.filter((b) => b.id !== data.booking.id)]);
      setShowHistory(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The booking service could not be reached. Retry without changing the request to safely recover its result.");
    } finally { setSubmitting(false); }
  }

  async function cancelBooking(bookingId: string) {
    if (cancellingId) return;
    setCancellingId(bookingId);
    setNotice("");
    try {
      const response = await fetch("/api/bookings/" + bookingId + "/cancel", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cancellation could not be confirmed.");
      setBookings((current) => current.map((booking) => booking.id === bookingId ? data.booking : booking));
      setNotice(data.replayed ? "This ride request was already cancelled." : "Your ride request has been cancelled.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cancellation could not be confirmed. Check your ride history.");
    } finally { setCancellingId(null); }
  }

  const mapPlace = destination ?? pickup;
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const googleMapsSrc = googleMapsKey && mapPlace
    ? (() => {
        const base = "https://www.google.com/maps/embed/v1/";
        const params = new URLSearchParams({ key: googleMapsKey });
        if (pickup && destination) {
          params.set("origin", pickup.latitude + "," + pickup.longitude);
          params.set("destination", destination.latitude + "," + destination.longitude);
          params.set("mode", vehicle === "bike" ? "bicycling" : "driving");
          params.set("maptype", mapMode);
          return base + "directions?" + params.toString();
        }
        params.set("center", mapPlace.latitude + "," + mapPlace.longitude);
        params.set("zoom", "16");
        params.set("maptype", mapMode);
        return base + "view?" + params.toString();
      })()
    : "";
  const fallbackMapSrc = mapPlace
    ? "https://www.openstreetmap.org/export/embed.html?bbox=" + (mapPlace.longitude - 0.025) + "%2C" + (mapPlace.latitude - 0.018) + "%2C" + (mapPlace.longitude + 0.025) + "%2C" + (mapPlace.latitude + 0.018) + "&layer=mapnik&marker=" + mapPlace.latitude + "%2C" + mapPlace.longitude
    : "";

  return (
    <main className="app-shell passenger-app">
      <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="afterInteractive" onReady={() => {
        try {
          if (!window.Pi) throw new Error("Pi SDK unavailable");
          window.Pi.init({ version: "2.0", sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX !== "false" });
          setPiReady(true);
        } catch { setNotice("Pi SDK could not be initialized. Open the app in Pi Browser."); }
      }} onError={() => setNotice("Pi SDK could not be loaded. Check your connection.")} />

      <header className="topbar">
        <Link className="brand" href="/" aria-label="On the Way home"><span className="brand-mark">O<span>W</span></span><span className="brand-name">on the way</span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link className="nav-link active" href="/">Ride</Link>
          <Link className="nav-link" href="/driver">Drive</Link>
          <Link className="nav-link" href="/business">Business</Link>
        </nav>
        <div className="header-actions">
          <span className={`network-pill ${apiState}`}><i />{apiState === "online" ? "Service online" : apiState === "offline" ? "Service unavailable" : "Checking service"}</span>
          <button className="sign-in" onClick={user ? signOut : signIn} disabled={authBusy || (!user && !piReady)}>
            {user ? `Sign out · ${user}` : authBusy ? "Connecting…" : piReady ? "Sign in with Pi" : "Loading Pi…"} <span className="pi-dot">π</span>
          </button>
        </div>
      </header>

      <section className="hero passenger-hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> EVERY JOURNEY, MORE CONNECTED</div>
          <h1>Move freely.<br /><em>Explore your city.</em></h1>
          <p className="hero-subtitle">Your city. Your ride. Your choice.</p>
          <div className="hero-trust"><span><b>✓</b> Clear booking status</span><span><b>⌖</b> Location-aware</span><span><b>π</b> Pi identity</span></div>
        </div>
        <div className="hero-note"><span className="note-orb">π</span><div><strong>Built for everyday mobility.</strong><small>Independent project · Not a Pi Network service</small></div></div>
      </section>

      <section className="workspace passenger-workspace">
        <div className="booking-column">
          <div className="section-heading"><div><span className="step-label">01 / YOUR JOURNEY</span><h2>Where to?</h2></div><span className="market-tag">Lahore - Pre-launch</span></div>
          <form className="booking-card" onSubmit={submitRide}>
            <div className="route-fields">
              <div className="route-rail"><span className="pickup-dot" /><span className="route-stem" /><span className="destination-dot" /></div>
              <div className="location-field">
                <label className="field-caption" htmlFor="pickup-search">PICKUP LOCATION</label>
                <div className="place-search-row">
                  <input id="pickup-search" value={pickupQuery} onChange={(e) => { searchSequence.current += 1; setSearching(null); setPickupQuery(e.target.value); setPickup(null); setPickupResults([]); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchPlace("pickup"); } }} placeholder="Search address or landmark" autoComplete="off" />
                  <button type="button" className="place-search-button" onClick={() => void searchPlace("pickup")} disabled={searching !== null}>{searching === "pickup" ? "Searching…" : "Search"}</button>
                </div>
                <button type="button" className="location-action" onClick={useCurrentLocation} disabled={locating}>{locating ? "Finding your location…" : "◎ Use my current location"}</button>
                {pickup && <span className="selected-place">✓ Pickup selected</span>}
                {pickupResults.length > 0 && <div className="place-results" aria-label="Pickup search results">{pickupResults.map((r) => <button type="button" key={r.lat + r.lon} onClick={() => choosePlace("pickup", r)}>{r.display_name}</button>)}</div>}
              </div>
              <div className="location-field destination-field">
                <label className="field-caption" htmlFor="destination-search">DESTINATION</label>
                <div className="place-search-row">
                  <input id="destination-search" value={destinationQuery} onChange={(e) => { searchSequence.current += 1; setSearching(null); setDestinationQuery(e.target.value); setDestination(null); setDestinationResults([]); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchPlace("destination"); } }} placeholder="Where would you like to go?" autoComplete="off" />
                  <button type="button" className="place-search-button" onClick={() => void searchPlace("destination")} disabled={searching !== null}>{searching === "destination" ? "Searching…" : "Search"}</button>
                </div>
                {destination && <span className="selected-place">✓ Destination selected</span>}
                {destinationResults.length > 0 && <div className="place-results" aria-label="Destination search results">{destinationResults.map((r) => <button type="button" key={r.lat + r.lon} onClick={() => choosePlace("destination", r)}>{r.display_name}</button>)}</div>}
              </div>
            </div>

            <div className="divider" />
            <div className="vehicle-heading"><span className="step-label">02 / CHOOSE YOUR RIDE</span><span className="muted-small">Available categories</span></div>
            <div className="ride-options">
              {vehicles.map((v) => <button type="button" key={v.id} onClick={() => setVehicle(v.id)} className={vehicle === v.id ? "ride-option selected" : "ride-option"} aria-pressed={vehicle === v.id}>
                <span className="ride-icon">{v.icon}</span><span className="ride-info"><strong>{v.name}</strong><small>{v.detail}</small></span><span className="radio-mark">{vehicle === v.id ? "●" : "○"}</span>
              </button>)}
            </div>
            <div className="divider" />
            <div className="vehicle-heading"><span className="step-label">03 / TRIP DETAILS</span><span className="muted-small">Optional</span></div>
            <label className="note-field" htmlFor="passenger-note">Note for your driver <textarea id="passenger-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Pickup instructions or accessibility needs (max 500 characters)" /></label>
            <div className="fare-summary no-quote"><span>Fare estimate</span><strong>Not available yet</strong><small>Live pricing requires a configured pilot city and verified fare rules. No sample price is shown.</small></div>
            <button className="request-button" type="submit" disabled={submitting || apiState !== "online"}>{submitting ? "Submitting request…" : user ? `Request a ${selectedVehicle.name.toLowerCase()}` : "Sign in to request a ride"} <span>→</span></button>
            {notice && <div className="notice" role="status" aria-live="polite">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
            <p className="fine-print">A request is not a confirmed ride. No driver is assigned and no Pi payment is collected at this stage.</p>
          </form>
          <div className="below-card"><span className="shield">◇</span><span><strong>Safety by design.</strong><small>Driver verification and trip safety controls are required before launch.</small></span></div>
        </div>

        <aside className="map-column">
          <div className="map-topline"><div><span className="step-label">YOUR ROUTE</span><h3>Explore the area</h3></div><span className="map-provider-label">{googleMapsKey ? "Google Maps" : "OpenStreetMap fallback"}</span></div>
          <div className="map-mode-switch" role="group" aria-label="Map display mode">
            <button type="button" className={mapMode === "roadmap" ? "active" : ""} aria-pressed={mapMode === "roadmap"} onClick={() => setMapMode("roadmap")}>Map</button>
            <button type="button" className={mapMode === "satellite" ? "active" : ""} aria-pressed={mapMode === "satellite"} disabled={!googleMapsKey} title={googleMapsKey ? "Show Google satellite imagery" : "Configure a restricted Google Maps API key to enable satellite imagery"} onClick={() => setMapMode("satellite")}>Satellite / Earth imagery</button>
          </div>
          <div className="map-panel live-map-panel">
            {googleMapsSrc ? <iframe title={pickup && destination ? "Google Maps directions for selected journey" : "Google Maps view of selected location"} src={googleMapsSrc} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : fallbackMapSrc ? <iframe title="OpenStreetMap showing selected location" src={fallbackMapSrc} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /> : <div className="map-empty"><span>?</span><strong>Your map starts here</strong><p>Search for a pickup or destination to see its location.</p></div>}
          </div>
          <div className="map-attribution">{googleMapsKey ? "Google Maps ? Embedded map and satellite imagery" : "OpenStreetMap contributors ? Google Maps activates when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured"}</div>
          <div className="map-foot"><div className="coverage-icon">⌖</div><div><strong>{mapPlace ? "Location selected" : "Choose your locations"}</strong><small>{mapPlace ? `${mapPlace.latitude.toFixed(5)}, ${mapPlace.longitude.toFixed(5)}` : "Select a pickup and destination to prepare a request."}</small></div></div>
          <section className="history-panel">
            <button className="history-toggle" type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}><span><b>Recent ride requests</b><small>{user ? `${bookings.length} recorded requests` : "Sign in to view your history"}</small></span><span>{showHistory ? "−" : "+"}</span></button>
            {showHistory && <div className="history-list">{!user ? <p>Sign in with Pi to view your ride requests.</p> : bookings.length === 0 ? <p>No ride requests yet.</p> : bookings.map((b) => <article className="history-item" key={b.id}><div><strong>{b.pickup_label}</strong><small>to {b.destination_label}</small><small>{new Date(b.created_at).toLocaleString()}</small>{["requested", "matching"].includes(b.status) && <button type="button" className="location-action" onClick={() => void cancelBooking(b.id)} disabled={cancellingId !== null}>{cancellingId === b.id ? "Cancelling…" : "Cancel request"}</button>}</div><span className="booking-status">{statusLabel[b.status] ?? b.status.replaceAll("_", " ")}</span></article>)}</div>}
          </section>
        </aside>
      </section>

      <section className="bottom-strip"><div><span className="strip-icon">01</span><span><strong>Choose your journey</strong><small>Search real locations and choose a vehicle category.</small></span></div><div><span className="strip-icon">02</span><span><strong>Request transparently</strong><small>Know when a request is received and what remains pending.</small></span></div><div><span className="strip-icon">03</span><span><strong>Pi sign-in (preview)</strong><small>Authentication is verified by the Pi Platform API.</small></span></div></section>
      <footer className="footer"><div className="footer-brand"><span className="brand-mark small">O<span>W</span></span> on the way</div><span>Independent project · Not affiliated with or endorsed by Pi Network.</span><span>© 2026 On the Way</span></footer>
    </main>
  );
}
