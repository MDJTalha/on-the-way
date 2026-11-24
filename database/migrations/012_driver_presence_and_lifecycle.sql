-- On the Way: privacy-scoped online driver presence and lifecycle audit expansion.
BEGIN;

CREATE TABLE IF NOT EXISTS driver_presence_updates (
  driver_account_id UUID PRIMARY KEY REFERENCES driver_profiles(account_id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT,4326) NOT NULL,
  accuracy_m NUMERIC(8,2) NOT NULL CHECK (accuracy_m >= 0 AND accuracy_m <= 100),
  heading_degrees NUMERIC(6,2) CHECK (heading_degrees >= 0 AND heading_degrees < 360),
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (recorded_at <= received_at + INTERVAL '30 seconds'),
  CHECK (recorded_at >= received_at - INTERVAL '3 minutes'),
  CHECK (expires_at > received_at AND expires_at <= received_at + INTERVAL '5 minutes')
);
CREATE INDEX IF NOT EXISTS driver_presence_location_gist_idx
  ON driver_presence_updates USING GIST(location);
CREATE INDEX IF NOT EXISTS driver_presence_expiry_idx
  ON driver_presence_updates(expires_at);

ALTER TABLE booking_events DROP CONSTRAINT IF EXISTS booking_events_event_type_check;
ALTER TABLE booking_events ADD CONSTRAINT booking_events_event_type_check
  CHECK (event_type IN (
    'booking_requested','booking_cancelled','dispatch_started','driver_assigned',
    'fare_locked','trip_started','trip_completed','trip_disputed','no_captain_available'
  ));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS dispatch_round INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_round >= 0),
  ADD COLUMN IF NOT EXISTS dispatch_started_at TIMESTAMPTZ;

COMMENT ON TABLE driver_presence_updates IS 'Short-lived location for online, available captains only. Expire/purge promptly; never use as an active-trip tracking substitute.';
COMMENT ON COLUMN bookings.dispatch_round IS 'Current staged dispatch ring; incremented transactionally when a matching round expires.';

COMMIT;
