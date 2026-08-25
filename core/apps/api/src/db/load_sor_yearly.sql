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
  no_podium       BOOLEAN NOT NULL DEFAULT false,
  year            INTEGER NOT NULL,
  rank            INTEGER NOT NULL,
  wca_id          VARCHAR(20) NOT NULL,
  subsets_won     BIGINT NOT NULL,
  PRIMARY KEY (is_avg, incl_cancelled, no_podium, year, wca_id)
);
-- 既有表补 no_podium 维度 + 改 PK/索引 (与 migration 0031 同款, 幂等).
ALTER TABLE sor_census_yearly ADD COLUMN IF NOT EXISTS no_podium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sor_census_yearly DROP CONSTRAINT IF EXISTS sor_census_yearly_pkey;
ALTER TABLE sor_census_yearly ADD PRIMARY KEY (is_avg, incl_cancelled, no_podium, year, wca_id);
DROP INDEX IF EXISTS sor_cy_lookup;
CREATE INDEX IF NOT EXISTS sor_cy_lookup ON sor_census_yearly (is_avg, incl_cancelled, no_podium, year, rank);

-- 全量回填 = 全部选手口径 (no_podium=false, 由 DEFAULT 填). 只删 no_podium=false 行, 保留 census_np 增量.
DELETE FROM sor_census_yearly WHERE no_podium = false;

\copy sor_census_yearly (year, is_avg, incl_cancelled, rank, wca_id, subsets_won) FROM 'census_yearly.copy.tsv';

ANALYZE sor_census_yearly;
