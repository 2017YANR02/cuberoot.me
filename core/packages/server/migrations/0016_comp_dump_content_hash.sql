-- dump_comps 增量决策从「updated_at 时间戳水位」改为「成绩内容指纹」。
-- 起因:WCA 周期性批量重戳 results.updated_at 却不改成绩(2026-05-24:1.4 万场被顶高 →
--   watermark 误判全变 → 全量重 dump → 单机卡死)。wca_comp_updated_at 现存 content_hash
--   (成绩值聚合,见 wca_stats_extra_build.ts);picker 改比 hash,批量盖戳不再误触发。
-- dumped_max_updated_at 旧列暂留(回滚兜底),新逻辑只写/读 dumped_content_hash。
ALTER TABLE comp_dump_state ADD COLUMN IF NOT EXISTS dumped_content_hash BIGINT;
ALTER TABLE comp_dump_state ALTER COLUMN dumped_max_updated_at DROP NOT NULL;
