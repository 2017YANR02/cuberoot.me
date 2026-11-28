ALTER TABLE vault_user_keys
  ADD COLUMN item_order UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN item_order_version INTEGER NOT NULL DEFAULT 0;
