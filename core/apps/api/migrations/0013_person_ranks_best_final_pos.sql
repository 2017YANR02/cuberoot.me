-- 0013_person_ranks_best_final_pos.sql
-- wca_person_ranks.has_podium 语义错位(原 = "任一项 world_rank<=3" = 全球前3,不是实际比赛领奖台).
-- 用户反馈:Luke Garrett WC2023 单手 bronze,但单手 WR=16,旧 has_podium=FALSE → 错算"无牌".
-- 新口径(对齐 cubing.pro):best_final_pos = 跨所有 event 的 final round(round_type 'c'/'f')MIN(pos>0).
--   "无牌"     = best_final_pos = 0 OR > 3
--   "殿军之王" = best_final_pos = 4
-- has_podium 单 boolean 无法支撑 "殿军之王",直接换 SMALLINT.
-- DEFAULT 0 让 ALTER 即时生效(下次 wca_stats_extra build 全量 TRUNCATE + \copy 重灌).
ALTER TABLE wca_person_ranks
  ADD COLUMN IF NOT EXISTS best_final_pos SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE wca_person_ranks
  DROP COLUMN IF EXISTS has_podium;
