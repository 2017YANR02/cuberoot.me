-- Six-digit account-link codes omit the account id. Limit guesses on the pending login ticket.
ALTER TABLE auth_identity_pending
  ADD COLUMN attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5);
