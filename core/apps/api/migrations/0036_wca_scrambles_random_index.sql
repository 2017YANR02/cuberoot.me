-- 加速 /v1/wca/scrambles/random（timer 真实打乱练习池）。
-- 旧 `ORDER BY random()` 会 bitmap 扫该 event 全部行(333 ≈ 71 万)再 top-N 排序 —— 实测 ~11.8s。
-- 改成随机 id 窗口:`WHERE event_id=? AND id >= <随机起点> ORDER BY id LIMIT n`,
-- 复合索引 (event_id, id) 让它退化成 O(n) 区间扫描 —— 实测 ~3ms。
-- (event_id, id) 的前导列即 event_id,完全覆盖原 idx_wca_scr_event(event_id) 的用途,故删冗余单列索引。
CREATE INDEX IF NOT EXISTS idx_wca_scr_event_id ON wca_scrambles (event_id, id);
DROP INDEX IF EXISTS idx_wca_scr_event;
