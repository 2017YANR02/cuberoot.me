CREATE TABLE site_assistant_requests (
  id UUID PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running','success','error','cancelled','rejected','interrupted')),
  error_code TEXT,
  lang TEXT NOT NULL CHECK (lang IN ('zh','en')),
  model TEXT NOT NULL,
  streaming BOOLEAN NOT NULL,
  image_count INTEGER NOT NULL DEFAULT 0,
  history_count INTEGER NOT NULL DEFAULT 0,
  question TEXT,
  answer TEXT,
  response JSONB,
  duration_ms INTEGER,
  first_answer_ms INTEGER,
  metrics JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX site_assistant_requests_started ON site_assistant_requests(started_at DESC, id DESC);
CREATE INDEX site_assistant_requests_user ON site_assistant_requests(user_id, started_at DESC);
CREATE TABLE site_assistant_monitor_state (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_cleanup_at TIMESTAMPTZ
);
INSERT INTO site_assistant_monitor_state (id) VALUES (TRUE);
-- No grant to assistant_public / the AI read-only role: these are private records.

ALTER TABLE site_assistant_requests
  ADD COLUMN conversation_id UUID,
  ADD COLUMN parent_id UUID,
  ADD COLUMN retry_of UUID,
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'chat' CHECK (scope IN ('chat','index')),
  ADD COLUMN feedback TEXT CHECK (feedback IN ('helpful','incorrect','irrelevant','bad_source','bad_link','other')),
  ADD COLUMN feedback_at TIMESTAMPTZ,
  ADD COLUMN clicked_actions JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'open' CHECK (review_status IN ('open','confirmed','resolved','dismissed')),
  ADD COLUMN review_note TEXT,
  ADD COLUMN reviewed_by TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ;
CREATE INDEX site_assistant_requests_conversation ON site_assistant_requests(user_id,conversation_id,started_at);
CREATE TABLE site_assistant_entry_daily (
  day DATE NOT NULL, code TEXT NOT NULL, requests BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(day,code)
);
CREATE TABLE site_assistant_daily (
  day DATE PRIMARY KEY, metrics JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE site_assistant_alerts (
  code TEXT PRIMARY KEY, active BOOLEAN NOT NULL, opened_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ(3),
  details JSONB NOT NULL DEFAULT '{}', notified_at TIMESTAMPTZ
);
CREATE TABLE site_assistant_audit (
  id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), actor TEXT NOT NULL,
  action TEXT NOT NULL, record_id UUID
);
CREATE INDEX site_assistant_audit_at ON site_assistant_audit(at DESC);
ALTER TABLE site_assistant_monitor_state ADD COLUMN failed_writes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN last_failure_at TIMESTAMPTZ, ADD COLUMN last_replay_at TIMESTAMPTZ;
CREATE TABLE site_assistant_recording_faults (
  id UUID PRIMARY KEY, failures BIGINT NOT NULL, last_at TIMESTAMPTZ NOT NULL
);
