# Implementation Roadmap

## Milestone 0 - Repository and product foundation
- [x] Create private GitHub repository.
- [x] Initialize Next.js + TypeScript.
- [x] Create responsive customer booking preview.
- [x] Document product scope and architecture.
- [x] Install dependencies and verify production build.
- [x] Add GitHub Actions CI workflow (branch protection still requires repository settings).
- [ ] Confirm brand and domain availability.

## Milestone 1 - Pi Browser integration
- [ ] Register Testnet application in Pi Developer Portal.
- [ ] Configure approved app URL and SDK.
- [ ] Implement Pi authentication and backend token verification.
- [ ] Add environment-safe Testnet configuration.
- [ ] Test Pi Browser compatibility.

## Milestone 2 - Backend foundation
- [ ] FastAPI project and modular domain layout.
- [ ] PostgreSQL/PostGIS schema and migrations.
- [ ] User/profile/role model.
- [ ] Driver and vehicle registration.
- [ ] Country/city/service-zone configuration.
- [ ] Audit and structured logging.

## Milestone 3 - Booking and pricing
- [ ] Ride request API and validation.
- [ ] Fare quote engine.
- [ ] Passenger offer/counteroffer workflow.
- [ ] Booking state machine.
- [ ] Cancellation and expiry rules.

## Milestone 4 - Driver dispatch and trip
- [ ] Driver availability/presence.
- [ ] Geospatial candidate search.
- [ ] Atomic assignment and race-condition tests.
- [ ] WebSocket updates.
- [ ] Trip events and completion.

## Milestone 5 - Pi Testnet payments
- [ ] Official Pi payment integration.
- [ ] Server-side approval and completion.
- [ ] Idempotent callbacks and retries.
- [ ] Payment/booking reconciliation.
- [ ] Failed and abandoned payment recovery.

## Milestone 6 - Safety, administration and QA
- [ ] Driver document review workflow.
- [ ] Support, incident and dispute workflows.
- [ ] Admin roles and audit trail.
- [ ] Security and privacy review.
- [ ] End-to-end and failure-path tests.
- [ ] Accessibility and responsive QA.

## Milestone 7 - Controlled pilot
- [ ] Select one launch city.
- [ ] Confirm legal, insurance and operational requirements.
- [ ] Recruit and verify pilot drivers.
- [ ] Configure service area and pricing.
- [ ] Run closed pilot.
- [ ] Review actual marketplace performance.
- [ ] Production go/no-go approval.

## Release gates

A production release is blocked until authentication, authorization, driver verification, booking state integrity, payment verification/reconciliation, safety operations, privacy, backup/restore, monitoring and regional compliance have passed.
