-- Historical Ranks 相关表(2026-05 新增)
-- 加进现有 cuberoot_db,与 recon/alg 表共存。
-- 设计意图见 D:/cube/cubing-pro/src/wca/sync_static_to_db.go(参考实现,Go版,我们简化为按年快照)。
--
-- 数据流:GitHub Actions runner 上跑 historical_ranks_build.ts 输出 PG SQL,
-- scp 到服务器后 psql -f 灌进这些表。每次替换是原子的(BEGIN ... TRUNCATE/COPY ... COMMIT)。

-- ── 1. wca_countries: WCA 国家列表(~200 行) ──
-- 用于前端国家下拉 + 国家名/旗映射。
CREATE TABLE IF NOT EXISTS wca_countries (
  id           VARCHAR(50) PRIMARY KEY,    -- WCA country id, eg 'China', 'USA'
  iso2         VARCHAR(2),                  -- ISO 3166-1 alpha-2, eg 'CN'(部分历史国可能 NULL)
  name         VARCHAR(100) NOT NULL,
  continent_id VARCHAR(20) NOT NULL         -- '_Asia', '_Europe', etc
);

-- ── 2. wca_continents: 大洲(~6 行) ──
CREATE TABLE IF NOT EXISTS wca_continents (
  id   VARCHAR(20) PRIMARY KEY,            -- '_Asia', '_Europe', etc
  name VARCHAR(50) NOT NULL
);

-- ── 3. wca_persons: 选手姓名+国籍(精简,~250k 行 ~10MB) ──
-- 仅保留 sub_id=1 的当前国籍记录,用于结果展示拼名字。
CREATE TABLE IF NOT EXISTS wca_persons (
  wca_id     VARCHAR(20) PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  country_id VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS wca_persons_country ON wca_persons (country_id);
-- 选手名录(排名页空态 A-Z 视图)排序:名字首字母 + 名字长度(剥本地名注释后的拉丁名长度,见 migration 0052)
CREATE INDEX IF NOT EXISTS wca_persons_name ON wca_persons (name);
CREATE INDEX IF NOT EXISTS wca_persons_name_len
  ON wca_persons ((char_length(regexp_replace(name, '\s*\([^)]*\)\s*$', ''))));

-- ── 4. historical_ranks_snapshot: 每年末的累积最佳快照(~7.5M 行 ~470MB TSV / ~1GB 含索引) ──
-- 一行 = (event, year, person) 在 [WCA 开始 .. year-12-31] 区间的累积最佳 + 那一刻的世界/国家/洲排名。
-- 跨年只新增不修改:已经定格的过去年份永远不变;当前年每天重算.
--
-- single 与 average 都存:有的人 single 有但 average 没有(MBLD 也没 average)→ NULL 占位.
-- *_world_rank=0 表示该人那年没有该类型成绩.
CREATE TABLE IF NOT EXISTS historical_ranks_snapshot (
  event_id              VARCHAR(20) NOT NULL,
  year                  SMALLINT NOT NULL,
  wca_id                VARCHAR(20) NOT NULL,
  single                INTEGER,             -- NULL 表示该年没 single 成绩
  average               INTEGER,             -- NULL 表示该年没 average 成绩
  country_id            VARCHAR(50) NOT NULL,
  single_world_rank     INTEGER NOT NULL DEFAULT 0,
  single_country_rank   INTEGER NOT NULL DEFAULT 0,
  single_continent_rank INTEGER NOT NULL DEFAULT 0,
  avg_world_rank        INTEGER NOT NULL DEFAULT 0,
  avg_country_rank      INTEGER NOT NULL DEFAULT 0,
  avg_continent_rank    INTEGER NOT NULL DEFAULT 0,
  -- PB 上下文(2026-05 加,migration 0006):persons 模式渲染 Date/Competition/Solves 列用
  best_single_comp_id   VARCHAR(40),
  best_single_date      DATE,
  best_single_attempts  INTEGER[],
  best_average_comp_id  VARCHAR(40),
  best_average_date     DATE,
  best_average_attempts INTEGER[],
  PRIMARY KEY (event_id, year, wca_id)
);
-- 注:渲染 Competition 列需 JOIN wca_competitions(由 wca_stats_extra 那条管道维护).

-- 主查询索引:按 (event, year) 出全球榜或国家榜
CREATE INDEX IF NOT EXISTS hrs_single_wr ON historical_ranks_snapshot (event_id, year, single_world_rank) WHERE single_world_rank > 0;
CREATE INDEX IF NOT EXISTS hrs_avg_wr ON historical_ranks_snapshot (event_id, year, avg_world_rank) WHERE avg_world_rank > 0;
-- ⚠️ 别删 hrs_*_cr!它们 pg_stat 里 idx_scan 常年=0(地区筛选视图冷),看着像死索引,
--    但实测删掉后 /wca/historical 的地区视图退化成整张 7.5M 行表的全表扫 → 每次 ~10 秒(实测 China/333)。
--    idx_scan=0 ≠ 可删:这俩是 historical_ranks.ts 地区分支(WHERE event=year=country_id ORDER BY country_rank)的承重墙。
CREATE INDEX IF NOT EXISTS hrs_single_cr ON historical_ranks_snapshot (event_id, year, country_id, single_country_rank) WHERE single_country_rank > 0;
CREATE INDEX IF NOT EXISTS hrs_avg_cr ON historical_ranks_snapshot (event_id, year, country_id, avg_country_rank) WHERE avg_country_rank > 0;

-- ── 4b. historical_ranks_monthly_snapshot: 每月末的累积最佳快照 ──
-- 跟 4. snapshot 同结构,但分辨率到月.smart-emit:仅当该月本人有 result 时才 emit 一行.
-- 用途:选手页"历史成绩排名曲线"按月画点,跟 cubing.pro 视觉对齐.
-- 实测容量:~4.25M 行 / ~600 MB(瘦身后,仅 hrms_person 一个索引;migration 0019 删了死索引 + PK).
CREATE TABLE IF NOT EXISTS historical_ranks_monthly_snapshot (
  event_id              VARCHAR(20) NOT NULL,
  year                  SMALLINT NOT NULL,
  month                 SMALLINT NOT NULL,           -- 1..12
  wca_id                VARCHAR(20) NOT NULL,
  single                INTEGER,
  average               INTEGER,
  country_id            VARCHAR(50) NOT NULL,
  single_world_rank     INTEGER NOT NULL DEFAULT 0,
  single_country_rank   INTEGER NOT NULL DEFAULT 0,
  single_continent_rank INTEGER NOT NULL DEFAULT 0,
  avg_world_rank        INTEGER NOT NULL DEFAULT 0,
  avg_country_rank      INTEGER NOT NULL DEFAULT 0,
  avg_continent_rank    INTEGER NOT NULL DEFAULT 0
  -- 无 PK:派生表,每周 TRUNCATE+\copy 全量重灌,唯一性由 builder 确定性 emit 保证;
  --        查询只按 wca_id 走 hrms_person。原 PK (event,year,month,wca_id) 从不被查询用,已删 (migration 0019)。
);

-- 选手页查询索引(本表唯一在用的索引):按 (wca_id, event) 拉出整条时间序列
CREATE INDEX IF NOT EXISTS hrms_person ON historical_ranks_monthly_snapshot (wca_id, event_id, year, month);
-- 注:原 hrms_single_wr / hrms_avg_wr("按月世界榜")已删 — 全站无该功能,从无查询走过。见 migration 0019。

-- ── 4c. historical_best_ranks: 每 (选手, 项目) 的"历史最佳名次" ──
-- 精确口径:按比赛逐场重放(per-competition incremental order-statistics / Fenwick),
-- 名次 = "该场比赛结束、当前所有已结束比赛一起重排时"选手的位置;取生涯最小。
-- 每档(single/average × world/continent/country)各自独立取最小,并记下取得该名次时的成绩值+年份
-- (各档可能来自不同时刻 —— 早年场次少、成绩慢但名次反而好)。
-- *_rank=NULL 表示该项目该类型从无有效成绩。一行/选手/项目,wca_id 打头 → WHERE wca_id=? 走 PK。
CREATE TABLE IF NOT EXISTS historical_best_ranks (
  wca_id           VARCHAR(20) NOT NULL,
  event_id         VARCHAR(20) NOT NULL,
  s_world_rank     INTEGER, s_world_value     INTEGER, s_world_year     SMALLINT,
  s_cont_rank      INTEGER, s_cont_value      INTEGER, s_cont_year      SMALLINT,
  s_country_rank   INTEGER, s_country_value   INTEGER, s_country_year   SMALLINT,
  a_world_rank     INTEGER, a_world_value     INTEGER, a_world_year     SMALLINT,
  a_cont_rank      INTEGER, a_cont_value      INTEGER, a_cont_year      SMALLINT,
  a_country_rank   INTEGER, a_country_value   INTEGER, a_country_year   SMALLINT,
  PRIMARY KEY (wca_id, event_id)
);

-- ── 5. meta_historical: 元信息(导入时间戳等) ──
CREATE TABLE IF NOT EXISTS meta_historical (
  key        VARCHAR(50) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
