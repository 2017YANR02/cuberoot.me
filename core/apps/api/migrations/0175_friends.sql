CREATE TABLE user_friendships (
  user_low_id         BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  user_high_id        BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  requested_by_user_id BIGINT     NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status              VARCHAR(16) NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'accepted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id),
  CHECK (requested_by_user_id IN (user_low_id, user_high_id)),
  CHECK ((status = 'pending' AND responded_at IS NULL)
      OR (status = 'accepted' AND responded_at IS NOT NULL))
);
CREATE INDEX idx_user_friendships_low_status
  ON user_friendships(user_low_id, status, updated_at DESC);
CREATE INDEX idx_user_friendships_high_status
  ON user_friendships(user_high_id, status, updated_at DESC);
CREATE TRIGGER user_friendships_updated_at
  BEFORE UPDATE ON user_friendships
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE user_blocks (
  blocker_user_id BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  blocked_user_id BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);
CREATE INDEX idx_user_blocks_blocked
  ON user_blocks(blocked_user_id, created_at DESC);
