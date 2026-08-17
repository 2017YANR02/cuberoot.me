-- Bind the legacy teaching platform's verified phone accounts to canonical app users.
-- Assertions are short-lived and each nonce can be consumed only once.
CREATE TABLE teaching_platform_identities (
  platform_subject VARCHAR(128) PRIMARY KEY,
  user_id          BIGINT       NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (length(trim(platform_subject)) > 0)
);
CREATE INDEX idx_teaching_platform_identities_user
  ON teaching_platform_identities(user_id);

CREATE TABLE teaching_platform_assertion_nonces (
  nonce_hash    CHAR(64)    PRIMARY KEY,
  actor_user_id BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  CHECK (expires_at > created_at)
);
CREATE INDEX idx_teaching_platform_assertion_nonces_expiry
  ON teaching_platform_assertion_nonces(expires_at);

-- Account deletion anonymizes only actor_user_id through its ON DELETE SET NULL FK.
-- Every other UPDATE and every DELETE remains forbidden.
CREATE OR REPLACE FUNCTION trg_reject_teaching_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.actor_user_id IS NOT NULL
     AND NEW.actor_user_id IS NULL
     AND (to_jsonb(NEW) - 'actor_user_id') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'actor_user_id') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'teaching audit events are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
