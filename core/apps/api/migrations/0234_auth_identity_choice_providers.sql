-- All first-time login identities require the existing explicit create/link choice.
-- Existing tickets, their expiry and atomic consumption are unchanged.
ALTER TABLE auth_identity_pending DROP CONSTRAINT auth_identity_pending_provider_check;
ALTER TABLE auth_identity_pending ADD CONSTRAINT auth_identity_pending_provider_check
  CHECK (provider IN ('apple', 'google', 'wechat', 'qq', 'alipay', 'wca', 'email', 'phone', 'douyin'));
