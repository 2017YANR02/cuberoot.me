-- WCA stats extra (2026-05) — 6 个 cubing.pro 风格的统计 tab
-- 与 schema_historical_ranks.pg.sql 共存,在 recon_db 里.
-- 数据流相同:CI runner 计算 → scp TSV → server psql -f load.sql 原子替换.
--
-- 6 个表:
--   wca_grand_slam        : 大满贯(WC + Continental + National 领奖台 + WR)
--   wca_results_top       : 全部成绩排行(top 5000 ww + top 500/country, per event×type)
--   wca_year_results_top  : 当年成绩排行(top 200 ww + top 30/country, per year×event×type)
--   wca_cohort_ranks      : 参赛届别排行(每届首参赛年的人累积最佳)
--   wca_success_rate      : 项目成功率(每人 solved/attempted)
--   wca_all_events_done   : 全项目达成(每人完成 17 项的耗时)
--   wca_person_ranks      : 全项目排行(每人每项当前世界/国家排名 → SUM)
--
-- 另需 wca_competitions 小表(~10k 行,用于 join 比赛名称/日期)

-- ── wca_competitions: 比赛元数据 (~10k 行 ~3MB) ──
CREATE TABLE IF NOT EXISTS wca_competitions (
  id          VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,
  start_date  DATE,
  end_date    DATE
);

-- ── wca_grand_slam: 大满贯 ──
-- 一行 = (person, event):该选手在该项目同时完成: WC 领奖台 + 大洲冠军赛领奖台 + 国家锦标赛领奖台 + 破过 WR
-- "领奖台" = pos<=3 in finals (round_type_id IN ('c','f'))
-- "is_only_first" = 三场都是金牌(pos=1)
CREATE TABLE IF NOT EXISTS wca_grand_slam (
  wca_id                       VARCHAR(20) NOT NULL,
  event_id                     VARCHAR(20) NOT NULL,
  best_value                   INTEGER,
  avg_value                    INTEGER,
  country_id                   VARCHAR(50) NOT NULL,
  has_wr                       BOOLEAN NOT NULL DEFAULT FALSE,
  is_only_first                BOOLEAN NOT NULL DEFAULT FALSE,
  world_champ_comp_id          VARCHAR(50),
  world_champ_pos              SMALLINT,
  continental_champ_comp_id    VARCHAR(50),
  continental_champ_pos        SMALLINT,
  national_champ_comp_id       VARCHAR(50),
  national_champ_pos           SMALLINT,
  PRIMARY KEY (wca_id, event_id)
);
CREATE INDEX IF NOT EXISTS gs_event ON wca_grand_slam (event_id);

-- ── wca_results_top: 全部成绩排行 (~11M 行,无 cap) ──
-- 一行 = 一次 valid (best 或 average) 成绩.同人同 comp 多 round 可能重复.
-- 客户端按 (event, is_avg) 过滤后 ORDER BY value 翻页,可叠加 country / year / month / 选手 / 比赛搜索.
--
-- 重要:此文件只是 schema 参考,apply.sh 不调它.每周 CI 实际是 load.sql 里 DROP+CREATE+COPY,
-- 所以 schema 改动要同步到 wca_stats_extra_build.ts 里 loadSql 模板.
CREATE TABLE IF NOT EXISTS wca_results_top (
  event_id           VARCHAR(20) NOT NULL,
  is_avg             BOOLEAN NOT NULL,
  value              INTEGER NOT NULL,
  wca_id             VARCHAR(20) NOT NULL,
  person_country_id  VARCHAR(50) NOT NULL,    -- 持件人当时国籍(国旗用)
  comp_id            VARCHAR(50) NOT NULL,
  comp_date          DATE NOT NULL,           -- 比赛 start_date,用于 year/month 过滤(无需 join)
  attempts           INTEGER[]                -- 5 次 raw 值(WCA 编码)
);
-- 主索引: ORDER BY value LIMIT/OFFSET — 全量翻页主路径
CREATE INDEX IF NOT EXISTS wrt_main ON wca_results_top (event_id, is_avg, value, wca_id);
-- 国家过滤路径(走索引按 value 排序)
CREATE INDEX IF NOT EXISTS wrt_country ON wca_results_top (event_id, is_avg, person_country_id, value);
-- 选手 / 比赛搜索路径(IN list);q 命中条数少,走该索引比 main + filter 快
CREATE INDEX IF NOT EXISTS wrt_wca_id ON wca_results_top (event_id, is_avg, wca_id, value);
CREATE INDEX IF NOT EXISTS wrt_comp_id ON wca_results_top (event_id, is_avg, comp_id, value);
-- 年份/月份: 走 main 索引 + comp_date 过滤(不专门索引,跳过 cap=2GB 索引膨胀)

-- ── wca_year_results_top: 当年成绩排行 (~5M 行) ──
-- 一行 = (year, event, is_avg, country_filter, rank) 的具体一次成绩.
-- country_filter='' 全球(top 200),否则国家(top 30).
-- year 是比赛年,month 让前端可二级筛选.
CREATE TABLE IF NOT EXISTS wca_year_results_top (
  year               SMALLINT NOT NULL,
  event_id           VARCHAR(20) NOT NULL,
  is_avg             BOOLEAN NOT NULL,
  country_filter     VARCHAR(50) NOT NULL,
  rank_in_scope      INTEGER NOT NULL,
  value              INTEGER NOT NULL,
  wca_id             VARCHAR(20) NOT NULL,
  person_country_id  VARCHAR(50) NOT NULL,
  comp_id            VARCHAR(50) NOT NULL,
  comp_month         SMALLINT NOT NULL,
  attempts           INTEGER[],
  PRIMARY KEY (year, event_id, is_avg, country_filter, rank_in_scope)
);
CREATE INDEX IF NOT EXISTS yrt_month ON wca_year_results_top (year, event_id, is_avg, country_filter, comp_month);

-- ── wca_cohort_ranks: 参赛届别排行 (~10M 行) ──
-- 一行 = (cohort_year, event, is_avg, person):cohort_year=该选手第一次参赛的年份.
-- 累积最佳 + 在同届人中的世界/国家排名.
CREATE TABLE IF NOT EXISTS wca_cohort_ranks (
  cohort_year   SMALLINT NOT NULL,
  event_id      VARCHAR(20) NOT NULL,
  is_avg        BOOLEAN NOT NULL,
  wca_id        VARCHAR(20) NOT NULL,
  value         INTEGER NOT NULL,
  country_id    VARCHAR(50) NOT NULL,
  world_rank    INTEGER NOT NULL,
  country_rank  INTEGER NOT NULL,
  PRIMARY KEY (cohort_year, event_id, is_avg, wca_id)
);
CREATE INDEX IF NOT EXISTS coh_world ON wca_cohort_ranks (cohort_year, event_id, is_avg, world_rank);
CREATE INDEX IF NOT EXISTS coh_country ON wca_cohort_ranks (cohort_year, event_id, is_avg, country_id, country_rank);

-- ── wca_success_rate: 项目成功率 (~2M 行) ──
-- 一行 = (event, person):solved/attempted 计数 + percentage*10000(整数,稳定排序)
-- 只保留 attempted >= 3 的记录(filter 最小值)
CREATE TABLE IF NOT EXISTS wca_success_rate (
  event_id      VARCHAR(20) NOT NULL,
  wca_id        VARCHAR(20) NOT NULL,
  country_id    VARCHAR(50) NOT NULL,
  solved        INTEGER NOT NULL,
  attempted     INTEGER NOT NULL,
  pct_x10000    INTEGER NOT NULL,            -- 9999 = 99.99%
  PRIMARY KEY (event_id, wca_id)
);
CREATE INDEX IF NOT EXISTS sr_event ON wca_success_rate (event_id, pct_x10000 DESC, attempted DESC);
CREATE INDEX IF NOT EXISTS sr_event_country ON wca_success_rate (event_id, country_id, pct_x10000 DESC, attempted DESC);
CREATE INDEX IF NOT EXISTS sr_attempted ON wca_success_rate (event_id, attempted);

-- ── wca_all_events_done: 全项目达成排行榜 (~150k 行) ──
-- 一行 = 每个有过 WCA 成绩的人.
-- is_done=TRUE  → 已完成 17 项,days_to_complete 是从首参赛到达成日的天数
-- is_done=FALSE → 还差 (17 - done_count) 项
CREATE TABLE IF NOT EXISTS wca_all_events_done (
  wca_id                  VARCHAR(20) PRIMARY KEY,
  country_id              VARCHAR(50) NOT NULL,
  done_count              SMALLINT NOT NULL,
  is_done                 BOOLEAN NOT NULL,
  first_comp_id           VARCHAR(50),
  first_comp_date         DATE,
  achievement_comp_id     VARCHAR(50),
  achievement_comp_date   DATE,
  days_to_complete        INTEGER,
  total_comp_count        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS aed_done ON wca_all_events_done (is_done, days_to_complete);
CREATE INDEX IF NOT EXISTS aed_country_done ON wca_all_events_done (country_id, is_done, days_to_complete);

-- ── wca_person_ranks: 全项目排行 (~300k 行) ──
-- 一行 = (person, is_avg).每行存 17 项的 world_rank + country_rank 数组(对齐 ACTIVE_EVENTS 顺序).
-- 默认按 total_world_rank 排序;子集排序 API 用 array 索引算和.
-- "未登奖台" toggle = has_podium=FALSE.
CREATE TABLE IF NOT EXISTS wca_person_ranks (
  wca_id              VARCHAR(20) NOT NULL,
  is_avg              BOOLEAN NOT NULL,
  country_id          VARCHAR(50) NOT NULL,
  events_done         SMALLINT NOT NULL,
  total_world_rank    INTEGER NOT NULL,    -- SUM(world_rank);缺项=该项参赛人数+1
  total_country_rank  INTEGER NOT NULL,
  has_podium          BOOLEAN NOT NULL,    -- 任一项 world_rank<=3
  ranks_world         INTEGER[] NOT NULL,  -- 17 元素,对应 ACTIVE_EVENTS 顺序;0=该项无成绩
  ranks_country       INTEGER[] NOT NULL,
  PRIMARY KEY (wca_id, is_avg)
);
CREATE INDEX IF NOT EXISTS pr_total ON wca_person_ranks (is_avg, country_id, total_world_rank);
CREATE INDEX IF NOT EXISTS pr_country_total ON wca_person_ranks (is_avg, country_id, total_country_rank);

-- 元信息 — 沿用 meta_historical (key/value/updated_at),按 key 分:
--   wca_stats_extra_imported_at = 最近一次导入
