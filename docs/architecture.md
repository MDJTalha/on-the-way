# Architecture — On the Way

## 1. Architecture decision

Start with a modular monolith. Keep bounded domains separated in code and database schemas, but deploy a single backend until operational scale justifies service extraction.

## 2. System context

- Pi Browser: customer, driver and operator web experiences.
- Next.js: responsive PWA frontend and server-side routes where appropriate.
- Next.js Node.js route handlers: initial authoritative application API; extract services only when operational evidence justifies it.
- PostgreSQL + PostGIS: transactional and geospatial persistence.
- Redis: ephemeral driver presence, dispatch coordination and cache.
- WebSockets: trip and dispatch updates.
- Pi Platform: identity and payment lifecycle.
- Maps provider: geocoding, map tiles, routes and ETA.
- Object storage: private driver documents with signed access.
- Observability: structured logs, metrics, traces and alerting.

## 3. Backend bounded contexts

- Identity & Access: Pi identity mapping, local profile, sessions, roles.
- Geography: countries, regions, cities, service zones, time zones.
- Driver Operations: driver profile, documents, verification, availability.
- Fleet & Vehicles: vehicle type, capacity, registration, ownership.
- Booking: requests, scheduled bookings, cancellations.
- Pricing: fare rules, quotes, offer bounds, quote expiry.
- Dispatch: candidate selection, request fan-out, assignment locks.
- Trips: pickup, start, progress, completion, incident states.
- Payments: Pi payment approval, completion, verification, reconciliation.
- Ledger: immutable financial events, commissions and provider earnings.
- Trust & Support: ratings, complaints, disputes, safety reports.
- Administration: policy configuration, audit events and access control.

## 4. Core data entities

User, UserRole, DriverProfile, DriverDocument, Vehicle, VehicleType, Fleet, Country, City, ServiceZone, DriverPresence, RideRequest, FareQuote, FareOffer, Booking, DriverAssignment, Trip, TripEvent, Payment, PaymentEvent, LedgerEntry, Rating, SupportCase, AuditLog.

All business records should have stable IDs, timestamps and explicit status. Country/city context and currency must be stored where applicable. Use PostGIS geography for proximity queries.

## 5. Booking state machine

Requested → Matching → OffersReceived → DriverAssigned → DriverArriving → PickupConfirmed → InProgress → Completed → PaymentSettled → Closed.

Controlled branches include Expired, Cancelled, NoDriverAvailable, PaymentPending, PaymentFailed, Disputed and Refunded (only after a supported refund process).

Transitions are validated by backend commands with authorization, idempotency and audit records. Never accept arbitrary client-supplied state changes.

## 6. Dispatch

1. Query drivers who are verified, online, eligible for the vehicle category and inside the service zone.
2. Rank by configured distance/ETA and fairness rules.
3. Send request to a bounded candidate set.
4. Use an atomic assignment lock to prevent double acceptance.
5. Expire stale offers and record each decision.
6. Fall back to a wider radius or no-driver response.

Do not expose exact driver locations to unrelated users.

## 7. Pi integration boundary

The browser uses the official Pi SDK for authentication and payment UI. The backend verifies authentication with the Pi Platform API and owns payment approval/completion. Store server credentials in secret management only. Do not expose secrets in NEXT_PUBLIC variables or client bundles.

The integration must be isolated behind PiAuthProvider and PiPaymentProvider interfaces so Testnet/Mainnet configuration and future API changes are controlled.

## 8. Security

- TLS for all external communication.
- Role and resource-level authorization.
- Rate limiting and abuse controls.
- Input validation and output encoding.
- CSRF/session protections appropriate to deployment.
- Idempotency keys for payment and booking mutations.
- Immutable audit and payment event records.
- Secrets management and rotation.
- Encrypted private document storage.
- Dependency and container scanning.
- Backups with restore verification.

## 9. Reliability and observability

Use structured correlation IDs across booking, trip and payment workflows. Monitor API latency, dispatch latency, WebSocket connectivity, payment states, error rates and queue depth. Alert on stuck payment approvals, unreconciled transactions and repeated dispatch failures.

## 10. Environment strategy

- Local development: mocked external integrations, no real payment.
- Pi Testnet: official test application and test transactions.
- Staging: production-like infrastructure and isolated data.
- Mainnet: separately configured credentials, controlled rollout and explicit release approval.

No Testnet data or credentials may be used in Mainnet.

## Current server foundation (development only)

The Next.js application now includes Node.js route handlers:

- GET /api/health checks whether DATABASE_URL is configured and whether PostgreSQL responds to SELECT 1.
- POST /api/bookings validates pickup, destination, vehicle category and optional note, requires a signed passenger session backed by a Pi-verified account, and persists a requested booking. It does not calculate fares or dispatch drivers.
- GET /api/bookings remains unavailable without an authenticated passenger session.
- POST /api/bookings/[id]/cancel locks a passenger-owned booking and permits cancellation only while its status is `requested` or `matching`; retries of an already-cancelled request return the persisted state. Assigned or progressed trips are not cancellable through this endpoint.
- Migration 004 adds append-only booking event history. Booking creation and passenger cancellation persist their lifecycle event in the same transaction as the booking mutation.

PostgreSQL access is centralized in lib/db.ts using a bounded connection pool. The initial PostGIS schema is in database/migrations/001_initial_mobility_schema.sql.

This is a local development backend, not a production booking marketplace. Production use remains blocked on real Pi Browser acceptance, rate limiting, fare calculation, geocoding, driver verification, dispatch, payment processing, monitoring and full end-to-end testing. The health endpoint intentionally returns HTTP 503 when the database is not configured or unavailable.
## Pi authentication implementation

The passenger application loads the official Pi SDK from https://sdk.minepi.com/pi-sdk.js and initializes version 2.0 using NEXT_PUBLIC_PI_SANDBOX. The current sign-in requests only the username scope.

The browser sends only the Pi access token to POST /api/auth/pi. The server validates it against GET https://api.minepi.com/v2/me using the Bearer token, then persists the verified Pi UID and username. Client-provided UID or username values are never used as identity proof.

After successful verification, the application issues a 12-hour HMAC-SHA256 signed, HttpOnly, SameSite=Lax session cookie. SESSION_SECRET must be a high-entropy secret of at least 32 characters and must be different per environment. The session lookup route rechecks the account and passenger role in PostgreSQL. Logout clears the cookie.

Current limitations:
- Real Pi Browser/Sandbox sign-in has not yet been accepted with a registered On the Way app.
- Payment scope is intentionally not requested yet.
- Payment approval/completion, server API key handling and payment reconciliation are not implemented.
- Rate limiting, session revocation and operational monitoring remain required before production.
- Set NEXT_PUBLIC_PI_SANDBOX=false only after the production app is registered and configured in the Pi Developer Portal.


## Driver application workflow

The driver portal checks the signed passenger session and can submit a consented driver application through POST /api/drivers/apply. The server stores the requested operating city, ISO 3166-1 alpha-2 country code, preferred vehicle category, consent version and timestamps. New applications remain verification_status=pending and availability_status=offline. GET /api/drivers/me returns only the signed-in account's application. No identity documents are collected, no driver is approved automatically and no dispatch availability is created.

Migration 005 adds append-only driver application events written atomically with each submission or revision. Changes to the operating city or vehicle category invalidate a prior verified state and force the profile offline pending a new verification review. A suspended state cannot be cleared by this self-service route.

Migration 002 adds account_roles for multi-role account membership and driver application metadata. It has been applied to the isolated local On the Way database.

## Booking retry integrity

POST /api/bookings requires an Idempotency-Key header. The server hashes a canonical representation of the validated booking payload and stores it with the booking. A retry with the same passenger, key and payload returns the original booking instead of creating another ride request. Reusing the same key with a different payload returns HTTP 409. A PostgreSQL unique index enforces this under concurrent requests. The key is not a booking confirmation, fare quote, driver assignment or payment authorization; the booking remains in the requested state.


## Operator driver-review workflow

`GET /api/operators/drivers` and `PATCH /api/operators/drivers` are protected by a signed Pi-authenticated session plus a database-backed `operator` or `platform_admin` membership in `account_roles`. A passenger session alone receives HTTP 403; missing/invalid sessions receive HTTP 401. The business screen consumes this API and displays the pending review queue only after authorization.

The review mutation locks the driver profile row and commits the profile transition, driver-role membership change and append-only `driver_application_events` record in one transaction. Supported decisions are start review, verify, reject and suspend. Verification requires an external verification-case reference; rejection and suspension require an operator reason. The case reference is an audit pointer, not proof. The API also requires explicit server-validated attestations for identity, driving eligibility, local permits and safety coverage. These attestations are recorded in the append-only event; the operator must inspect actual evidence in a separately controlled process. Every decision leaves availability offline. A verified decision grants the driver role; rejection/suspension revoke it. No availability activation, dispatch or identity-document storage is implemented by this workflow.

Migration 006 extends the driver application event constraint and adds a review-queue index. Operator role provisioning remains a platform-owner task; no public self-service endpoint can grant operator or platform-admin access. Authenticated operator acceptance and end-to-end decision testing are pending.


## Driver availability gate

`GET/PATCH /api/drivers/availability` requires the signed Pi session and an explicit driver role granted only by operator verification. A driver may switch to available only if the application is verified, a vehicle matching the selected category has a verified vehicle record, and the operating city and country match an active service zone. The endpoint returns explicit blockers rather than implying eligibility. Offline is permitted; a busy driver cannot self-disable while a trip is active. Availability transitions lock the driver profile and write an append-only event in the same transaction. Migration 007 adds the event type and supporting eligibility indexes. The current project has not yet implemented secure vehicle-document onboarding or activated a pilot service zone, so online activation is expected to remain blocked until those dependencies are completed.


## Vehicle onboarding and verification

Driver vehicle records are submitted through `POST /api/drivers/vehicles` after a driver application exists. The endpoint accepts only vehicle category, make, model, model year and registration country; it does not collect registration plate numbers, identity documents or document images. A passenger-scoped HMAC session is required, and each submission uses a driver-scoped idempotency key plus a canonical payload hash. A changed payload with a reused key returns HTTP 409.

New vehicles remain pending. Operators review them through `GET/PATCH /api/operators/vehicles`, protected by the same explicit operator/platform-admin authorization as driver review. Approval requires an external verification case reference and records an append-only `vehicle_events` entry. The reference is an audit pointer only. The API also requires explicit server-validated attestations for registration/ownership, insurance, inspection and physical vehicle identity, recorded in the append-only event. Evidence inspection remains a separate controlled process. Vehicle approval never activates availability. If the last verified vehicle matching an available driver's selected category is rejected or suspended, the operator transaction returns the driver offline and records the corresponding driver availability event. Vehicle revocation is blocked while the driver is busy.

Migration 008 adds the vehicle lifecycle, idempotency fields/index and append-only vehicle event table. Secure document storage and actual KYC/evidence-provider integration remain release dependencies.

## Service-zone administration

`GET /api/operators/service-zones` is protected by a signed Pi session and an explicit operator/platform-admin role. Global market mutations through `POST/PATCH` are restricted to `platform_admin`; ordinary operators have read-only access. New zones require ISO country/currency codes and a valid PostGIS MultiPolygon boundary and are always created inactive. Activation requires an external market-readiness reference and a valid mapped boundary, and every create/activate/deactivate mutation is committed with an append-only `service_zone_events` record. Deactivation does not delete the zone or its history. A configured active zone is only an eligibility prerequisite; it does not enable dispatch, fares, booking acceptance or payments. Migration 009 adds the zone audit history and update metadata.
