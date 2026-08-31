-- Once synchronized countdown starts, freeze its participant set. Reconnecting or newly joined
-- players cannot be auto-started without readiness or block completion of a round they never joined.
ALTER TABLE battle_rooms
  ADD COLUMN IF NOT EXISTS round_roster JSONB NOT NULL DEFAULT '[]'::jsonb;
