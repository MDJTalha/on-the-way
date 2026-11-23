-- On the Way: auditable, eligibility-gated driver availability.
BEGIN;
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS service_country_code CHAR(2);
ALTER TABLE driver_profiles
  DROP CONSTRAINT IF EXISTS driver_profiles_service_country_code_check;
ALTER TABLE driver_profiles
  ADD CONSTRAINT driver_profiles_service_country_code_check
  CHECK (service_country_code IS NULL OR service_country_code ~ '^[A-Z]{2}$');

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
    'driver_suspended',
    'availability_changed'
  ));
CREATE INDEX IF NOT EXISTS vehicles_verified_driver_type_idx
  ON vehicles(driver_account_id, vehicle_type)
  WHERE verification_status = 'verified';
DROP INDEX IF EXISTS service_zones_active_city_idx;
CREATE INDEX service_zones_active_city_idx
  ON service_zones(country_code, lower(city_name))
  WHERE active = true;
COMMIT;
