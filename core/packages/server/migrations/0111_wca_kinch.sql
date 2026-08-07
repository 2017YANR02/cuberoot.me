-- Kinch 综合排名。每日 WCA stats extra 管道全量重灌分数；API 只读分页。
CREATE TABLE IF NOT EXISTS wca_kinch (
  wca_id                VARCHAR(20) PRIMARY KEY,
  country_id            VARCHAR(50) NOT NULL,
  continent_id          VARCHAR(50) NOT NULL,
  world_score_x100      SMALLINT NOT NULL,
  continent_score_x100  SMALLINT NOT NULL,
  country_score_x100    SMALLINT NOT NULL
);

CREATE INDEX IF NOT EXISTS kinch_world_score
  ON wca_kinch (world_score_x100 DESC, wca_id);
CREATE INDEX IF NOT EXISTS kinch_continent_score
  ON wca_kinch (continent_id, continent_score_x100 DESC, wca_id);
CREATE INDEX IF NOT EXISTS kinch_country_score
  ON wca_kinch (country_id, country_score_x100 DESC, wca_id);
