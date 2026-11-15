-- Reserve the first checkout in the renewal ledger before contacting WeChat.
ALTER TABLE membership_contracts ADD COLUMN signing_method TEXT NOT NULL DEFAULT 'pure'
  CHECK (signing_method IN ('pure', 'payment'));
ALTER TABLE membership_renewal_debits
  ADD COLUMN trade_type TEXT NOT NULL DEFAULT 'PAP' CHECK (trade_type IN ('PAP', 'NATIVE', 'MWEB')),
  ADD COLUMN checkout_url TEXT,
  ADD COLUMN checkout_expires_at TIMESTAMPTZ,
  ADD CONSTRAINT membership_checkout_first_cycle CHECK (trade_type = 'PAP' OR cycle = 0);
