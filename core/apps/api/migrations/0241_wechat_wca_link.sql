ALTER TABLE auth_web_session_tickets
  DROP CONSTRAINT chk_auth_web_session_ticket_purpose,
  ADD CONSTRAINT chk_auth_web_session_ticket_purpose CHECK (
    (purpose = 'web' AND user_id IS NOT NULL AND code_challenge IS NULL)
    OR
    (purpose = 'mobile' AND user_id IS NOT NULL AND code_challenge ~ '^[A-Za-z0-9_-]{43}$')
    OR
    (purpose = 'wechat_browser' AND code_challenge ~ '^[A-Za-z0-9_-]{43}$')
    OR
    (purpose = 'wechat_wca_link' AND user_id IS NOT NULL AND code_challenge IS NULL)
  );
