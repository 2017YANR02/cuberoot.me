-- 0007_wrt_prior_pr_index.sql
-- /comp/<id> 赛前 PR 查询专用索引.
-- query (cubing_live.ts):
--   SELECT wca_id, event_id, is_avg, MIN(value)
--   FROM wca_results_top
--   WHERE wca_id IN (...300+ ids...)
--     AND event_id IN (...events...)
--     AND comp_date < ?
-- 原索引都以 event_id 起首,只能走 seq scan 12M 行 → 58s,大比赛连发会堵爆 PG 连接池.
-- 新索引按 wca_id 起首,每选手区间扫小段 + comp_date 内嵌过滤,实测 58s → 105ms.
-- 大小 ~505 MB. 生产已 CONCURRENTLY 建,apply_migrations.sh 重跑安全(IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS wrt_prior_pr
  ON wca_results_top (wca_id, event_id, is_avg, comp_date)
  INCLUDE (value);
