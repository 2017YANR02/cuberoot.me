-- wca_person_ranks 加洲际维度:total_continent_rank(全 17 现役项的洲际名次和)+ continent_id(分桶/索引).
-- 地区维度(total_country_rank / country_id)早已存在;洲际是选手页 Σ 行「洲际」列的数据基.
-- 由 wca_stats_extra_build.ts 第 9 步填充(assignRanks 已能一并出 world/country/continent 三档名次).
-- 数据填充前默认 0/'';server /person 端点以 total_continent_rank>0 为门控,空数据时洲际列留空不误显.
ALTER TABLE wca_person_ranks ADD COLUMN IF NOT EXISTS continent_id VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE wca_person_ranks ADD COLUMN IF NOT EXISTS total_continent_rank INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS pr_continent_total ON wca_person_ranks (is_avg, continent_id, total_continent_rank);
