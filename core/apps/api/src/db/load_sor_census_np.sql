-- 名人堂「未登领奖台」增量灌库 (手动管道). 只动 sor_census_yearly 里 no_podium=true 的行,
-- 不碰全部选手口径 (no_podium=false) 的历史回填. 与 load_sor_yearly.sql 互补.
-- 用法 (TSV 与本脚本同目录):
--   psql "$DSN" -v ON_ERROR_STOP=1 -f load_sor_census_np.sql
--
-- TSV 由 `sorcalc census_np <year>` 产出 (吃 historical_ranks_snapshot 最新年快照 + best_final_pos 未登台名单):
--   census_np.copy.tsv  列序: year is_avg incl_cancelled no_podium rank wca_id subsets_won  (no_podium 恒 't')
-- v1 仅最新年; 重跑直接覆盖 (先删 no_podium=true 再灌).

-- 幂等补维度 (新库或既有库都安全, 与 migration 0031 同款).
ALTER TABLE sor_census_yearly ADD COLUMN IF NOT EXISTS no_podium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sor_census_yearly DROP CONSTRAINT IF EXISTS sor_census_yearly_pkey;
ALTER TABLE sor_census_yearly ADD PRIMARY KEY (is_avg, incl_cancelled, no_podium, year, wca_id);
DROP INDEX IF EXISTS sor_cy_lookup;
CREATE INDEX IF NOT EXISTS sor_cy_lookup ON sor_census_yearly (is_avg, incl_cancelled, no_podium, year, rank);

DELETE FROM sor_census_yearly WHERE no_podium = true;

\copy sor_census_yearly (year, is_avg, incl_cancelled, no_podium, rank, wca_id, subsets_won) FROM 'census_np.copy.tsv';

ANALYZE sor_census_yearly;
SELECT no_podium, is_avg, incl_cancelled, count(*) FROM sor_census_yearly GROUP BY 1,2,3 ORDER BY 1,2,3;
