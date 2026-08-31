-- Self-hosted LiveKit cannot revoke an already issued participant token. Bind media access to
-- an opaque room generation instead; kick/leave rotates it so old tokens only reach an orphaned
-- media room while valid members reconnect to the new generation.
ALTER TABLE battle_rooms
  ADD COLUMN IF NOT EXISTS video_generation UUID NOT NULL DEFAULT gen_random_uuid();
