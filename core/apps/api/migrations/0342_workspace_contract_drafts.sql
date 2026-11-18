-- Drafts remain in the workspace and are never exposed through document sharing.
CREATE TABLE workspace_contract_drafts (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workspace_contract_drafts_owner ON workspace_contract_drafts(user_id);
