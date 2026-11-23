-- On the Way: auditable operator decisions for driver verification.
BEGIN;

ALTER TABLE driver_application_events
  DROP CONSTRAINT IF EXISTS driver_application_events_event_type_check;

ALTER TABLE driver_application_events
  ADD CONSTRAINT driver_application_events_event_type_check
  CHECK (event_type IN (
    'application_submitted',
    'application_updated',
    'review_started',
    'application_verified',
    'application_rejected',
    'driver_suspended'
  ));

CREATE INDEX IF NOT EXISTS driver_profiles_review_queue_idx
  ON driver_profiles(verification_status, application_submitted_at ASC);

COMMENT ON COLUMN driver_profiles.verified_at IS
  'Set only by an authorized operator decision after external verification evidence is recorded.';

COMMIT;
