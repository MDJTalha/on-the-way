# Pilot and Production Release Gates

This document separates a working interface preview from a safe, operable mobility service. A gate is PASS only when its evidence is recorded against the deployed build and environment. A planned feature or successful frontend interaction is not evidence of backend completion.

## Current baseline

- [x] Next.js / React / TypeScript application foundation.
- [x] Responsive passenger, driver and operator preview routes.
- [x] Passenger API and isolated PostgreSQL/PostGIS development database.
- [x] Pi SDK integration, server token verification and signed passenger session foundation; real Pioneer acceptance pending.
- [x] Driver application persistence with pending/offline status; identity and vehicle verification pending.
- [ ] Real geocoding, routing and map display.
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
