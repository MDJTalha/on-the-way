-- On the Way: multi-role accounts and driver application metadata.
BEGIN;

CREATE TABLE IF NOT EXISTS account_roles (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role account_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, role)
);

INSERT INTO account_roles (account_id, role)
SELECT id, role FROM accounts
ON CONFLICT (account_id, role) DO NOTHING;

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS preferred_vehicle_type vehicle_type,
  ADD COLUMN IF NOT EXISTS application_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS application_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version TEXT;

COMMIT;
