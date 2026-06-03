-- Sum-of-Ranks insights (2026-06) — 配合 /wca/sum-of-ranks 页的两块组合分析:
--   1) 名人堂普查 (sor_census): 在所有 2^21 个项目组合里, 谁当过"名次和第一"
--   2) 个人最优组合 (sor_player_best): 每个选手选哪些项目时名次和排名最靠前 + 能到第几
--
-- 数据流同 schema_wca_stats_extra.pg.sql:
--   离线 Rust 预计算 (吃 wca_person_ranks 同源的 21 项名次矩阵) → 产 .copy.tsv → server psql \copy.
--   口径与 /v1/wca/sum-of-ranks 完全一致 (subset_total = Σ 选中项 world_rank, 缺项=该项参赛人数+1;
--   并列按 wca_id 升序 tie-break). RANK_EVENTS 顺序 = 17 活跃 + 4 废止 (333ft/magic/mmagic/333mbo).
--
-- 重要: 此文件只是 schema 参考. 实际灌库走 load_sor.sql 里的 CREATE IF NOT EXISTS + TRUNCATE + COPY,
-- 改 schema 要同步那份模板.

-- ── sor_census: 谁当过"名次和第一" ──
-- 一行 = (is_avg, scope, country, 某个当过第一的选手). subsets_won = 他在多少个组合里是第一.
-- scope='world' 时 country_id=''; scope='country' 时按本国成员各自 ranks_country 求和.
-- rank = 按 subsets_won 降序的名次 (并列按 wca_id 升序). 头部用 COUNT(*) 即"共多少人当过第一".
CREATE TABLE IF NOT EXISTS sor_census (
  is_avg       BOOLEAN NOT NULL,
  scope        VARCHAR(8) NOT NULL,             -- 'world' | 'country'
  country_id   VARCHAR(50) NOT NULL DEFAULT '', -- '' = world
  rank         INTEGER NOT NULL,                -- 1-based, 按 subsets_won 降序
  wca_id       VARCHAR(20) NOT NULL,
  subsets_won  BIGINT NOT NULL,
  PRIMARY KEY (is_avg, scope, country_id, wca_id)
);
CREATE INDEX IF NOT EXISTS sorc_lookup ON sor_census (is_avg, scope, country_id, rank);

-- ── sor_player_best: 每个选手的最优项目组合 ──
-- 一行 = (wca_id, is_avg, scope). best_rank = 在最优组合下显示的名次 (1=能到第一).
-- best_events = 达到该名次的全部并列组合, ';' 分隔; 每组合内部 ',' 分隔 event id (项目数最少优先, 封顶 KEEP 个).
-- combo_count  = 并列该名次的全部子集数 (可能 > best_events 里列出的组合数). 历史行 = 1 (单组合).
-- 只收录至少比过 1 项的选手 (best_rank 有意义). combo_count 由 migration 0022 补列.
CREATE TABLE IF NOT EXISTS sor_player_best (
  wca_id       VARCHAR(20) NOT NULL,
  is_avg       BOOLEAN NOT NULL,
  scope        VARCHAR(8) NOT NULL DEFAULT 'world',
  best_rank    INTEGER NOT NULL,
  combo_count  INTEGER NOT NULL DEFAULT 1,      -- 并列该名次的全部子集数
  best_events  TEXT NOT NULL,                   -- ';' 分隔的并列组合, 组内 ',' 分隔 event id
  PRIMARY KEY (wca_id, is_avg, scope)
);

-- ── sor_census_yearly: 历史名人堂 (按年末快照) ──
-- 一行 = (is_avg, incl_cancelled, year, 截至该年末当过"名次和第一"的某选手).
-- 数据源 historical_ranks_snapshot (每年末全员重排) → Rust `sorcalc history` 逐年穷举.
-- incl_cancelled=false → 仅 17 活跃项 (2^17-1 组合); true → 含 4 废止项 (2^21-1 组合).
-- 历史冻结: 过去年份永不重算, 只偶尔刷新当前年 (DELETE year=Y 重灌). 与每日 stats 流水线无关.
-- 某年 distinct = COUNT(*); 时间线 = GROUP BY year COUNT(*). 走 load_sor_yearly.sql 灌库.
CREATE TABLE IF NOT EXISTS sor_census_yearly (
  is_avg          BOOLEAN NOT NULL,
  incl_cancelled  BOOLEAN NOT NULL,
  year            INTEGER NOT NULL,
  rank            INTEGER NOT NULL,             -- 1-based, 按 subsets_won 降序
  wca_id          VARCHAR(20) NOT NULL,
  subsets_won     BIGINT NOT NULL,
  PRIMARY KEY (is_avg, incl_cancelled, year, wca_id)
);
CREATE INDEX IF NOT EXISTS sor_cy_lookup ON sor_census_yearly (is_avg, incl_cancelled, year, rank);
