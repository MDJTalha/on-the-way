# Architecture — On the Way

## 1. Architecture decision

Start with a modular monolith. Keep bounded domains separated in code and database schemas, but deploy a single backend until operational scale justifies service extraction.

## 2. System context

- Pi Browser: customer, driver and operator web experiences.
- Next.js: responsive PWA frontend and server-side routes where appropriate.
- FastAPI: authoritative business API.
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
