-- 0018_historical_best_ranks.sql
-- 选手页"历史最佳排名"专表:每 (wca_id, event_id) 一行,精确到"按比赛结束"口径的生涯最佳名次。
-- 由 stats-build/historical_ranks_build.ts 逐场 Fenwick 重放算出,stats.yml 全量 TRUNCATE + \copy 重灌。
-- 取代原来"读月表 historical_ranks_monthly_snapshot 再 in-memory 取 min"的近似做法(月末口径会低估当场峰值)。
-- wca_id 打头主键 → /v1/wca/person-best-ranks 的 WHERE wca_id=? 走 PK,毫秒级。
CREATE TABLE IF NOT EXISTS historical_best_ranks (
  wca_id           VARCHAR(20) NOT NULL,
  event_id         VARCHAR(20) NOT NULL,
  s_world_rank     INTEGER, s_world_value     INTEGER, s_world_year     SMALLINT,
  s_cont_rank      INTEGER, s_cont_value      INTEGER, s_cont_year      SMALLINT,
  s_country_rank   INTEGER, s_country_value   INTEGER, s_country_year   SMALLINT,
  a_world_rank     INTEGER, a_world_value     INTEGER, a_world_year     SMALLINT,
  a_cont_rank      INTEGER, a_cont_value      INTEGER, a_cont_year      SMALLINT,
  a_country_rank   INTEGER, a_country_value   INTEGER, a_country_year   SMALLINT,
  PRIMARY KEY (wca_id, event_id)
);
