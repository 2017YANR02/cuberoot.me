-- Execution control is separate from redacted monitoring and browser chat history.
CREATE TABLE site_assistant_runs (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running','stopping','completed','cancelled','error','interrupted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 minutes',
  finished_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX site_assistant_runs_active ON site_assistant_runs(user_id,conversation_id) WHERE state IN ('running','stopping');
CREATE INDEX site_assistant_runs_created ON site_assistant_runs(created_at);
