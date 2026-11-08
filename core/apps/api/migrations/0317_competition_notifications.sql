CREATE TABLE competition_notification_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL CHECK (jsonb_typeof(preferences) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Independent of Bark's dry-run/absorbed history. Inbox insertion uses its own recipient dedupe key.
CREATE TABLE competition_announcement_events (
  comp_id VARCHAR(64) PRIMARY KEY,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  announced_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_competition_announcement_pending ON competition_announcement_events(announced_at) WHERE processed_at IS NULL;

-- One fresh source check per competition, shared by all subscribers; oldest checks run first.
CREATE TABLE competition_registration_checks (
  comp_id VARCHAR(64) PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comp_follows_comp ON comp_follows(comp_id);
