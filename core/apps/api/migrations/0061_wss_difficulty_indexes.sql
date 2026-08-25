-- 加速 /timer 「按难度」出题 + /scramble/stats by-difficulty:wca_scramble_steps 难度查询此前对
-- cross/xcross 以外的阶段(xxcross+)及子集底色没有可用索引,退化为整分区顺序扫描 + ORDER BY random()
-- (333 ~1.3M 行,实测 EXPLAIN ANALYZE 2.5s)。两层根治:
--
--   1) 通用飞镖兜底索引 (event_id, rnd):任意 (方法,阶段,子集) 都能按 rnd 飞镖采样 + LIMIT 提前停,
--      常见步数 bin 毫秒级(稀有 bin 仍需扫,见 2)。
--   2) std 深阶段「六色最优」= LEAST(该阶段 6 底色槽) 的表达式索引:数据已在 steps[] 里,用表达式索引
--      免加列、免表重写;reload 走 TRUNCATE+显式列 INSERT,表达式索引由 PG 自动重建,管道零改动。
--      六色查询直接命中(predCol = LEAST 即索引表达式);子集查询用 LEAST(六色) <= max(steps) 前过滤亦走它。
--      槽位偏移见 steps_layout.json(std:xxcross=13..18, xxxcross=19..24, xxxxcross=25..30,B,G,O,R,W,Y 序)。
--      cross(1..6)/xcross(7..12) 已有预算列 gm_cross6/gm_xcross6 + 索引,不在此重复。
--
-- 配套 server 改动:routes/wca_scrambles.ts 把无日期难度查询从 ORDER BY random() 改成 rnd 飞镖采样
-- (正向 + 环绕补齐),并把 planDifficulty 的 gmCol 扩到 5 个 std 阶段。EXPLAIN 验证:稀有 bin 8 → 20ms、
-- 常见 bin 12-13 → 65ms(原各 ~2.5s)。
CREATE INDEX IF NOT EXISTS idx_wss_event_rnd ON wca_scramble_steps (event_id, rnd);

CREATE INDEX IF NOT EXISTS idx_wss_xxcross6 ON wca_scramble_steps
  (event_id, (LEAST(steps[13],steps[14],steps[15],steps[16],steps[17],steps[18])), rnd);
CREATE INDEX IF NOT EXISTS idx_wss_xxxcross6 ON wca_scramble_steps
  (event_id, (LEAST(steps[19],steps[20],steps[21],steps[22],steps[23],steps[24])), rnd);
CREATE INDEX IF NOT EXISTS idx_wss_xxxxcross6 ON wca_scramble_steps
  (event_id, (LEAST(steps[25],steps[26],steps[27],steps[28],steps[29],steps[30])), rnd);
