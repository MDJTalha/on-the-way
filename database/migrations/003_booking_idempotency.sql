-- On the Way: booking request idempotency.
-- Prevents network retries from creating duplicate ride requests.
BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_passenger_idempotency_uidx
  ON bookings(passenger_account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
