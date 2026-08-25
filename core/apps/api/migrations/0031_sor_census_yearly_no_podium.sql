-- sor_census_yearly: 给「名次和第一名人堂」加「未登领奖台」二态, 与主榜单 hidePodium 口径统一.
-- no_podium=false → 全部选手(原口径); true → 仅从未登上比赛决赛前三的选手里重排"名次和第一"
-- (best_final_pos ∈ {0,>3}, 同 migration 0013 / 主榜单). v1 仅灌最新年快照(历史时间线留作 v2).
-- 表由 load_sor_yearly.sql 手动管道创建/灌库(不在 schema.pg.sql), 这里幂等补列+改键, 与 load 模板同步.
ALTER TABLE sor_census_yearly ADD COLUMN IF NOT EXISTS no_podium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sor_census_yearly DROP CONSTRAINT IF EXISTS sor_census_yearly_pkey;
ALTER TABLE sor_census_yearly ADD PRIMARY KEY (is_avg, incl_cancelled, no_podium, year, wca_id);
DROP INDEX IF EXISTS sor_cy_lookup;
CREATE INDEX IF NOT EXISTS sor_cy_lookup ON sor_census_yearly (is_avg, incl_cancelled, no_podium, year, rank);
