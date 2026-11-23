-- On the Way: auditable driver application submissions and revisions.
BEGIN;
CREATE TABLE IF NOT EXISTS driver_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_account_id UUID NOT NULL REFERENCES driver_profiles(account_id) ON DELETE RESTRICT,
  actor_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('application_submitted','application_updated')),
  from_verification_status TEXT CHECK (from_verification_status IS NULL OR from_verification_status IN ('pending','under_review','verified','rejected','suspended')),
  to_verification_status TEXT NOT NULL CHECK (to_verification_status IN ('pending','under_review','verified','rejected','suspended')),
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_application_events_driver_created_idx ON driver_application_events(driver_account_id, created_at ASC);
CREATE INDEX IF NOT EXISTS driver_application_events_actor_created_idx ON driver_application_events(actor_account_id, created_at DESC);
COMMENT ON TABLE driver_application_events IS 'Append-only audit history for driver application submissions and revisions; do not update or delete events in application code.';
COMMIT;
