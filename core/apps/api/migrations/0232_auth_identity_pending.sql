-- Unconfirmed OAuth attempts are not accounts. Only ticket digests are persisted.
CREATE TABLE auth_identity_pending (
  ticket_hash CHAR(64) PRIMARY KEY CHECK (ticket_hash ~ '^[a-f0-9]{64}$'),
  provider VARCHAR(16) NOT NULL CHECK (provider IN ('apple', 'google', 'wechat', 'qq', 'alipay', 'wca')),
  provider_uid TEXT NOT NULL CHECK (length(provider_uid) BETWEEN 1 AND 512),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(profile) = 'object'),
  apple_refresh_token_encrypted BYTEA,
  apple_token_key_version SMALLINT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_identity_pending_apple_credential CHECK (
    (provider = 'apple' AND apple_refresh_token_encrypted IS NOT NULL
      AND octet_length(apple_refresh_token_encrypted) > 28
      AND apple_token_key_version IS NOT NULL AND apple_token_key_version = 1)
    OR (provider <> 'apple' AND apple_refresh_token_encrypted IS NULL AND apple_token_key_version IS NULL)
  )
);
CREATE INDEX idx_auth_identity_pending_expiry ON auth_identity_pending(expires_at);

ALTER TABLE auth_web_session_tickets ADD COLUMN existing_only BOOLEAN NOT NULL DEFAULT FALSE;
