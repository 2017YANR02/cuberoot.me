-- One identity per personal competition event; NULL remembers an explicitly deleted event.
CREATE TABLE IF NOT EXISTS calendar_competitions (
  owner_key VARCHAR(20) NOT NULL,
  competition_id VARCHAR(64) NOT NULL,
  event_id BIGINT UNIQUE REFERENCES calendar_events(id) ON DELETE SET NULL,
  PRIMARY KEY (owner_key, competition_id)
);
