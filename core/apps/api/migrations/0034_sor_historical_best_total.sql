-- 给 sor_historical_best 加 best_total:该最佳名次那年的 SOR 名次总和.
-- 主榜「历史最佳」列要同时显示总和+排名(原只有排名).数据由 sor_over_time_build.ts 回填,
-- 走 historical_ranks 同一 apply_load 通道(load.sql 内也有同款 ADD COLUMN IF NOT EXISTS 兜底).
ALTER TABLE sor_historical_best ADD COLUMN IF NOT EXISTS best_total INTEGER;
