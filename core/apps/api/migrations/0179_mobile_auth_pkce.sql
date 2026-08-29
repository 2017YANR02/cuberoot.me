-- Extend the existing short-lived ticket table for website -> native App login.
-- Mobile tickets are bound to a PKCE S256 challenge; the verifier never enters
-- the browser URL or database.
ALTER TABLE auth_web_session_tickets
  ADD COLUMN purpose VARCHAR(16) NOT NULL DEFAULT 'web',
  ADD COLUMN code_challenge CHAR(43),
  ADD CONSTRAINT chk_auth_web_session_ticket_purpose
    CHECK (
      (purpose = 'web' AND code_challenge IS NULL)
      OR
      (purpose = 'mobile' AND code_challenge ~ '^[A-Za-z0-9_-]{43}$')
    );
