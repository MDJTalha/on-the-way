# Database setup

The initial schema targets PostgreSQL with PostGIS. It defines accounts, driver verification, vehicles, service zones, bookings and Pi payment event records.

## Apply

1. Create a dedicated development database.
2. Ensure PostgreSQL and PostGIS are installed and supported by the selected host.
3. Back up any existing database before applying migrations.
4. Apply migrations in numeric order using a migration role with extension privileges:
   - `001_initial_mobility_schema.sql`
   - `002_multi_role_and_driver_application.sql`
   - `003_booking_idempotency.sql`
   - `004_booking_event_history.sql`
   - `005_driver_application_event_history.sql`
   - `006_operator_driver_review.sql`
   - `007_driver_availability_gate.sql`
   - `008_vehicle_onboarding_review.sql`
   - `009_service_zone_administration.sql`
5. Configure DATABASE_URL in the local environment; never commit credentials.
6. Verify /api/health reports status: ok.

Migration 003 adds a passenger-scoped idempotency key and canonical request hash. Booking clients must send a fresh `Idempotency-Key` for each intentional request and reuse that same key only when retrying the same request after a timeout or uncertain network result. Reusing a key with a different payload returns HTTP 409. The database unique index is the concurrency boundary; do not rely on client-side duplicate prevention.

Payment events must be populated only from independently verified server-side Pi Platform API responses. Never trust client-supplied payment status or amount.

Migration 004 adds a booking lifecycle event history. Booking creation and passenger cancellation write their event in the same database transaction as the booking state change, so an event cannot be committed without its corresponding mutation. Treat `booking_events` as append-only in application code; never accept client-supplied event types or statuses.

Migration 005 adds append-only driver application history. New submissions and revisions write an audit event in the same transaction as the profile update. A previously verified driver who changes their operating city or preferred vehicle category is returned to pending verification and forced offline; a suspended profile remains suspended. No client route can grant verification or activate availability.

Migration 006 extends the append-only event vocabulary for operator review decisions and indexes the review queue. `GET /api/operators/drivers` requires a signed-in account with an explicit `operator` or `platform_admin` role in `account_roles`. `PATCH` records review decisions transactionally; verification requires a secure external case reference, rejected/suspended decisions require a reason, and every decision keeps the driver offline. Only a verified decision grants the driver role. The route does not collect identity documents or treat a case reference as proof by itself; verification additionally requires explicit server-validated attestations for identity, driving eligibility, local permits and safety coverage. The attestations and case reference are stored in the append-only review event; the authorized operator remains accountable for checking the external verification record before approval.

Migration 007 adds the driver's ISO country code, the availability-change audit event and eligibility lookup indexes. `GET/PATCH /api/drivers/availability` requires the approved driver role. A driver may go online only when the application is verified, a matching vehicle record is verified and the operating city plus country code match an active service zone. Going offline remains available; a busy driver cannot switch offline. Every change is audited in the same transaction. No availability is enabled merely by approval.

Migration 008 adds idempotent vehicle submissions, a pending/under-review/verified/rejected/suspended vehicle lifecycle, and append-only `vehicle_events`. `GET/POST /api/drivers/vehicles` is scoped to the signed-in driver's application. `POST` requires an idempotency key and records only non-sensitive vehicle metadata; it does not collect plate numbers or document images. `GET/PATCH /api/operators/vehicles` requires operator authorization. Vehicle approval requires an external evidence case reference plus explicit server-validated attestations for registration/ownership, insurance, inspection and physical vehicle identity; these are recorded in the append-only vehicle event and do not activate the driver. Revoking the last verified vehicle for an available driver safely returns that driver offline in the same transaction; revocation is blocked while the driver is busy.

Migration 009 adds service-zone administration. Listing is available to operator and platform-admin roles; creating, activating and deactivating global market zones is restricted to platform administrators. New zones require a valid PostGIS MultiPolygon boundary and are created inactive. Activation requires an external market-readiness reference, uses a locked row and is recorded in append-only `service_zone_events`; deactivation is also audited. Zone activation is only an eligibility configuration and does not start dispatch or passenger booking.
\nOperator audit history is exposed through `GET /api/operators/audit` to authenticated operator and platform-administrator roles only. It provides bounded pagination and filters across driver, vehicle, service-zone and booking events. The API projects a minimal field set and allowlists only evidence-check booleans; it intentionally excludes free-text reasons, external case references and raw JSON metadata. The endpoint is read-only and does not mutate or delete append-only event records.\n