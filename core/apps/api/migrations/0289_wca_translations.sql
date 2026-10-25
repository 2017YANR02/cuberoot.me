-- Read-only upstream translation mirror; no user data or locally edited translations.
CREATE TABLE wca_translation_sync (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  synced_at TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ,
  error TEXT,
  digest TEXT,
  components JSONB NOT NULL DEFAULT '[]'
);
INSERT INTO wca_translation_sync (id) VALUES (1);

CREATE TABLE wca_translation_units (
  component TEXT NOT NULL,
  unit_id BIGINT NOT NULL,
  key TEXT NOT NULL,
  en TEXT NOT NULL,
  zh TEXT NOT NULL,
  source_forms JSONB NOT NULL,
  target_forms JSONB NOT NULL,
  state INTEGER NOT NULL,
  usable BOOLEAN NOT NULL,
  approved BOOLEAN NOT NULL,
  source_url TEXT NOT NULL,
  source_updated_at TEXT,
  checks BOOLEAN NOT NULL,
  PRIMARY KEY (component, unit_id)
);
CREATE INDEX wca_translation_key ON wca_translation_units (lower(key));
