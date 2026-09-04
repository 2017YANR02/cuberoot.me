-- Let an iPhone browser request a short-lived WeChat Mini Program approval.
-- The browser ticket and Mini Program approval token are stored only as hashes.
ALTER TABLE auth_web_session_tickets
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT chk_auth_web_session_ticket_purpose,
  ADD CONSTRAINT chk_auth_web_session_ticket_purpose CHECK (
    (purpose = 'web' AND user_id IS NOT NULL AND code_challenge IS NULL)
    OR
    (purpose = 'mobile' AND user_id IS NOT NULL AND code_challenge ~ '^[A-Za-z0-9_-]{43}$')
    OR
    (purpose = 'wechat_browser' AND code_challenge ~ '^[A-Za-z0-9_-]{43}$')
  );

CREATE UNIQUE INDEX idx_auth_web_session_tickets_wechat_approval
  ON auth_web_session_tickets(code_challenge)
  WHERE purpose = 'wechat_browser';
