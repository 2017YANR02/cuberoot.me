ALTER TABLE vault_items DROP CONSTRAINT vault_items_byte_size_check;
ALTER TABLE vault_items ADD CONSTRAINT vault_items_byte_size_check
  CHECK (byte_size > 0 AND byte_size <= 4194304);
