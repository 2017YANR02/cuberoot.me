-- Private chat attachments. Never grant access to assistant_public or public media routes.
CREATE TABLE site_assistant_attachments (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image/png','image/jpeg','image/webp')),
  sha256 TEXT NOT NULL CHECK (length(sha256)=64),
  data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 786432),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX site_assistant_attachments_content ON site_assistant_attachments(user_id,conversation_id,sha256) WHERE deleted_at IS NULL;
CREATE INDEX site_assistant_attachments_owner ON site_assistant_attachments(user_id,created_at DESC);
