-- Verification is separate from tenant ownership and operating status.
CREATE TABLE enterprise_verification_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  encrypted_details BYTEA NOT NULL,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE enterprise_verification_applications (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  applicant_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  legal_name VARCHAR(160) NOT NULL,
  credit_code CHAR(18) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'awaiting_transfer'
    CHECK (status IN ('awaiting_transfer','pending_review','verified','rejected','expired','revoked')),
  amount_minor SMALLINT NOT NULL CHECK (amount_minor BETWEEN 1 AND 99),
  transfer_reference VARCHAR(40) NOT NULL UNIQUE,
  encrypted_details BYTEA NOT NULL,
  bank_transaction_hash CHAR(64) UNIQUE,
  reviewed_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  review_note VARCHAR(1000),
  received_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_transaction_hash CHAR(64) UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key),
  CHECK (credit_code ~ '^[0-9A-HJ-NPQRTUWXY]{18}$'),
  CHECK (expires_at > created_at),
  CHECK (status <> 'verified' OR (bank_transaction_hash IS NOT NULL AND reviewed_at IS NOT NULL AND received_at IS NOT NULL)),
  CHECK (refunded_at IS NULL OR bank_transaction_hash IS NOT NULL)
);
CREATE UNIQUE INDEX enterprise_verification_one_active ON enterprise_verification_applications(organization_id)
  WHERE status IN ('awaiting_transfer','pending_review','verified');
CREATE UNIQUE INDEX enterprise_verification_verified_credit ON enterprise_verification_applications(credit_code)
  WHERE status = 'verified';
CREATE INDEX enterprise_verification_queue ON enterprise_verification_applications(created_at DESC);
CREATE TABLE enterprise_verification_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id UUID REFERENCES enterprise_verification_applications(id) ON DELETE RESTRICT,
  actor_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  action VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
