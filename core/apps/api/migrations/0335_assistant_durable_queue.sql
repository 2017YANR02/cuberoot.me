-- Private conversation inbox and fenced, recoverable execution. Account deletion cascades.
CREATE TABLE site_assistant_conversations (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  revision BIGINT NOT NULL DEFAULT 0,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  lease UUID,
  lease_until TIMESTAMPTZ,
  active_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_assistant_conversations_owner ON site_assistant_conversations(user_id,updated_at);
CREATE TABLE site_assistant_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES site_assistant_conversations(id) ON DELETE CASCADE,
  sequence BIGSERIAL UNIQUE,
  target_id UUID REFERENCES site_assistant_messages(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('queue','steer')),
  state TEXT NOT NULL CHECK(state IN ('queued','running','applied','completed','stopped','error')),
  payload JSONB NOT NULL,
  country TEXT,
  answer JSONB,
  progress JSONB NOT NULL DEFAULT '[]',
  checkpoints JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  request_id UUID,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(jsonb_typeof(payload)='object'),
  CHECK(jsonb_typeof(checkpoints)='object'),
  CHECK(jsonb_typeof(progress)='array'),
  CHECK(answer IS NULL OR jsonb_typeof(answer)='object'),
  CHECK(octet_length(payload::text)<=200000),
  CHECK(octet_length(checkpoints::text)<=500000),
  CHECK(octet_length(answer::text)<=500000)
);
CREATE INDEX idx_assistant_messages_conversation ON site_assistant_messages(conversation_id,sequence);
CREATE INDEX idx_assistant_messages_pending ON site_assistant_messages(conversation_id,sequence) WHERE state IN ('queued','running');
