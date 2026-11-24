-- On the Way: negotiated fares, secure booking communications and safety telemetry foundations.
-- No active fare policy is seeded by this migration; no booking/payment capability is enabled.
BEGIN;
CREATE TABLE IF NOT EXISTS fare_policies (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), country_code CHAR(2) NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'), city_slug TEXT NOT NULL CHECK(city_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), vehicle_type vehicle_type NOT NULL, version INTEGER NOT NULL CHECK(version>0), currency_code CHAR(3) NOT NULL CHECK(currency_code='PKR'),
 base_fare NUMERIC(12,2) NOT NULL CHECK(base_fare>=0), per_km_rate NUMERIC(12,4) NOT NULL CHECK(per_km_rate>=0), per_minute_rate NUMERIC(12,4) NOT NULL CHECK(per_minute_rate>=0), pickup_per_km_rate NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK(pickup_per_km_rate>=0), minimum_fare NUMERIC(12,2) NOT NULL CHECK(minimum_fare>=0), captain_cost_floor NUMERIC(12,2) NOT NULL CHECK(captain_cost_floor>=0), passenger_bid_floor NUMERIC(12,2) NOT NULL CHECK(passenger_bid_floor>=0), negotiation_ceiling NUMERIC(12,2) NOT NULL CHECK(negotiation_ceiling>=0), demand_multiplier_min NUMERIC(6,4) NOT NULL DEFAULT 1 CHECK(demand_multiplier_min>0), demand_multiplier_max NUMERIC(6,4) NOT NULL DEFAULT 1 CHECK(demand_multiplier_max>=demand_multiplier_min), rounding_increment NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK(rounding_increment>0), negotiation_window_seconds INTEGER NOT NULL DEFAULT 90 CHECK(negotiation_window_seconds BETWEEN 15 AND 900), max_negotiation_rounds INTEGER NOT NULL DEFAULT 5 CHECK(max_negotiation_rounds BETWEEN 1 AND 20), effective_from TIMESTAMPTZ NOT NULL, effective_until TIMESTAMPTZ, approval_reference TEXT, approved_by UUID REFERENCES accounts(id) ON DELETE RESTRICT, approved_at TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(negotiation_ceiling>=GREATEST(minimum_fare,captain_cost_floor,passenger_bid_floor)), CHECK(effective_until IS NULL OR effective_until>effective_from), CHECK(active=false OR (approval_reference IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS fare_policies_market_vehicle_version_uidx ON fare_policies(country_code,city_slug,vehicle_type,version);
CREATE UNIQUE INDEX IF NOT EXISTS fare_policies_one_active_market_vehicle_uidx ON fare_policies(country_code,city_slug,vehicle_type) WHERE active=true;

CREATE TABLE IF NOT EXISTS fare_quotes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT, fare_policy_id UUID NOT NULL REFERENCES fare_policies(id) ON DELETE RESTRICT, route_provider TEXT NOT NULL CHECK(length(route_provider) BETWEEN 2 AND 80), route_reference TEXT, route_distance_m INTEGER NOT NULL CHECK(route_distance_m>0), route_duration_s INTEGER NOT NULL CHECK(route_duration_s>0), pickup_approach_distance_m INTEGER NOT NULL DEFAULT 0 CHECK(pickup_approach_distance_m>=0), estimated_toll_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(estimated_toll_amount>=0), base_component NUMERIC(12,2) NOT NULL CHECK(base_component>=0), distance_component NUMERIC(12,2) NOT NULL CHECK(distance_component>=0), time_component NUMERIC(12,2) NOT NULL CHECK(time_component>=0), pickup_component NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(pickup_component>=0), demand_multiplier NUMERIC(6,4) NOT NULL CHECK(demand_multiplier>0), recommended_amount NUMERIC(12,2) NOT NULL CHECK(recommended_amount>0), minimum_acceptable_amount NUMERIC(12,2) NOT NULL CHECK(minimum_acceptable_amount>0), suggested_maximum_amount NUMERIC(12,2) NOT NULL CHECK(suggested_maximum_amount>=recommended_amount), currency_code CHAR(3) NOT NULL DEFAULT 'PKR' CHECK(currency_code='PKR'), status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted','expired','superseded','cancelled')), expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(minimum_acceptable_amount<=recommended_amount), CHECK(expires_at>created_at)
);
ALTER TABLE fare_quotes ADD CONSTRAINT fare_quotes_id_booking_uidx UNIQUE(id,booking_id);
CREATE INDEX IF NOT EXISTS fare_quotes_booking_created_idx ON fare_quotes(booking_id,created_at DESC);
CREATE INDEX IF NOT EXISTS fare_quotes_expiry_idx ON fare_quotes(expires_at) WHERE status='open';

CREATE TABLE IF NOT EXISTS booking_fare_offers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT, fare_quote_id UUID NOT NULL REFERENCES fare_quotes(id) ON DELETE RESTRICT, proposer_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, proposer_role TEXT NOT NULL CHECK(proposer_role IN ('passenger','driver')), response_to_offer_id UUID REFERENCES booking_fare_offers(id) ON DELETE RESTRICT, amount NUMERIC(12,2) NOT NULL CHECK(amount>0), currency_code CHAR(3) NOT NULL DEFAULT 'PKR' CHECK(currency_code='PKR'), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn','expired','superseded')), idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128), expires_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(proposer_account_id,idempotency_key), CHECK((status='accepted' AND accepted_at IS NOT NULL) OR (status<>'accepted' AND accepted_at IS NULL))
);
ALTER TABLE booking_fare_offers ADD CONSTRAINT booking_fare_offers_id_booking_uidx UNIQUE(id,booking_id);
ALTER TABLE booking_fare_offers ADD CONSTRAINT booking_fare_offers_quote_booking_fk FOREIGN KEY(fare_quote_id,booking_id) REFERENCES fare_quotes(id,booking_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS booking_fare_offers_one_accepted_uidx ON booking_fare_offers(booking_id) WHERE status='accepted';
CREATE UNIQUE INDEX IF NOT EXISTS booking_fare_offers_one_pending_per_actor_uidx ON booking_fare_offers(booking_id,proposer_account_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS booking_fare_offers_booking_created_idx ON booking_fare_offers(booking_id,created_at DESC);
CREATE INDEX IF NOT EXISTS booking_fare_offers_expiry_idx ON booking_fare_offers(expires_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS booking_negotiation_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT, offer_id UUID REFERENCES booking_fare_offers(id) ON DELETE RESTRICT, actor_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT, event_type TEXT NOT NULL CHECK(event_type IN ('quote_created','passenger_offer_created','captain_counteroffer_created','offer_accepted','offer_rejected','offer_withdrawn','offer_expired','offer_superseded','fare_locked')), event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(event_metadata)='object'), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_negotiation_events_booking_created_idx ON booking_negotiation_events(booking_id,created_at ASC);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accepted_fare_offer_id UUID, ADD COLUMN IF NOT EXISTS accepted_fare_amount NUMERIC(12,2), ADD COLUMN IF NOT EXISTS accepted_fare_currency CHAR(3), ADD COLUMN IF NOT EXISTS fare_locked_at TIMESTAMPTZ;
ALTER TABLE bookings ADD CONSTRAINT bookings_accepted_fare_offer_booking_fk FOREIGN KEY(accepted_fare_offer_id,id) REFERENCES booking_fare_offers(id,booking_id) ON DELETE RESTRICT;
ALTER TABLE bookings ADD CONSTRAINT bookings_accepted_fare_consistency_check CHECK ((accepted_fare_offer_id IS NULL AND accepted_fare_amount IS NULL AND accepted_fare_currency IS NULL AND fare_locked_at IS NULL) OR (accepted_fare_offer_id IS NOT NULL AND accepted_fare_amount IS NOT NULL AND accepted_fare_amount>0 AND accepted_fare_currency='PKR' AND fare_locked_at IS NOT NULL));

CREATE TABLE IF NOT EXISTS booking_conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','read_only','closed')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), closed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS booking_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES booking_conversations(id) ON DELETE RESTRICT, sender_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text','system','location_share','safety_notice')), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000), client_message_id TEXT NOT NULL CHECK(length(client_message_id) BETWEEN 8 AND 128), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ, UNIQUE(sender_account_id,client_message_id)
);
CREATE INDEX IF NOT EXISTS booking_messages_conversation_created_idx ON booking_messages(conversation_id,created_at DESC);
CREATE TABLE IF NOT EXISTS booking_call_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT, caller_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, callee_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, provider TEXT NOT NULL CHECK(length(provider) BETWEEN 2 AND 80), provider_session_reference TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('requested','ringing','connected','completed','failed','expired')), expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(caller_account_id<>callee_account_id)
);
CREATE INDEX IF NOT EXISTS booking_call_sessions_booking_created_idx ON booking_call_sessions(booking_id,created_at DESC);

CREATE TABLE IF NOT EXISTS trip_location_updates (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT, driver_account_id UUID NOT NULL REFERENCES driver_profiles(account_id) ON DELETE RESTRICT, location GEOGRAPHY(POINT,4326) NOT NULL, accuracy_m NUMERIC(8,2) NOT NULL CHECK(accuracy_m>=0), heading_degrees NUMERIC(6,2) CHECK(heading_degrees>=0 AND heading_degrees<360), speed_mps NUMERIC(8,2) CHECK(speed_mps>=0), recorded_at TIMESTAMPTZ NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(recorded_at<=received_at+INTERVAL '2 minutes')
);
CREATE INDEX IF NOT EXISTS trip_location_updates_booking_recorded_idx ON trip_location_updates(booking_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS trip_location_updates_received_idx ON trip_location_updates(received_at);
CREATE TABLE IF NOT EXISTS trip_safety_incidents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT, reported_by UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, incident_type TEXT NOT NULL CHECK(incident_type IN ('sos','route_deviation','harassment','accident','medical','vehicle_issue','other')), severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')), status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','investigating','resolved','referred')), location GEOGRAPHY(POINT,4326), description TEXT CHECK(description IS NULL OR length(description)<=2000), emergency_service_contacted_at TIMESTAMPTZ, acknowledged_by UUID REFERENCES accounts(id) ON DELETE RESTRICT, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_safety_incidents_status_created_idx ON trip_safety_incidents(status,created_at DESC);
CREATE INDEX IF NOT EXISTS trip_safety_incidents_booking_created_idx ON trip_safety_incidents(booking_id,created_at DESC);
COMMENT ON TABLE fare_policies IS 'Versioned pricing rules; activation requires explicit approval and no default rates are seeded.';
COMMENT ON TABLE fare_quotes IS 'Server-generated route and fare estimates tied to a policy version and expiry.';
COMMENT ON TABLE booking_fare_offers IS 'Passenger bids and captain counteroffers retained as negotiation records.';
COMMENT ON TABLE booking_negotiation_events IS 'Append-only audit trail for fare quote and negotiation decisions.';
COMMENT ON TABLE booking_messages IS 'Booking-scoped messages; never store phone numbers, OTPs, payment credentials or identity documents.';
COMMENT ON TABLE booking_call_sessions IS 'Short-lived masked-call provider references; do not store participant phone numbers.';
COMMENT ON TABLE trip_location_updates IS 'Purpose-limited driver telemetry for active-trip monitoring; apply approved retention and access policies.';
COMMENT ON TABLE trip_safety_incidents IS 'Auditable SOS and trip-safety incident workflow.';
COMMIT;
