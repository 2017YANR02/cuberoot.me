-- A shared allocator for short-lived quick-meeting and permanent scheduled codes.
CREATE TABLE video_meet_codes (
  code VARCHAR(4) PRIMARY KEY CHECK (code ~ '^[0-9]{4}$'),
  expires_at BIGINT
);
CREATE TABLE video_meetings (
  id UUID PRIMARY KEY,
  owner_key VARCHAR(100) NOT NULL,
  code VARCHAR(4) NOT NULL UNIQUE REFERENCES video_meet_codes(code),
  title VARCHAR(120) NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT NOT NULL CHECK (end_ms > start_ms AND end_ms - start_ms <= 86400000),
  tz VARCHAR(100) NOT NULL,
  rrule VARCHAR(500) NOT NULL DEFAULT '',
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
);
CREATE INDEX video_meetings_owner ON video_meetings(owner_key, start_ms);
