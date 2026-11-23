-- On the Way: append-only booking lifecycle event history.
BEGIN;

CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  actor_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('booking_requested','booking_cancelled')),
  from_status booking_status,
  to_status booking_status NOT NULL,
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_events_booking_created_idx
  ON booking_events(booking_id, created_at ASC);
CREATE INDEX IF NOT EXISTS booking_events_actor_created_idx
  ON booking_events(actor_account_id, created_at DESC);

COMMENT ON TABLE booking_events IS
  'Append-only record of booking lifecycle actions; do not update or delete events in application code.';

COMMIT;
