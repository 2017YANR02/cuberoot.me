-- recons 加 dup_reason 列:支撑「同选手 + 同打乱重复提交」的有意放行。
-- 默认仍判重(routes/recon.ts 走 buildDuplicateQuery,占位打乱 '?' 等已豁免),但命中重复时
-- 不再硬拒,而是要求用户二选一说明原因,值入此列:
--   'repeat_scramble' 重复打乱(同一打乱再次出现 / 同场粘贴重复)
--   'different_comp'   不同比赛恰好同打乱(极小概率)
-- 非重复提交此列为 NULL。校验见 utils/recon_helpers.ts validateRow。
ALTER TABLE recons ADD COLUMN IF NOT EXISTS dup_reason VARCHAR(20);
