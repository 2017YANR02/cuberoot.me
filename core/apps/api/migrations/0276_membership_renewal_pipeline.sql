-- Existing contract ownership / account deletion guards remain authoritative.
CREATE SEQUENCE membership_enrollment_serial;
ALTER TABLE membership_contracts
  ADD COLUMN enrollment_serial BIGINT UNIQUE,
  ADD COLUMN consented_at TIMESTAMPTZ,
  ADD COLUMN next_debit_at TIMESTAMPTZ,
  ADD COLUMN debit_cycle INTEGER NOT NULL DEFAULT 0 CHECK (debit_cycle >= 0);
CREATE TABLE membership_renewal_debits (
  out_trade_no VARCHAR(32) PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES membership_contracts(id),
  cycle INTEGER NOT NULL CHECK (cycle >= 0),
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'submitted', 'paid', 'failed', 'cancelled')),
  submitted_at TIMESTAMPTZ,
  last_query_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id, cycle)
);
CREATE INDEX idx_membership_renewal_debits_pending ON membership_renewal_debits(last_query_at)
  WHERE status = 'submitted';
