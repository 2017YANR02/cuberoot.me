-- wca_person_ranks 加 21 项口径(17 现役 + 4 废止)名次和三列:选手页 Σ 行「废止项」开关的数据基.
-- 口径与 /sum-of-ranks 子集路径(SQL CASE 表达式)一致:有 rank 取 rank,缺项罚「该 scope 该项参赛人数+1」;
-- 无 average 的 333mbf/333mbo 在 average 行同按罚分 +1 计入(参赛人数 0+1),保持与子集求和逐字节一致.
-- 由 wca_stats_extra_build.ts 第 9 步填充(stats.yml 日更);填充前默认 0,server /person 端点以 >0 门控,空数据返 null.
ALTER TABLE wca_person_ranks ADD COLUMN IF NOT EXISTS total_world_rank_21 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wca_person_ranks ADD COLUMN IF NOT EXISTS total_country_rank_21 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wca_person_ranks ADD COLUMN IF NOT EXISTS total_continent_rank_21 INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS pr_total_21 ON wca_person_ranks (is_avg, country_id, total_world_rank_21);
CREATE INDEX IF NOT EXISTS pr_country_total_21 ON wca_person_ranks (is_avg, country_id, total_country_rank_21);
CREATE INDEX IF NOT EXISTS pr_continent_total_21 ON wca_person_ranks (is_avg, continent_id, total_continent_rank_21);
ANALYZE wca_person_ranks;
