-- On the Way: driver vehicle onboarding and auditable vehicle review.
BEGIN;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_verification_status_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_verification_status_check
  CHECK (verification_status IN ('pending','under_review','verified','rejected','suspended'));

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_key TEXT,
  ADD COLUMN IF NOT EXISTS request_hash TEXT;

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_submission_key_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_submission_key_check
  CHECK (
    (submission_key IS NULL AND request_hash IS NULL) OR
    (submission_key IS NOT NULL AND submission_key ~ '^[A-Za-z0-9._:-]{16,128}$' AND request_hash IS NOT NULL AND request_hash ~ '^[a-f0-9]{64}$')
  );

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_driver_submission_key_unique
  ON vehicles(driver_account_id, submission_key)
  WHERE submission_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS vehicle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_account_id UUID NOT NULL REFERENCES driver_profiles(account_id) ON DELETE RESTRICT,
  actor_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'vehicle_submitted',
    'vehicle_review_started',
    'vehicle_verified',
    'vehicle_rejected',
    'vehicle_suspended'
  )),
  from_verification_status TEXT CHECK (
    from_verification_status IS NULL OR
    from_verification_status IN ('pending','under_review','verified','rejected','suspended')
  ),
  to_verification_status TEXT NOT NULL CHECK (
    to_verification_status IN ('pending','under_review','verified','rejected','suspended')
  ),
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_events_vehicle_created_idx
  ON vehicle_events(vehicle_id, created_at ASC);
CREATE INDEX IF NOT EXISTS vehicle_events_driver_created_idx
  ON vehicle_events(driver_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vehicles_review_queue_idx
  ON vehicles(verification_status, created_at ASC);

COMMENT ON TABLE vehicle_events IS
  'Append-only audit history for driver vehicle submissions and operator review decisions; do not update or delete events in application code.';

COMMIT;
