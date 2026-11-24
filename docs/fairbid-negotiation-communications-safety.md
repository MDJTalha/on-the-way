# On-the-way FairBid: negotiation, communications and trip safety

**Market:** Lahore, Punjab, Pakistan | **Currency:** PKR | **Product:** Pakistan-first mobility; Pi optional.  
**Status:** Research/architecture baseline plus relational schema foundation. No fare policy, payment rail, dispatch or communication provider is active.

## 1. Business proposition

Build a two-sided negotiated mobility marketplace, not a fixed-price taxi meter and not a lowest-bid auction. The platform calculates a transparent route-based reference price and a defensible range. A passenger proposes a fare; eligible captains accept or counteroffer; the passenger chooses the offer balancing price, pickup time, vehicle, verification and service quality. The mutually accepted fare is locked before trip activation.

The product adopts the core offer/counteroffer choice described in inDrive's Pakistan help material, while improving pickup-cost visibility, route/time inputs, expiry, versioned policy, total-price disclosure, reliability signals and auditable negotiation history. inDrive says its recommended minimum bidding fare varies by location/route, drivers can accept or counter, and the agreed price cannot be changed during the ride: https://indrive.com/en-pk/help/passengers/how-fares-are-calculated.

## 2. FairBid pricing methodology

### 2.1 Route inputs

The server-side routing adapter must return road distance in metres, expected duration in seconds, route geometry/reference, provider and calculation timestamp, captain approach distance/time, and toll/airport/parking charges only when those can be established reliably. Never calculate fares from straight-line coordinates. Never trust client-supplied distance, duration, toll or amount. Persist provider and pricing-policy versions with every quote. If live traffic is unavailable, label the estimate as non-traffic-based instead of implying live accuracy.

Google Routes supports route computation, route matrices, two-wheel motorized routing in supported regions and traffic-aware routing modes. Mapbox Directions supports traffic-aware driving profiles only in covered geographies. Confirm Lahore coverage, bike routing quality, licensing terms and commercial cost before selecting the provider:
- https://developers.google.com/maps/documentation/routes
- https://developers.google.com/maps/documentation/routes/config_trade_offs
- https://docs.mapbox.com/api/navigation/directions/

### 2.2 Explainable reference fare

Use exact decimal arithmetic and round only at the final configured currency increment. Candidate policy formula:

`route_component = base_fare + (route_km × per_km_rate) + (estimated_minutes × per_minute_rate)`

`approach_component = (captain_approach_km × pickup_per_km_rate) + configured approach-time cost`

`pre_adjustment = max(minimum_fare, route_component + approach_component)`

`reference_fare = round_to_policy_increment(pre_adjustment × bounded_demand_factor) + disclosed_tolls_and_fees`

This is a policy template, not an active tariff. Calibrate separately for car, bike and rickshaw using actual Lahore fuel/energy prices, consumption, maintenance, depreciation, expected utilisation, deadheading, driver time, insurance, taxes and lawful costs. Do not invent fare values or assume every captain has identical costs.

### 2.3 Captain viability and passenger fairness

- A captain-side viability floor should reflect the driver's vehicle class and approach cost. Keep private cost inputs confidential; show the captain a clear acceptability indicator.
- Passenger UI shows the route-based reference fare, suggested offer band and estimate drivers (traffic, route, pickup approach).
- Negotiation bounds come from the active approved city/vehicle policy. A captain may voluntarily accept below a modelled viability indicator; the platform must not coerce acceptance. Enforce any statutory minimum if applicable.
- Demand adjustments are bounded, explainable, time-stamped and visible to both sides. No opaque or unlimited surge multiplier.
- Disclose tolls, airport/parking charges, taxes and platform charges separately, including who pays each. No surprise fee after acceptance.
- Never expose another captain's live bid or private cost data to competitors.

### 2.4 Negotiation lifecycle

1. Passenger selects pickup, destination, vehicle and optional requirements.
2. Backend validates the service boundary, computes a route and loads an approved effective fare policy; it creates an expiring quote.
3. Passenger submits a PKR bid with an idempotency key. Server checks quote ownership, expiry, policy bounds and booking state.
4. Dispatch sends the request to eligible, verified, online captains in staged geographic rings. Each captain may accept the passenger bid or submit a counteroffer. A captain may revise/withdraw their own pending offer under controlled rules.
5. Passenger compares total amount, pickup ETA, approach distance, captain profile, completed-trip count, verification and vehicle. Do not rank solely by lowest fare.
6. Passenger accepts exactly one current offer. Server locks booking and offer rows, rechecks expiry and eligibility, accepts one offer, supersedes competitors, writes the immutable event and locks the fare in one transaction.
7. Captain acknowledges assignment. If the captain declines or times out, only a valid state transition may return the request to matching; never silently reassign an already-started trip.
8. After trip start, fare cannot change unilaterally. A passenger-requested destination/stop change requires a server-generated amendment, explicit consent by both parties and an audit event before route change. Disputes go through support, not ad-hoc cash demands.

Initial operating parameters such as quote validity, captain response windows, counteroffer limits and staged search radius should be tested in a closed pilot, not treated as universal truths or embedded in UI code. Tune using acceptance rate, time-to-match, cancellation, captain net earnings and repeat bookings. Do not optimise only for lowest fare.

### 2.5 Fairness and abuse controls

- Atomic single-winner acceptance; row locks and unique constraints prevent double assignment.
- Expiry uses server time; stale quotes/offers cannot be accepted.
- Idempotency for quote, bid, counteroffer, acceptance and payment operations.
- Rate-limit by account/device/IP; detect spam, automated underbidding, repeated cancellations and coordinated bid manipulation.
- Append-only audit: actor, action, prior/new state, amount, currency, quote/policy IDs, timestamp and reason code.
- Suspended, unverified, offline or out-of-zone captains cannot bid.
- Separate reliability signals from protected characteristics; provide review/appeal for automated restrictions.
- Pilot shadow pricing and a small invited captain cohort before enabling customer-facing fares.

## 3. Passenger and captain communications

### 3.1 In-app chat — primary channel

Create a booking-scoped conversation when a captain submits an offer or the ride is matched. Before a captain is selected, use structured prompts rather than revealing contact details. Quick actions can include “I am at the pickup point”, “Use the main gate”, “I am arriving”, “Confirm vehicle colour” and “I need accessibility assistance”.

Persist messages with server timestamps, sender identity, delivery/read state and immutable audit references. Client-generated IDs make retries idempotent. Apply length limits, abuse reporting, block controls and support escalation. Do not allow requests for OTPs, passwords, payment PINs or identity documents. Detect and warn about attempts to move payment off-platform. Chat remains available for legitimate coordination during an active ride, then becomes read-only/closed under an approved retention and dispute policy.

### 3.2 Masked calling — secondary channel

Contract a voice/CPaaS provider only after written confirmation that Pakistan-origin and Pakistan-termination proxy calls, local caller IDs, caller masking, emergency handling, CLI regulations, recording rules, uptime and pricing are supported. The backend authorises a call only if both participants belong to the same eligible booking and its state permits contact. The provider bridges the real numbers; the app/database store only provider session reference, state, timestamps and booking ID. Never return the other party's number to the client. Do not record calls by default. Any future recording requires legal review, notice, consent and a strict retention/access policy.

### 3.3 Notifications and fallback

- Persisted booking events/realtime stream are the source of truth; push is an alert/wake-up channel, not proof of delivery or reading.
- Push alerts cover new offer, counteroffer, acceptance, captain arrival, trip start/end, cancellation and safety events.
- SMS is for OTP and essential fallback only; use a PTA-compliant provider and approved sender identity. Do not include trip coordinates or sensitive identity details in SMS.
- WhatsApp Business may be optional after Meta approval and consent, never the only safety-critical channel. A user-initiated WhatsApp message opens a limited service window; outside it, approved templates are required.
- Persist delivery attempts and use retry/backoff/dead-letter handling. A queued push is not proof the recipient saw it.

## 4. Live trip tracking and location privacy

- Driver app obtains location only while online/available and during an active assigned trip, with OS permission and clear disclosure. No continuous background tracking when offline or after completion.
- Suggested pilot telemetry cadence: 3–5 seconds while moving, slower while stationary; adapt to speed, battery, network and safety. This is an engineering hypothesis to validate, not a legal standard.
- Store accuracy, heading, speed, device-recorded time and server-received time. Reject impossible jumps, stale timestamps and poor-accuracy fixes. Smooth passenger display without losing controlled evidence integrity.
- Passenger sees the assigned captain's live position only after valid assignment and until a short post-completion grace period. Captain sees passenger location only as required for pickup/active-trip needs.
- Share-trip links use unguessable, revocable, short-lived tokens and privacy-limited views. Do not expose full account details. Let passengers share a trip with trusted contacts.
- Detect route deviation only against a route corridor and GPS accuracy threshold; traffic, road closures and passenger-approved route changes must not be labelled misconduct.
- Obtain counsel/regulator-approved retention. Use least privilege, encryption in transit/at rest, audit staff access and purge raw high-frequency points after the approved period while preserving legally required trip records.

## 5. SOS, incident response and vulnerable users

- Persistent SOS for passenger and captain during an active trip, with accidental-trigger handling that does not create dangerous delay.
- Activation creates a high-priority incident, preserves relevant trip/identity/vehicle context, alerts the response desk and shows direct emergency-call actions.
- Punjab Police lists 15 for police emergency and Rescue 1122 for rescue/medical emergencies. Display direct-call actions; do not claim dispatch integration without a formal integration: https://punjabpolice.gov.pk/emergency_help.
- Capture incident type/severity, reporter, timestamp, last reliable location, response owner, escalation, actions and closure evidence.
- Provide route-deviation, accident, medical, harassment and vehicle-issue reports, block controls and post-trip case IDs.
- Define support hours, escalation SLA, on-call roster, law-enforcement request process and evidence preservation before launch.
- Additional safeguards for women, elderly passengers, minors and people with disabilities need local stakeholder and policy review. Do not advertise women-only/female-driver options until real supply and safeguards exist.

## 6. Payments and settlement

PKR is the commercial reference and target fare currency. Pi is optional future tender after demand validation and Testnet reconciliation. Local digital payments require merchant onboarding with a bank/regulated provider, server-verified payment status, signed callbacks or server-to-server verification, idempotency, refunds, settlement reports and daily reconciliation. Explore Raast merchant acceptance through a bank or authorised provider; a personal P2P transfer or screenshot is not verified merchant settlement.

**Cash must not be assumed to be permitted.** Punjab's 2026 TNC safety protocol states payments are to be made through approved in-app digital modes. Obtain written regulator/legal clarification before enabling cash. Separate fare agreement from payment status: accepting a fare is not payment, and a client success screen is not settlement. Do not claim escrow, custody, guaranteed refunds or Pi/PKR conversion without the required regulated product and provider contract.

## 7. Lahore legal and regulatory gates

Punjab's Provincial Motor Vehicles (Amendment) Act 2025 and DPPT framework introduce TNC licensing and separate CVH/PVH route-permit streams. Punjab's safety protocols approved in February 2026 require valid authorisation, registered/fitness-certified/insured vehicles, verified drivers, digitally activated traceable rides, in-app SOS, incident reporting and passenger-data safeguards. Obtain written counsel/authority confirmation on:

- TNC operating licence and correct company/operating entity;
- CVH/PVH classification, vehicle permits, registration, annual fitness/emission inspection and insurance/compensation cover;
- driver licence, background/police clearance, medical fitness and required training;
- DPPT registration/data-sharing requirements, fields, API access and retention;
- approved in-app payment modes and whether cash is prohibited;
- tax, invoice, fare display, complaints, liability and consumer protection;
- applicable PECA, telecom, privacy, cross-border hosting and breach response.

MoITT's legislation register lists the Personal Data Protection Bill 2023 as draft: https://www.moitt.gov.pk/Legislations. That does not justify collecting less carefully. Implement privacy-by-design and obtain current legal advice on PECA, contracts, telecom and sector rules. Do not state a comprehensive Personal Data Protection Act is in force without current primary-law verification.

## 8. Technical architecture

- Pricing service: server-only; versioned policy; decimal arithmetic; routing adapter; explainable breakdown; expiry.
- Negotiation service: append-only offer/event history; row locks; idempotency; one accepted offer per booking; eligibility recheck.
- Dispatch service: staged geospatial rings; verified/online/in-zone filters; route-matrix pickup ETA; fair rotation; concurrency-safe assignment; timeout/decline recovery.
- Realtime service: persisted booking events plus WebSocket/SSE/pub-sub adapter; push supplemental only.
- Communications service: booking-scoped authorization, in-app chat, masked-call provider adapter, SMS/WhatsApp behind feature flags.
- Tracking service: authenticated driver telemetry, active-trip scope, privacy-limited passenger view, retention and incident evidence controls.
- Safety service: SOS/incident queue, on-call escalation, direct emergency dial and audit trail.
- Payment service: separate payment state machine, merchant-provider adapter, settlement ledger and reconciliation; Pi is a separate optional adapter.
- Operator console: support cases, fare disputes, incidents, location-access audit, provider failures, dispatch exceptions and payment reconciliation exceptions.

Migration 010 establishes relational foundations for versioned fare policies, route-linked quotes, offer history, booking chat, masked-call provider references, trip location telemetry and safety incidents. It seeds no fare policy and activates no provider. APIs, role checks, retention jobs, realtime transport and provider integrations remain unimplemented.

## 9. Pilot metrics and acceptance criteria

Measure by vehicle class, zone, time band and cohort: quote-to-bid conversion; bid-to-match conversion; time-to-first-offer and time-to-accept; passenger bid vs reference vs final fare; captain gross fare and estimated net earnings after approach distance, fuel/energy and time; captain/passenger cancellations; no-shows and reassignment; pickup/trip ETA error; completed/repeat trips; complaints per 1,000 trips; SOS response time; chat/push latency; masked-call connection and SMS fallback; payment success, duplicate callbacks, settlement lag, refunds/disputes and reconciliation variance.

Do not optimise only gross bookings or lowest passenger fare. Marketplace viability requires acceptable passenger pricing, positive captain economics, reliable fulfilment and safe operations simultaneously.

## 10. Source register

- Punjab TNC regulation: https://pta.punjab.gov.pk/TNC
- Punjab DPPT overview: https://pta.punjab.gov.pk/digital-platform-for-passenger-transportation
- Punjab TNC safety protocols (approved 10 February 2026): https://transport.punjab.gov.pk/urdu/system/files/TNC%20Safety%20and%20Security%20Protocols.pdf
- inDrive Pakistan fare negotiation: https://indrive.com/en-pk/help/passengers/how-fares-are-calculated
- SBP Raast merchant onboarding: https://www.sbp.org.pk/our-subsidiaries/raast/join-raast
- SBP Raast P2M circular: https://www.sbp.org.pk/circulars/pspod-circular-letter-no-01-of-2024
- MoITT legislation register: https://www.moitt.gov.pk/Legislations
- Punjab Police emergency contacts: https://punjabpolice.gov.pk/emergency_help
- Google Routes API: https://developers.google.com/maps/documentation/routes
- Mapbox Directions API: https://docs.mapbox.com/api/navigation/directions/
- Firebase push priority: https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-priority
- WhatsApp Business messaging window: https://www.twilio.com/docs/whatsapp/key-concepts

Research is product/engineering guidance, not legal advice or provider approval. Verify current official notifications and obtain local counsel/authority confirmation before launch.

## 3.4 Provider evaluation shortlist — not a vendor selection

**Pakistan SMS/OTP:** SendPK publicly describes itself as a Lahore-based PTA-approved SMS aggregator and lists transactional SMS, OTP, branded sender IDs and APIs. Treat it as a candidate for an RFP, not an approved On-the-way supplier. Obtain PTA licence/authorisation evidence, operator route coverage (Jazz, Zong, Ufone, Telenor), delivery receipts, sender-ID registration in On-the-way's legal entity name, OTP abuse controls, DPA/data location, support SLA, pricing and test SIM results before onboarding: https://sendpk.com/terms-conditions.php.

**Masked voice:** Twilio and Vonage document voice-proxy/number-masking patterns; 8x8 documents a dedicated Number Masking API with a provider-allocated virtual number and webhook flow. These documents establish the technical pattern, not Pakistan number availability or local call termination. Obtain written vendor confirmation for +92 caller IDs, local mobile termination, inbound/outbound masking, number provisioning, PTA/CLI requirements, call recording defaults, webhook signatures, emergency call limitations, per-minute cost, failover and support before choosing any vendor:
- https://www.twilio.com/docs/glossary/what-is-voice-proxy
- https://developer.vonage.com/en/voice/voice-api/guides/masked-calling
- https://support.cpaas.8x8.com/hc/en-us/sections/59375034292633-Voice-Number-Masking

**WhatsApp:** Use official WhatsApp Business Platform only after business verification, template approval and opt-in. It is suitable for non-critical service updates and support continuity, not a substitute for in-app trip status, SOS or masked voice.

A vendor should pass a proof-of-capability test from multiple Pakistan mobile networks before procurement. Do not send production passenger/driver personal data to a trial account.
