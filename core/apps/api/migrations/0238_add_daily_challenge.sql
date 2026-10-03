CREATE TABLE daily_challenges (
  id             SERIAL PRIMARY KEY,
  challenge_date DATE NOT NULL UNIQUE,
  event          VARCHAR(20) NOT NULL DEFAULT '333',
  scramble       TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_records (
  id           SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES daily_challenges(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  time_ms      INTEGER NOT NULL,
  solution     TEXT, -- 存储还原步骤，用于防作弊校验
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id) -- 每人每天只能提交一次
);

CREATE INDEX idx_daily_records_leaderboard
  ON daily_records (challenge_id, time_ms ASC);
