-- Server-backed timer replay shares. The token is the only public locator;
-- ownership is retained so account deletion removes the saved replay.
CREATE TABLE IF NOT EXISTS timer_replay_shares (
  id         VARCHAR(16) PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  solve      TEXT NOT NULL,
  byte_size  INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS timer_replay_shares_user_created_idx
  ON timer_replay_shares (user_id, created_at DESC);
