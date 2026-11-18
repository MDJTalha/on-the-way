"use client";

import { useMemo, useState } from "react";

type RideType = "car" | "bike" | "rickshaw";
type RideOption = { id: RideType; name: string; detail: string; eta: string; fare: number; icon: string };

const rides: RideOption[] = [
  { id: "car", name: "Standard car", detail: "Up to 4 seats · 2 bags", eta: "Sample only", fare: 2.4, icon: "🚘" },
  { id: "bike", name: "Bike", detail: "1 passenger · light luggage", eta: "Sample only", fare: 1.1, icon: "🏍️" },
  { id: "rickshaw", name: "Rickshaw", detail: "Up to 3 passengers", eta: "Sample only", fare: 1.6, icon: "🛺" },
];

const money = (value: number) => value.toFixed(2);

export default function Home() {
  const [rideType, setRideType] = useState<RideType>("car");
  const [pickup, setPickup] = useState("Current location");
  const [destination, setDestination] = useState("");
  const [offerMode, setOfferMode] = useState<"suggested" | "offer">("suggested");
  const [offer, setOffer] = useState(2.4);
  const [scheduled, setScheduled] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("Ride");

  const selectedRide = useMemo(() => rides.find((ride) => ride.id === rideType) ?? rides[0], [rideType]);
  const estimatedFare = offerMode === "suggested" ? selectedRide.fare : offer;

  function requestRide() {
    if (!destination.trim()) {
      setNotice("Add a destination to continue.");
      return;
    }
    setNotice("Booking preview created. Connect the API and Pi Testnet to submit a live request.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Pi Mobility home">
          <span className="brand-mark">P<span>i</span></span>
          <span className="brand-name">mobility</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          {["Ride", "Drive", "Business"].map((item) => (
            <button key={item} className={activeTab === item ? "nav-link active" : "nav-link"} onClick={() => setActiveTab(item)}>{item}</button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="network-pill"><i /> Prototype - no live network</span>
          <button className="language-button" aria-label="Language">EN <span>⌄</span></button>
          <button className="sign-in" onClick={() => setNotice("Pi authentication will be enabled after Testnet app credentials are configured.")}>Sign in with Pi <span className="pi-dot">π</span></button>
          <button className="menu-button" aria-label="Open menu">☰</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> EVERY JOURNEY, MORE CONNECTED</div>
          <h1>Move freely.<br /><em>Pay with Pi.</em></h1>
          <p className="hero-subtitle">Your city. Your ride. Your choice.</p>
          <div className="hero-trust">
            <span><b>✳</b> Transparent fares</span>
            <span><b>⌖</b> Local drivers</span>
            <span><b>◈</b> Pi-powered</span>
          </div>
        </div>
        <div className="hero-note">
          <span className="note-orb">π</span>
          <div><strong>Real-world utility starts here.</strong><small>One marketplace. Everyday mobility.</small></div>
        </div>
      </section>

      <section className="workspace">
        <div className="booking-column">
          <div className="section-heading">
            <div><span className="step-label">01 / YOUR JOURNEY</span><h2>Where to?</h2></div>
            <button className={scheduled ? "schedule active" : "schedule"} onClick={() => setScheduled(!scheduled)}>◷ <span>{scheduled ? "Scheduled" : "Schedule"}</span></button>
          </div>

          <div className="booking-card">
            <div className="route-fields">
              <div className="route-rail"><span className="pickup-dot" /><span className="route-stem" /><span className="destination-dot" /></div>
              <label className="location-field">
                <span className="field-caption">PICKUP</span>
                <input value={pickup} onChange={(e) => setPickup(e.target.value)} aria-label="Pickup location" />
                <span className="field-action">◎</span>
              </label>
              <label className="location-field destination-field">
                <span className="field-caption">DESTINATION</span>
                <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Enter your destination" aria-label="Destination" />
                <span className="field-action">⌕</span>
              </label>
            </div>
            {scheduled && <div className="schedule-row"><label>Date and time <input type="datetime-local" /></label></div>}
            <div className="divider" />
            <div className="vehicle-heading"><span className="step-label">02 / CHOOSE YOUR RIDE</span><span className="muted-small">Illustrative options</span></div>
            <div className="ride-options">
              {rides.map((ride) => (
                <button key={ride.id} onClick={() => { setRideType(ride.id); setOffer(ride.fare); }} className={rideType === ride.id ? "ride-option selected" : "ride-option"}>
                  <span className="ride-icon">{ride.icon}</span>
                  <span className="ride-info"><strong>{ride.name}</strong><small>{ride.detail}</small></span>
                  <span className="ride-price"><strong>π {money(ride.fare)}</strong><small>{ride.eta}</small></span>
                  <span className="radio-mark">{rideType === ride.id ? "●" : "○"}</span>
                </button>
              ))}
            </div>
            <div className="divider" />
            <div className="vehicle-heading"><span className="step-label">03 / SET YOUR PRICE</span><span className="muted-small">No hidden fees</span></div>
            <div className="price-toggle">
              <button className={offerMode === "suggested" ? "toggle-option chosen" : "toggle-option"} onClick={() => setOfferMode("suggested")}>Suggested fare</button>
              <button className={offerMode === "offer" ? "toggle-option chosen" : "toggle-option"} onClick={() => setOfferMode("offer")}>Make an offer</button>
            </div>
            {offerMode === "offer" ? (
              <div className="offer-control">
                <div className="offer-value"><span>Your offer</span><strong>π {money(offer)}</strong></div>
                <input type="range" min={Math.max(0.5, selectedRide.fare * 0.6)} max={selectedRide.fare * 1.8} step="0.1" value={offer} onChange={(e) => setOffer(Number(e.target.value))} aria-label="Your Pi fare offer" />
                <div className="range-labels"><span>Lower offer</span><span>Higher offer</span></div>
              </div>
            ) : (
              <div className="fare-summary"><span>Illustrative fare - not a quote</span><strong>π {money(selectedRide.fare)}</strong><small>Sample value only - final quote requires live pricing</small></div>
            )}
            <button className="request-button" onClick={requestRide}>Find a {selectedRide.name.toLowerCase()} <span>→</span></button>
            {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
            <p className="fine-print">No payment is taken at this stage. You review the final fare before confirming.</p>
          </div>
          <div className="below-card"><span className="shield">◇</span><span><strong>Your trip, your control.</strong><small>Driver details and trip sharing are part of the safety roadmap.</small></span></div>
        </div>

        <div className="map-column">
          <div className="map-topline"><div><span className="step-label">LIVE MARKETPLACE</span><h3>Explore your area</h3></div><button className="map-expand" aria-label="Expand map">⤢</button></div>
          <div className="map-panel">
            <div className="map-grid" />
            <svg className="map-art" viewBox="0 0 760 620" preserveAspectRatio="xMidYMid slice" aria-label="Illustrative map preview">
              <path className="river" d="M-30 460 C120 390 120 510 270 430 S460 340 520 390 S690 450 800 340" />
              <path className="road road-main" d="M-20 150 L210 250 L410 190 L780 290" />
              <path className="road road-main" d="M130 -20 L220 180 L290 340 L350 660" />
              <path className="road road-main" d="M520 -20 L470 160 L570 300 L650 650" />
              <path className="road road-secondary" d="M-20 330 L190 300 L350 390 L530 350 L790 470" />
              <path className="road road-secondary" d="M60 600 L180 450 L270 330 L400 230 L610 80" />
              <path className="road road-secondary" d="M350 -20 L370 130 L470 280 L430 440 L500 660" />
              <path className="route-line" d="M210 250 C260 265 290 300 330 335 S440 370 500 300" />
              <circle cx="210" cy="250" r="10" className="map-pickup" />
              <circle cx="500" cy="300" r="10" className="map-drop" />
              <circle cx="210" cy="250" r="22" className="map-pulse" />
            </svg>
            <div className="map-label label-a"><span className="pin-dot" /> Your pickup</div>
            <div className="map-label label-b"><span className="pin-end" /> Destination</div>
            <div className="map-location">⌖ <span>Location preview</span></div>
            <div className="map-status"><span className="status-dot" /> Map provider connection pending</div>
            <div className="map-scale">Illustrative route · Not for navigation</div>
          </div>
          <div className="map-foot">
            <div className="coverage-icon">⌖</div>
            <div><strong>Launch city not configured</strong><small>Live driver availability will appear after a city pilot is configured.</small></div>
            <span className="coming-soon">PILOT READYING</span>
          </div>
        </div>
      </section>

      <section className="bottom-strip">
        <div><span className="strip-icon">01</span><span><strong>Choose with confidence</strong><small>Compare vehicle categories and sample fares.</small></span></div>
        <div><span className="strip-icon">02</span><span><strong>Pay with purpose</strong><small>Pi-first payments, verified securely.</small></span></div>
        <div><span className="strip-icon">03</span><span><strong>Built to go further</strong><small>Mobility today. More everyday services next.</small></span></div>
      </section>

      <footer className="footer">
        <div className="footer-brand"><span className="brand-mark small">P<span>i</span></span> mobility</div>
        <span>Independent project · Not affiliated with or endorsed by Pi Network.</span>
        <span>© 2026 Pi Mobility · Preview 0.1.0</span>
      </footer>
    </main>
  );
}
