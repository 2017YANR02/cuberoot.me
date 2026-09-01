CREATE TABLE vault_user_keys (
  user_id               BIGINT      PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  public_key            JSONB       NOT NULL,
  encrypted_private_key JSONB       NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(public_key) = 'object'),
  CHECK (jsonb_typeof(encrypted_private_key) = 'object')
);

CREATE TRIGGER vault_user_keys_updated_at
  BEFORE UPDATE ON vault_user_keys
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE vault_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  ciphertext    TEXT        NOT NULL,
  iv            VARCHAR(32) NOT NULL,
  byte_size     INTEGER     NOT NULL CHECK (byte_size > 0 AND byte_size <= 2097152),
  version       BIGINT      NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_items_owner_updated
  ON vault_items(owner_user_id, updated_at DESC);

CREATE TRIGGER vault_items_updated_at
  BEFORE UPDATE ON vault_items
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE vault_item_access (
  item_id           UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
  recipient_user_id BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  wrapped_key       TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, recipient_user_id)
);

CREATE INDEX idx_vault_item_access_recipient
  ON vault_item_access(recipient_user_id, created_at DESC);
