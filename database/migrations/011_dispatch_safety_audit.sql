-- On the Way: dispatch invitation state and auditable safety incident transitions.
BEGIN;

ALTER TABLE booking_fare_offers
  ADD CONSTRAINT booking_fare_offers_response_booking_fk
  FOREIGN KEY (response_to_offer_id, booking_id)
  REFERENCES booking_fare_offers(id, booking_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS dispatch_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  driver_account_id UUID NOT NULL REFERENCES driver_profiles(account_id) ON DELETE RESTRICT,
  fare_quote_id UUID NOT NULL,
  dispatch_round INTEGER NOT NULL CHECK (dispatch_round > 0),
  pickup_distance_m INTEGER NOT NULL CHECK (pickup_distance_m >= 0),
  pickup_duration_s INTEGER NOT NULL CHECK (pickup_duration_s > 0),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined','expired','withdrawn','superseded')),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, driver_account_id, dispatch_round),
  FOREIGN KEY (fare_quote_id, booking_id) REFERENCES fare_quotes(id, booking_id) ON DELETE RESTRICT,
  CHECK ((status IN ('accepted','declined') AND responded_at IS NOT NULL) OR (status NOT IN ('accepted','declined') AND responded_at IS NULL))
);
CREATE INDEX IF NOT EXISTS dispatch_offers_driver_status_expiry_idx
  ON dispatch_offers(driver_account_id, status, expires_at);
CREATE INDEX IF NOT EXISTS dispatch_offers_booking_status_created_idx
  ON dispatch_offers(booking_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_offers_one_accepted_per_booking_uidx
  ON dispatch_offers(booking_id) WHERE status='accepted';
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_offers_one_live_invite_per_driver_uidx
  ON dispatch_offers(booking_id, driver_account_id) WHERE status='invited';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_trip_per_driver_uidx
  ON bookings(driver_account_id)
  WHERE driver_account_id IS NOT NULL AND status IN ('driver_assigned','driver_arriving','in_progress');

CREATE TABLE IF NOT EXISTS dispatch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  dispatch_offer_id UUID REFERENCES dispatch_offers(id) ON DELETE RESTRICT,
  actor_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('dispatch_started','captain_invited','captain_accepted','captain_declined','invite_expired','captain_assigned','dispatch_round_advanced','no_captain_available')),
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispatch_events_booking_created_idx
  ON dispatch_events(booking_id, created_at ASC);

CREATE TABLE IF NOT EXISTS trip_safety_incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES trip_safety_incidents(id) ON DELETE RESTRICT,
  actor_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('incident_reported','incident_acknowledged','investigation_started','incident_resolved','incident_referred','emergency_services_contacted')),
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('open','acknowledged','investigating','resolved','referred')),
  next_status TEXT CHECK (next_status IS NULL OR next_status IN ('open','acknowledged','investigating','resolved','referred')),
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_safety_incident_events_incident_created_idx
  ON trip_safety_incident_events(incident_id, created_at ASC);

COMMENT ON TABLE dispatch_offers IS 'Expiring, auditable captain invitations. A dispatch offer is not an accepted fare until a participant accepts and the booking fare is atomically locked.';
COMMENT ON TABLE dispatch_events IS 'Append-only dispatch and matching event history.';
COMMENT ON TABLE trip_safety_incident_events IS 'Append-only operator response and safety incident transition history.';

COMMIT;
