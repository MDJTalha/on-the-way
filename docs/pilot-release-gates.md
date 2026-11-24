# Pilot and Production Release Gates

This document separates a working interface preview from a safe, operable mobility service. A gate is PASS only when its evidence is recorded against the deployed build and environment. A planned feature or successful frontend interaction is not evidence of backend completion.

## Current baseline

- [x] Next.js / React / TypeScript application foundation.
- [x] Responsive passenger, driver and operator preview routes.
- [x] Passenger API and isolated PostgreSQL/PostGIS development database.
- [x] Pi SDK integration, server token verification and signed passenger session foundation; real Pioneer acceptance pending.
- [x] Driver application persistence with pending/offline status; identity and vehicle verification pending.
- [x] Server-side geocoding adapter with Mapbox production provider support and development-only Nominatim fallback.
- [ ] Production Mapbox credentials, provider account/billing, usage limits and geographic coverage acceptance.
- [ ] Production routing and verified route/ETA service.
- [ ] Server-authoritative fare quotes and full booking state machine.
- [ ] Verified driver dispatch, trip event stream and live availability.
- [ ] Pi Testnet payment approval, completion and reconciliation.
- [ ] Operator authorization, support, safety and dispute workflows.
- [ ] Security, privacy, accessibility and operational certification.

## Gate A — Identity and access

- Use the official Pi authentication flow in a registered application.
- Validate Pi access tokens with the backend; do not trust client-submitted identity claims.
- Map Pi identity to a stable internal user record.
- Enforce passenger, driver, fleet, city operator and platform administrator permissions at API and resource level.
- Test expired, invalid, replayed and revoked credentials; rate-limit sensitive endpoints.

**Evidence:** real Pi Sandbox sign-in report, test report, authorization matrix, audit samples, environment configuration review.

## Gate B — Driver and marketplace integrity

- Require human/approved review of identity, licence, vehicle registration and applicable local documents.
- Do not dispatch unverified, suspended, offline or out-of-zone drivers.
- Keep driver location access purpose-limited and role-restricted.
- Implement atomic assignment so concurrent acceptances cannot assign two drivers to one ride.
- Expire stale offers and record all dispatch decisions.

**Evidence:** verification audit, dispatch concurrency tests, privacy review.

## Gate C — Pricing and booking integrity

- Calculate quotes on the server using versioned city/zone pricing rules.
- Return currency, breakdown, quote expiry and policy version.
- Enforce offer floors/ceilings and reject stale or tampered quote submissions.
- Validate every booking/trip state transition server-side with authorization and idempotency.
- Record cancellations, no-driver outcomes and disputes.

**Evidence:** pricing test vectors, state-transition tests, idempotency and race-condition tests.

## Gate D — Pi payments and ledger

- Use official Pi SDK and Platform API; keep API secrets server-side.
- Implement documented approval and completion steps.
- Verify payment status and transaction details with the backend/provider.
- Make callbacks, retries and completion idempotent.
- Reconcile payment, booking and ledger records; provide a controlled exception queue.
- Do not claim escrow, custody, automatic refunds or fiat conversion unless explicitly supported and approved.

**Evidence:** Testnet transaction IDs, callback/retry tests, reconciliation report, secret scan.

## Gate E — Safety, privacy and regional readiness

- Define local operator responsibility, support coverage and incident escalation.
- Confirm transport licensing, insurance, consumer protection, tax and data-protection obligations for the pilot jurisdiction.
- Publish clear cancellation, fare, privacy and complaint policies.
- Minimize precise-location collection and retention; protect identity documents.
- Complete accessibility testing against WCAG 2.2 AA for critical journeys.

**Evidence:** legal/operations sign-off, privacy impact review, accessibility report, incident exercise.

## Gate F — Reliability and release operations

- Deploy isolated development, Testnet/staging and production environments.
- Configure structured logs, metrics, alerting and payment/dispatch exception monitoring.
- Verify encrypted backups with a restore drill.
- Test API, web, database and realtime failure modes.
- Run end-to-end passenger and driver journeys on supported Pi Browser devices.
- Define rollback, incident response, support ownership and release approvers.

**Evidence:** deployment record, E2E report, restore report, monitoring/alert test, rollback rehearsal.

## Go / no-go rule

Production remains **NO-GO** while any critical gate above is incomplete or unsupported by evidence. Start with one legally cleared pilot city, a verified driver cohort, controlled Testnet/staging validation and explicit operational sign-off. Mainnet launch requires a separate approval decision; a green frontend build alone is not a production certification.

## Selected pilot market — Lahore, Pakistan

- [x] First pilot market selected: Lahore, Punjab, Pakistan (PK-PB-LHE).
- [x] Market baseline recorded: Asia/Karachi, PKR local reference currency, and car/bike/rickshaw categories.
- [ ] Approve Lahore service boundary and provision a validated GeoJSON MultiPolygon; do not activate a zone before sign-off.
- [ ] Complete Pakistan/Punjab/Lahore legal, transport, insurance, tax, consumer-protection and privacy review.
- [ ] Approve local fare policy and pricing test vectors; no fare values are active.
- [ ] Appoint local operations/support owner and verify driver cohort.
- [ ] Complete routing, Pi Testnet payment, accessibility, security and operational acceptance.

See [Lahore pilot market profile](pilot-market-lahore.md) and config/pilot-market.json. Market selection does not authorize launch; booking, dispatch, fare quotes and payments remain disabled pending their release gates.

## FairBid and marketplace operations

- [x] Define two-sided passenger/captain fare negotiation with a route-based reference fare, expiring offers, immutable negotiation history and fare lock.
- [x] Specify booking-scoped chat and masked-call architecture; participant numbers must not be disclosed to each other by default.
- [x] Specify active-trip location sharing, privacy controls, SOS and incident response.
- [ ] Complete pricing-policy calibration using verified Lahore vehicle operating costs and legal review.
- [ ] Implement and test negotiation APIs, driver offer fan-out, one-winner acceptance and dispatch state machine.
- [ ] Implement provider-backed realtime messaging and masked calling after Pakistan coverage/compliance verification.
- [ ] Implement live tracking, short-lived trip sharing links, retention jobs and incident console.
- [ ] Obtain written TNC/DPPT and payment-mode clearance before live trips.

See `docs/fairbid-negotiation-communications-safety.md` and migration 010. Schema foundations do not mean these services are operational.

## Fare negotiation, messaging and safety API status — 24 November 2026

- [x] Implement server-side Google Routes quote endpoint for car and two-wheeler requests, fail-closed for rickshaw until routing coverage is certified.
- [x] Require both endpoints to be inside an active Lahore service-zone polygon; use an active, approved fare-policy version only.
- [x] Implement passenger PKR bid, assigned-captain counteroffer, both-sided acceptance and immutable fare lock APIs.
- [x] Implement booking participant chat persistence and read APIs.
- [x] Implement driver GPS ingestion and passenger live-location read API; only active assigned trips are eligible.
- [x] Implement SOS/safety incident reporting and incident audit foundation.
- [x] Add dispatch-offer, dispatch-event and safety-event database schema foundations (migration 011).
- [ ] Implement dispatch engine and captain assignment; no booking can be automatically matched yet.
- [ ] Add incident operator console and realtime push/messaging delivery.
- [ ] Complete provider, retention, privacy and security acceptance.

API presence does not mean the Lahore marketplace is operational. Routing is disabled without a server key, quote creation requires an approved active boundary and fare policy, captain actions require an existing assignment, and trip tracking requires an active trip. Production remains NO-GO.
