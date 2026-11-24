-- On the Way: auditable service-zone administration.
BEGIN;

ALTER TABLE service_zones
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES accounts(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS service_zone_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_zone_id UUID NOT NULL REFERENCES service_zones(id) ON DELETE RESTRICT,
  actor_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('zone_created','zone_activated','zone_deactivated')),
  previous_state JSONB CHECK (previous_state IS NULL OR jsonb_typeof(previous_state) = 'object'),
  new_state JSONB NOT NULL CHECK (jsonb_typeof(new_state) = 'object'),
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_zone_events_zone_created_idx
  ON service_zone_events(service_zone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_zone_events_actor_created_idx
  ON service_zone_events(actor_account_id, created_at DESC);

COMMENT ON TABLE service_zone_events IS
  'Append-only audit history for operator service-zone configuration and activation.';

COMMIT;
