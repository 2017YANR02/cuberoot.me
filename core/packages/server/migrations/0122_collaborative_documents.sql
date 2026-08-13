-- General-purpose real-time collaborative documents.
-- Body content is stored as a Yjs update so concurrent edits merge without last-write-wins loss.

CREATE TABLE collaborative_documents (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(240) NOT NULL,
  owner_key    VARCHAR(20)  NOT NULL,
  ydoc_state   BYTEA        NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collaborative_documents_owner_updated
  ON collaborative_documents(owner_key, updated_at DESC);

CREATE TABLE collaborative_document_members (
  document_id  UUID        NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  user_key     VARCHAR(20) NOT NULL,
  role         VARCHAR(8)  NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  added_by     VARCHAR(20) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, user_key)
);

CREATE INDEX idx_collaborative_document_members_user
  ON collaborative_document_members(user_key, document_id);

CREATE UNIQUE INDEX uq_collaborative_document_owner
  ON collaborative_document_members(document_id)
  WHERE role = 'owner';

CREATE TRIGGER collaborative_documents_updated_at BEFORE UPDATE ON collaborative_documents
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
