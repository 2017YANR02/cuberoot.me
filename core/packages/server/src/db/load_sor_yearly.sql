-- 历史名人堂 (sor_census_yearly) 灌库脚本 (手动管道).
-- 用法 (TSV 与本脚本同目录):
--   psql "$DSN" -v ON_ERROR_STOP=1 -f load_sor_yearly.sql
-- 或 stdin 管道:
--   cat census_yearly.copy.tsv | psql "$DSN" -c "\copy sor_census_yearly (year, is_avg, incl_cancelled, rank, wca_id, subsets_won) FROM STDIN"
--
-- TSV 由本地 Rust 预计算产出 (`sorcalc history` 吃 historical_ranks_snapshot 年末快照):
--   census_yearly.copy.tsv  列序: year is_avg incl_cancelled rank wca_id subsets_won
-- 历史冻结: 全量回填一次即可; 刷新当前年用 DELETE year=Y + 单年 \copy, 过去年份不动.

CREATE TABLE IF NOT EXISTS sor_census_yearly (
  is_avg          BOOLEAN NOT NULL,
  incl_cancelled  BOOLEAN NOT NULL,
  year            INTEGER NOT NULL,
  rank            INTEGER NOT NULL,
  wca_id          VARCHAR(20) NOT NULL,
  subsets_won     BIGINT NOT NULL,
  PRIMARY KEY (is_avg, incl_cancelled, year, wca_id)
);
CREATE INDEX IF NOT EXISTS sor_cy_lookup ON sor_census_yearly (is_avg, incl_cancelled, year, rank);

TRUNCATE sor_census_yearly;

\copy sor_census_yearly (year, is_avg, incl_cancelled, rank, wca_id, subsets_won) FROM 'census_yearly.copy.tsv';

ANALYZE sor_census_yearly;
