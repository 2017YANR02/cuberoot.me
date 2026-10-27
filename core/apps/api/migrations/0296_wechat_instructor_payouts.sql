-- Provider attempts remain distinct from instructor ledger ownership and reservations.
CREATE TABLE platform_wechat_payout_transfers (
  payout_id UUID PRIMARY KEY REFERENCES platform_instructor_payouts(id) ON DELETE RESTRICT,
  out_bill_no VARCHAR(32) NOT NULL UNIQUE CHECK (out_bill_no ~ '^[A-Za-z0-9]{6,32}$'),
  state VARCHAR(32) NOT NULL CHECK (state IN ('PREPARED','ACCEPTED','PROCESSING','WAIT_USER_CONFIRM','TRANSFERING','SUCCESS','FAIL','CANCELING','CANCELLED')),
  transfer_bill_no VARCHAR(64),
  package_info TEXT,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE FUNCTION trg_guard_platform_wechat_payout() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payout_id <> OLD.payout_id OR NEW.out_bill_no <> OLD.out_bill_no
    OR (OLD.transfer_bill_no IS NOT NULL AND NEW.transfer_bill_no IS DISTINCT FROM OLD.transfer_bill_no)
    OR (OLD.state IN ('SUCCESS','FAIL','CANCELLED') AND NEW.state <> OLD.state) THEN
    RAISE EXCEPTION 'WeChat transfer identity and final result are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_wechat_payout_guard BEFORE UPDATE ON platform_wechat_payout_transfers
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_wechat_payout();

-- The existing account-deletion scrub must not erase a recipient while an
-- external transfer can still settle. Payout-row locking serializes dispatch
-- with that scrub; completed historical payouts keep their existing policy.
CREATE FUNCTION trg_preserve_unresolved_wechat_recipient() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payout_profile_snapshot_encrypted IS NULL
    AND OLD.payout_profile_snapshot_encrypted IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM platform_wechat_payout_transfers
      WHERE payout_id = OLD.id AND state NOT IN ('SUCCESS','FAIL','CANCELLED')
    ) THEN
    RAISE EXCEPTION 'Resolve the original WeChat payout before clearing its recipient';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_wechat_payout_recipient_guard
  BEFORE UPDATE OF payout_profile_snapshot_encrypted ON platform_instructor_payouts
  FOR EACH ROW EXECUTE FUNCTION trg_preserve_unresolved_wechat_recipient();
