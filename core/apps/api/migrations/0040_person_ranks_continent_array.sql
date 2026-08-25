-- wca_person_ranks 加 ranks_continent 数组(21 元素,RANK_EVENTS 顺序,0=该项无成绩):
-- 自选组合(/sum-of-ranks/person-subset)按本洲口径(SoCR 式)现算求和的数据基.
-- builder 第 9 步早已逐项算出洲际名次(assignRanks 的 kr),此前只累加进 total_continent_rank 未存数组.
-- 数据填充前默认 '{}';server 端点以 cardinality>0 为门控,空数据时 socr 返 null 不误算.
ALTER TABLE wca_person_ranks ADD COLUMN IF NOT EXISTS ranks_continent INTEGER[] NOT NULL DEFAULT '{}';
