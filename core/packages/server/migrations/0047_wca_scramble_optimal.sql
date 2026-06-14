-- 3x3-family 真实打乱的 God's-number 最优解步数 + 最优打乱,供 /timer 真题模式「原始打乱 / 最优打乱」二选。
-- 最优打乱 = invert(最优解),到达同一魔方态的最短打乱(|最优打乱| = htm ≤ |原始 WCA 打乱|)。
--
-- 仅同态项目入表:333 / 333oh / 333ft / 333fm 是纯面转打乱,最优打乱可作原打乱的等态替身。
-- 盲拧(333bf)/ 多盲(333mbf)不入:其 WCA 打乱带宽块定向后缀,本地 solver 解的是剥定向后的状态,
-- 非同一魔方态,最优打乱无法还原原盲拧打乱。
--
-- 按自然键(与 wca_scrambles 同口径)主键,server 端点 LEFT JOIN wca_scrambles 取 optimal_scramble。
-- wca_scrambles.id 是本地自增 IDENTITY(非 WCA scrambleId),故只能按自然键关联。
-- 数据不入 migration(量大):本地 solver/333opt 跑完求解 → export_optimal.mjs 产 wca_optimal.csv → \copy 灌入。
CREATE TABLE IF NOT EXISTS wca_scramble_optimal (
  competition_id   VARCHAR(32) NOT NULL,
  event_id         VARCHAR(6)  NOT NULL,
  round_type_id    VARCHAR(1)  NOT NULL,
  group_id         VARCHAR(3)  NOT NULL,
  is_extra         SMALLINT    NOT NULL DEFAULT 0,
  scramble_num     INT         NOT NULL,
  htm              SMALLINT    NOT NULL,
  optimal_scramble TEXT        NOT NULL,
  PRIMARY KEY (competition_id, event_id, round_type_id, group_id, is_extra, scramble_num)
);
