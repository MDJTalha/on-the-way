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
5. Configure DATABASE_URL in the local environment; never commit credentials.
6. Verify /api/health reports status: ok.

Migration 003 adds a passenger-scoped idempotency key and canonical request hash. Booking clients must send a fresh `Idempotency-Key` for each intentional request and reuse that same key only when retrying the same request after a timeout or uncertain network result. Reusing a key with a different payload returns HTTP 409. The database unique index is the concurrency boundary; do not rely on client-side duplicate prevention.

Payment events must be populated only from independently verified server-side Pi Platform API responses. Never trust client-supplied payment status or amount.

Migration 004 adds a booking lifecycle event history. Booking creation and passenger cancellation write their event in the same database transaction as the booking state change, so an event cannot be committed without its corresponding mutation. Treat `booking_events` as append-only in application code; never accept client-supplied event types or statuses.

Migration 005 adds append-only driver application history. New submissions and revisions write an audit event in the same transaction as the profile update. A previously verified driver who changes their operating city or preferred vehicle category is returned to pending verification and forced offline; a suspended profile remains suspended. No client route can grant verification or activate availability.

Migration 006 extends the append-only event vocabulary for operator review decisions and indexes the review queue. `GET /api/operators/drivers` requires a signed-in account with an explicit `operator` or `platform_admin` role in `account_roles`. `PATCH` records review decisions transactionally; verification requires a secure external case reference, rejected/suspended decisions require a reason, and every decision keeps the driver offline. Only a verified decision grants the driver role. The route does not collect identity documents or treat a case reference as proof by itself; the authorized operator remains accountable for checking the external verification record before approval.

Migration 007 adds the driver's ISO country code, the availability-change audit event and eligibility lookup indexes. `GET/PATCH /api/drivers/availability` requires the approved driver role. A driver may go online only when the application is verified, a matching vehicle record is verified and the operating city plus country code match an active service zone. Going offline remains available; a busy driver cannot switch offline. Every change is audited in the same transaction. No availability is enabled merely by approval.
