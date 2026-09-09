-- WeChat renewal contracts retain provider identity and verified lifecycle evidence.
CREATE TABLE membership_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wca_id TEXT NOT NULL CHECK (btrim(wca_id) <> ''),
  plan_slug TEXT NOT NULL CHECK (plan_slug IN ('monthly_auto_renew', 'yearly_auto_renew')),
  appid TEXT NOT NULL CHECK (btrim(appid) <> ''),
  mch_id TEXT NOT NULL CHECK (btrim(mch_id) <> ''),
  plan_id TEXT NOT NULL CHECK (btrim(plan_id) <> ''),
  contract_code TEXT NOT NULL CHECK (btrim(contract_code) <> ''),
  contract_id TEXT CHECK (contract_id IS NULL OR btrim(contract_id) <> ''),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
  period TEXT NOT NULL CHECK (period IN ('month', 'year')),
  period_count INTEGER NOT NULL CHECK (period_count > 0),
  terms_version TEXT NOT NULL CHECK (btrim(terms_version) <> ''),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'terminated')),
  cancellation_requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  last_sync_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mch_id, appid, plan_id, contract_code),
  UNIQUE (mch_id, contract_id),
  CHECK ((plan_slug = 'monthly_auto_renew' AND period = 'month')
      OR (plan_slug = 'yearly_auto_renew' AND period = 'year'))
);
CREATE INDEX idx_membership_contracts_owner ON membership_contracts(wca_id);
CREATE INDEX idx_membership_contracts_sync ON membership_contracts(last_sync_attempt_at, id)
  WHERE state IN ('pending', 'active');
CREATE TRIGGER membership_contracts_updated_at BEFORE UPDATE ON membership_contracts
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Share the first account lock with account deletion. After a concurrent deletion
-- commits, the waiting SELECT cannot find an owner and the contract write fails.
CREATE FUNCTION trg_membership_contract_owner() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.state = 'terminated' AND NEW.state <> 'terminated' THEN
      RAISE EXCEPTION 'terminated membership contract cannot reactivate' USING ERRCODE = '23514';
    END IF;
    IF OLD.cancellation_requested_at IS NOT NULL AND NEW.cancellation_requested_at IS NULL THEN
      RAISE EXCEPTION 'membership cancellation request cannot be cleared' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.state <> 'terminated' THEN
    PERFORM id FROM app_users
      WHERE (wca_id = NEW.wca_id OR 'u' || id::text = NEW.wca_id)
        AND merged_into_user_id IS NULL
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'membership contract requires an active account' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER membership_contracts_owner BEFORE INSERT OR UPDATE ON membership_contracts
  FOR EACH ROW EXECUTE FUNCTION trg_membership_contract_owner();

CREATE FUNCTION trg_membership_contract_account_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM membership_contracts
    WHERE (wca_id = OLD.wca_id OR wca_id = 'u' || OLD.id::text)
      AND state IN ('pending', 'active')
  ) THEN
    RAISE EXCEPTION 'cancel automatic renewal before deleting account' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER membership_contracts_account_delete BEFORE DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION trg_membership_contract_account_delete();

-- Binding/unbinding WCA changes the business owner key, not the contract owner.
CREATE FUNCTION trg_membership_contract_owner_key() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE membership_contracts
    SET wca_id = COALESCE(NEW.wca_id, 'u' || NEW.id::text)
    WHERE wca_id = COALESCE(OLD.wca_id, 'u' || OLD.id::text);
  RETURN NEW;
END;
$$;
CREATE TRIGGER membership_contracts_owner_key AFTER UPDATE OF wca_id ON app_users
  FOR EACH ROW WHEN (OLD.wca_id IS DISTINCT FROM NEW.wca_id)
  EXECUTE FUNCTION trg_membership_contract_owner_key();
