-- LSLL(最后一槽 + 顶层)每个 case 的整方 HTM 最优解。
--
-- 口径(用户 2026-07-27 定):**HTM 最优前提下 QTM 也最优,并列全留**。
-- `optimal_algs` 存的就是那批并列解;`exhaustive` 说明它是否已穷尽:
--   * false = 只拿到了**一条**最优解(阶段 1 的产物)—— `htm` 是确定的最优步数,
--     但 `qtm` 只是这一条的 QTM,未必是所有最优解里最小的。前端必须如实说明。
--   * true  = 该 case 的全部 (HTM, QTM) 并列解都在里面。
-- 为什么会有 false:cubeopt/h48 的 wasm 吐不出全部最优解(embind 只导出
-- get_mem_ptr/init/get_table_size/get_table_name/solve_scramble,`solve_scramble` 的第 3 个参数是
-- 「同时解几条」而非解数上限)。阶段 2 的三条路见 solver/lsll/README.md。
--
-- 主键 = LSLL canonical key 的 **base36 串**(client `lib/lsll/model.keyToString`,也是 URL 的 ?k=),
-- 直接对齐前端与 CSV,省掉一层进制转换。40bit 的 key base36 最长 8 字符。
-- 数据不入 migration(148,384 行):本地 solver/lsll 跑完 → export_cases.mjs → update_lsll.ps1 增量灌库。
CREATE TABLE IF NOT EXISTS lsll_cases (
  canonical_key VARCHAR(12) PRIMARY KEY,
  htm           SMALLINT    NOT NULL,
  qtm           SMALLINT    NOT NULL,
  exhaustive    BOOLEAN     NOT NULL DEFAULT false,
  optimal_algs  JSONB       NOT NULL,
  stm           SMALLINT,               -- 预留:项目暂无 STM 求解器
  mcc_order     JSONB,                  -- 预留:人类公式按 MCC 的展示序
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 大类页的步数分布直方图按 htm 聚合。
CREATE INDEX IF NOT EXISTS idx_lsll_cases_htm ON lsll_cases (htm);
