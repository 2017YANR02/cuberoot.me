CREATE TABLE platform_competition_settlement_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number BIGSERIAL UNIQUE NOT NULL,
  event_id UUID NOT NULL REFERENCES platform_competitions(event_id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payout','recovery','adjustment')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency='CNY'),
  provider_reference_hash TEXT UNIQUE,
  transferred_at TIMESTAMPTZ,
  statement_snapshot JSONB NOT NULL,
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  actor_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((entry_type='adjustment' AND amount_minor=0 AND transferred_at IS NULL AND provider_reference_hash IS NULL)
    OR (entry_type IN ('payout','recovery') AND amount_minor>0 AND transferred_at IS NOT NULL AND provider_reference_hash IS NOT NULL))
);
CREATE INDEX idx_competition_settlement_event ON platform_competition_settlement_ledger(event_id,entry_number);
