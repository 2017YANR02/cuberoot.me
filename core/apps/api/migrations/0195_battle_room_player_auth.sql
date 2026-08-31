-- A room code is a public invitation, not a player credential. Store only a
-- SHA-256 digest of the per-player capability returned once by create/join.
-- Existing 24-hour rooms receive an empty map and are intentionally rejected
-- by the route until they expire; minting a token from a public pid would keep
-- the impersonation vulnerability alive.
ALTER TABLE battle_rooms
  ADD COLUMN IF NOT EXISTS player_auth JSONB NOT NULL DEFAULT '{}'::jsonb;
