-- /timer 真题「按难度出题」新增「整体」方法(整解最优 HTM = 整个 3x3 的最优解步数)。
--
-- 其余方法(十字 / EO / 砖 …)的步数落在 wca_scramble_steps.steps[] 槽位里,整解不在其中
-- (离线 steps 管道只算阶段步数);整解步数早就存在 wca_scramble_optimal.htm(0047,solver/333opt
-- 一条龙灌库)。故整解难度筛直接以该表为源,谓词 = htm。
--
-- 缺的只有采样列 + 索引:飞镖采样要每行一个永久随机序(同 wca_scramble_steps.rnd 的做法),
-- 否则「某步数随机取 n 条」只能 ORDER BY random() 扫全表(18 步一档就 88 万行)。
-- DEFAULT random() 是 volatile → ADD COLUMN 会重写全表并逐行取不同值(正是要的);
-- 后续增量灌库(update_cross_stats.ps1 步骤 6b 的 UPSERT / \copy,列清单均显式列出 8 列)
-- 不写 rnd,新行走默认、老行保留,无需改管道。
ALTER TABLE wca_scramble_optimal
  ADD COLUMN IF NOT EXISTS rnd DOUBLE PRECISION NOT NULL DEFAULT random();

-- 热路径飞镖采样索引:WHERE event_id=? AND htm=? AND rnd>=dart ORDER BY rnd LIMIT n
CREATE INDEX IF NOT EXISTS idx_wso_ev_htm_rnd ON wca_scramble_optimal (event_id, htm, rnd);
