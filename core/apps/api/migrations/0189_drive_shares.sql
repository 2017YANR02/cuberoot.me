CREATE TABLE drive_shares (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id    UUID NOT NULL UNIQUE REFERENCES drive_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
