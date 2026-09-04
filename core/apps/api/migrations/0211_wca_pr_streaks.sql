-- 全体选手的最长连续个人纪录参赛场数；每周由 WCA stats extra 管道全量重灌。
CREATE TABLE IF NOT EXISTS wca_pr_streaks (
  wca_id         VARCHAR(20) PRIMARY KEY,
  country_id     VARCHAR(50) NOT NULL,
  continent_id   VARCHAR(50) NOT NULL,
  streak         INTEGER NOT NULL,
  start_comp_id  VARCHAR(50),
  end_comp_id    VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS pr_streak_world
  ON wca_pr_streaks (streak DESC, wca_id);
CREATE INDEX IF NOT EXISTS pr_streak_continent
  ON wca_pr_streaks (continent_id, streak DESC, wca_id);
CREATE INDEX IF NOT EXISTS pr_streak_country
  ON wca_pr_streaks (country_id, streak DESC, wca_id);
