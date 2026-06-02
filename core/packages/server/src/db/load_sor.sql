-- Sum-of-Ranks insights 灌库脚本 (手动管道 V1).
-- 用法 (本地或服务器, TSV 与本脚本同目录):
--   psql "$DSN" -v ON_ERROR_STOP=1 -f load_sor.sql
-- 或 stdin 管道 (容器内 \copy 看不到宿主文件时):
--   cat sor_census.copy.tsv | psql "$DSN" -c "\copy sor_census (...) FROM STDIN"
--
-- TSV 由本地 Rust 预计算产出 (吃 wca_person_ranks 同源的 21 项名次矩阵):
--   sor_census.copy.tsv       列: is_avg scope country_id rank wca_id subsets_won
--   sor_player_best.copy.tsv  列: wca_id is_avg scope best_rank best_events
-- 口径与 /v1/wca/sum-of-ranks 一致 (RANK_EVENTS = 17 活跃 + 4 废止). 仅世界口径 (scope='world').

CREATE TABLE IF NOT EXISTS sor_census (
  is_avg       BOOLEAN NOT NULL,
  scope        VARCHAR(8) NOT NULL,
  country_id   VARCHAR(50) NOT NULL DEFAULT '',
  rank         INTEGER NOT NULL,
  wca_id       VARCHAR(20) NOT NULL,
  subsets_won  BIGINT NOT NULL,
  PRIMARY KEY (is_avg, scope, country_id, wca_id)
);
CREATE INDEX IF NOT EXISTS sorc_lookup ON sor_census (is_avg, scope, country_id, rank);

CREATE TABLE IF NOT EXISTS sor_player_best (
  wca_id       VARCHAR(20) NOT NULL,
  is_avg       BOOLEAN NOT NULL,
  scope        VARCHAR(8) NOT NULL DEFAULT 'world',
  best_rank    INTEGER NOT NULL,
  best_events  TEXT NOT NULL,
  PRIMARY KEY (wca_id, is_avg, scope)
);

TRUNCATE sor_census;
TRUNCATE sor_player_best;

\copy sor_census (is_avg, scope, country_id, rank, wca_id, subsets_won) FROM 'sor_census.copy.tsv';
\copy sor_player_best (wca_id, is_avg, scope, best_rank, best_events) FROM 'sor_player_best.copy.tsv';

ANALYZE sor_census;
ANALYZE sor_player_best;
