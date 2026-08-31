-- HTTP polling responses can arrive out of order even when PostgreSQL writes are serialized.
-- A monotonic room revision lets every client reject a delayed stale snapshot.
ALTER TABLE battle_rooms
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
