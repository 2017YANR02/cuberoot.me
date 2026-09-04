CREATE TABLE music_static_overrides (
  track_id   CHAR(64) PRIMARY KEY CHECK (track_id ~ '^[0-9a-f]{64}$'),
  title      VARCHAR(300) CHECK (title IS NULL OR (title = BTRIM(title) AND title <> '')),
  artist     VARCHAR(300),
  album      VARCHAR(300),
  genre      VARCHAR(100),
  hidden     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER music_static_overrides_updated_at BEFORE UPDATE ON music_static_overrides
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
