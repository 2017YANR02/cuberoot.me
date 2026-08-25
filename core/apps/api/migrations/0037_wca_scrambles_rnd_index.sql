-- /v1/wca/scrambles/random 全时段随机:给每条打乱发一个永久随机「抽奖号」rnd ∈ [0,1),
-- 按 (event_id, rnd, id) 建索引 —— 把「洗牌」一次性烤进索引。随机抽 = 飞镖落在随机 rnd 点,
-- 顺着索引取 next n 条(WHERE event_id=? AND rnd >= <随机> ORDER BY rnd, id LIMIT n)。
-- 单次索引区间扫描,只读 n 行 —— 实测目标 ~1ms(对比旧 ORDER BY random() 全 event 排序 ~11.8s),
-- 且对每条打乱严格(边际)均匀,无需先抽比赛。
--
-- 索引尾列带 id:(event_id, rnd) 已够做 rnd>=? 区间扫描,把 id 也放进去让 ORDER BY rnd, id
-- 成为纯正向索引扫描(零 sort 节点);id 仅 8 字节/行,可忽略。
-- VOLATILE DEFAULT random() 在 ADD COLUMN 时逐行求值 → 现有 ~305 万行各得独立随机号
-- (一次性全表重写,几秒~1 分钟);未来 CI 灌新行自动领号,零维护。
-- ORDER BY rnd, id 的 id 兜底:万一两行撞号,顺序仍稳定。**不加 UNIQUE** —— 否则灌新数据
-- 撞号会报错;撞号本身无害(两行挨在一起一起被抽出),不必禁止。
-- 日期范围模式仍走 comp-sampling(见 routes/wca_scrambles.ts),不依赖此列。
ALTER TABLE wca_scrambles ADD COLUMN rnd double precision NOT NULL DEFAULT random();
CREATE INDEX idx_wca_scr_event_rnd ON wca_scrambles (event_id, rnd, id);
