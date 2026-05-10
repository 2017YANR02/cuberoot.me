-- Historical Ranks 相关表(2026-05 新增)
-- 加进现有 recon_db,与 recon/alg 表共存。
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
  PRIMARY KEY (event_id, year, wca_id)
);

-- 主查询索引:按 (event, year) 出全球榜或国家榜
CREATE INDEX IF NOT EXISTS hrs_single_wr ON historical_ranks_snapshot (event_id, year, single_world_rank) WHERE single_world_rank > 0;
CREATE INDEX IF NOT EXISTS hrs_avg_wr ON historical_ranks_snapshot (event_id, year, avg_world_rank) WHERE avg_world_rank > 0;
CREATE INDEX IF NOT EXISTS hrs_single_cr ON historical_ranks_snapshot (event_id, year, country_id, single_country_rank) WHERE single_country_rank > 0;
CREATE INDEX IF NOT EXISTS hrs_avg_cr ON historical_ranks_snapshot (event_id, year, country_id, avg_country_rank) WHERE avg_country_rank > 0;

-- ── 4b. historical_ranks_monthly_snapshot: 每月末的累积最佳快照 ──
-- 跟 4. snapshot 同结构,但分辨率到月.smart-emit:仅当该月本人有 result 时才 emit 一行.
-- 用途:选手页"历史成绩排名曲线"按月画点,跟 cubing.pro 视觉对齐.
-- 估容量:~8M 行 / ~2GB 含索引 (vs 年级表 7.5M / 1.7GB).
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
  avg_continent_rank    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, year, month, wca_id)
);

-- 选手页查询索引:按 (wca_id, event) 拉出整条时间序列(主索引就足够,wca_id 在 PK 末尾不利)
CREATE INDEX IF NOT EXISTS hrms_person ON historical_ranks_monthly_snapshot (wca_id, event_id, year, month);
-- (event, year, month) 查每月榜单,跟年级表索引同 pattern
CREATE INDEX IF NOT EXISTS hrms_single_wr ON historical_ranks_monthly_snapshot (event_id, year, month, single_world_rank) WHERE single_world_rank > 0;
CREATE INDEX IF NOT EXISTS hrms_avg_wr    ON historical_ranks_monthly_snapshot (event_id, year, month, avg_world_rank)    WHERE avg_world_rank > 0;

-- ── 5. meta_historical: 元信息(导入时间戳等) ──
CREATE TABLE IF NOT EXISTS meta_historical (
  key        VARCHAR(50) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
