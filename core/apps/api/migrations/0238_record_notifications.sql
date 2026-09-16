CREATE TABLE record_notification_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL CHECK (jsonb_typeof(preferences) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The first observed competition snapshot establishes a quiet baseline, including empty future rounds.
CREATE TABLE record_notification_snapshots (
  comp_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE record_notification_events (
  event_key VARCHAR(64) PRIMARY KEY,
  comp_id TEXT NOT NULL REFERENCES record_notification_snapshots(comp_id) ON DELETE CASCADE,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_record_notification_pending ON record_notification_events(comp_id) WHERE NOT delivered;
