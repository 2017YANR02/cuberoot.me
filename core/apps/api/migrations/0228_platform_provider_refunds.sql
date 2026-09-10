ALTER TABLE platform_refunds
  ADD COLUMN merchant_request_id VARCHAR(64),
  ADD COLUMN provider_status VARCHAR(32),
  ADD COLUMN failure_code VARCHAR(100),
  ADD COLUMN rejection_reason VARCHAR(64),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN last_checked_at TIMESTAMPTZ,
  ADD COLUMN processing_until TIMESTAMPTZ;
CREATE UNIQUE INDEX uq_platform_refunds_merchant_request
  ON platform_refunds(provider, merchant_request_id) WHERE merchant_request_id IS NOT NULL;
CREATE INDEX idx_platform_refunds_provider_pending
  ON platform_refunds(last_checked_at) WHERE status = 'pending' AND merchant_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION trg_guard_platform_refund() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id <> OLD.order_id OR NEW.payment_attempt_id <> OLD.payment_attempt_id
     OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id OR NEW.amount_minor <> OLD.amount_minor
     OR NEW.currency <> OLD.currency OR NEW.provider <> OLD.provider OR NEW.reason_code <> OLD.reason_code
     OR NEW.merchant_request_id IS DISTINCT FROM OLD.merchant_request_id
     OR (OLD.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
    RAISE EXCEPTION 'platform refund target, amount, currency, reason, and approved request are immutable';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'requested' AND NEW.status IN ('pending', 'succeeded', 'failed', 'cancelled'))
    OR (OLD.status = 'pending' AND NEW.status IN ('succeeded', 'failed', 'cancelled'))
    OR (OLD.status = 'failed' AND OLD.approved_at IS NOT NULL AND OLD.merchant_request_id IS NOT NULL
      AND NEW.status IN ('pending', 'succeeded'))
  ) THEN
    RAISE EXCEPTION 'invalid platform refund status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
