CREATE TABLE drive_members (
  user_id            BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER drive_members_updated_at BEFORE UPDATE ON drive_members
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE drive_nodes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  parent_id      UUID REFERENCES drive_nodes(id) ON DELETE CASCADE,
  kind           VARCHAR(8) NOT NULL CHECK (kind IN ('file', 'folder')),
  name           VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(255),
  size_bytes     BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  storage_key    TEXT UNIQUE,
  status         VARCHAR(12) NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'ready')),
  trashed_at     TIMESTAMPTZ,
  trash_root_id  UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (name = BTRIM(name) AND name <> '' AND name !~ '[\\/[:cntrl:]]'),
  CHECK (
    (kind = 'folder' AND mime_type IS NULL AND size_bytes = 0 AND storage_key IS NULL AND status = 'ready')
    OR
    (kind = 'file' AND (
      (status = 'uploading' AND storage_key IS NULL AND size_bytes = 0)
      OR (status = 'ready' AND storage_key IS NOT NULL)
    ))
  ),
  CHECK ((trashed_at IS NULL AND trash_root_id IS NULL) OR (trashed_at IS NOT NULL AND trash_root_id IS NOT NULL))
);
CREATE INDEX idx_drive_nodes_owner_parent
  ON drive_nodes(owner_user_id, parent_id, updated_at DESC, id)
  WHERE trashed_at IS NULL;
CREATE INDEX idx_drive_nodes_trash_roots
  ON drive_nodes(owner_user_id, trashed_at DESC, id)
  WHERE trashed_at IS NOT NULL AND trash_root_id = id;
CREATE UNIQUE INDEX uq_drive_nodes_root_name
  ON drive_nodes(owner_user_id, LOWER(name))
  WHERE parent_id IS NULL AND trashed_at IS NULL;
CREATE UNIQUE INDEX uq_drive_nodes_child_name
  ON drive_nodes(owner_user_id, parent_id, LOWER(name))
  WHERE parent_id IS NOT NULL AND trashed_at IS NULL;
CREATE TRIGGER drive_nodes_updated_at BEFORE UPDATE ON drive_nodes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE drive_uploads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id              UUID NOT NULL UNIQUE REFERENCES drive_nodes(id) ON DELETE CASCADE,
  owner_user_id        BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expected_bytes       BIGINT NOT NULL CHECK (expected_bytes > 0 AND expected_bytes <= 21474836480),
  received_bytes       BIGINT NOT NULL DEFAULT 0 CHECK (received_bytes >= 0 AND received_bytes <= expected_bytes),
  chunk_bytes          INTEGER NOT NULL DEFAULT 8388608 CHECK (chunk_bytes BETWEEN 1048576 AND 16777216),
  client_last_modified BIGINT,
  expires_at           TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_drive_uploads_owner_expiry
  ON drive_uploads(owner_user_id, expires_at, updated_at DESC);
CREATE TRIGGER drive_uploads_updated_at BEFORE UPDATE ON drive_uploads
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
