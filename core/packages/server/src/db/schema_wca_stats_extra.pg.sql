-- WCA stats extra (2026-05) — 6 个 cubing.pro 风格的统计 tab
-- 与 schema_historical_ranks.pg.sql 共存,在 cuberoot_db 里.
-- 数据流相同:CI runner 计算 → scp TSV → server psql -f load.sql 原子替换.
--
-- 6 个表:
--   wca_grand_slam        : 大满贯(WC + Continental + National 领奖台 + WR)
--   wca_results_top       : 全部成绩排行(top 5000 ww + top 500/country, per event×type)
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
-- `_top` 是历史名:最初是 top 5000 ww + top 500/country,后扩成全量,名字保留避免 rename.
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
  attempts           INTEGER[],               -- 5 次 raw 值(WCA 编码)
  -- 末尾 3 列服务 /comp 页面 fast-path: 按 comp_id 拉所有 round 成绩;is_avg=false/true 两行合成一条
  round_type_id      VARCHAR(2) NOT NULL DEFAULT '',
  format_id          VARCHAR(2) NOT NULL DEFAULT '',
  record_tag         VARCHAR(3) NOT NULL DEFAULT ''   -- single(is_avg=false 时) 或 average(is_avg=true 时) 的 regional_*_record (AsR/NAR/SAR/OcR/AfR 3 字符)
);
-- 主索引: ORDER BY value LIMIT/OFFSET — 全量翻页主路径
CREATE INDEX IF NOT EXISTS wrt_main ON wca_results_top (event_id, is_avg, value, wca_id);
-- 国家过滤路径(走索引按 value 排序)
CREATE INDEX IF NOT EXISTS wrt_country ON wca_results_top (event_id, is_avg, person_country_id, value);
-- 选手 / 比赛搜索路径(IN list);q 命中条数少,走该索引比 main + filter 快
CREATE INDEX IF NOT EXISTS wrt_wca_id ON wca_results_top (event_id, is_avg, wca_id, value);
CREATE INDEX IF NOT EXISTS wrt_comp_id ON wca_results_top (event_id, is_avg, comp_id, value);
-- /comp 页面 fast-path: 单 comp 拉全部成绩,无 event 过滤
CREATE INDEX IF NOT EXISTS wrt_comp_lookup ON wca_results_top (comp_id);
-- /comp/<id> 赛前 PR 查询专用,见 migrations/0007_wrt_prior_pr_index.sql
CREATE INDEX IF NOT EXISTS wrt_prior_pr ON wca_results_top (wca_id, event_id, is_avg, comp_date) INCLUDE (value);
-- 排名页"当期·年" + "截至·年(comp_year<=)":走 wrt_year(comp_year 是 stored 生成列)
CREATE INDEX IF NOT EXISTS wrt_year ON wca_results_top (event_id, is_avg, comp_year, value, wca_id) INCLUDE (id);
-- 排名页"当期·月"(选手模式 DISTINCT ON 切片):月份用表达式进索引,免整表改写;替代旧 wrt_country_year
CREATE INDEX IF NOT EXISTS wrt_month ON wca_results_top (event_id, is_avg, comp_year, ((EXTRACT(MONTH FROM comp_date))::int), value, wca_id);
-- 注:实际 DDL 以 wca_stats_extra_build.ts 的 loadSql 为准(此文件仅参考,apply.sh 不调)

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
-- 一行 = (person, is_avg).每行存 21 项 (RANK_EVENTS: 17 活跃 + 4 废止) 的 world_rank + country_rank 数组.
-- 默认按 total_world_rank 排序;子集排序 API 用 array 索引算和.
-- "未登奖台" toggle = (best_final_pos = 0 OR best_final_pos > 3);
-- "殿军之王" = best_final_pos = 4.
CREATE TABLE IF NOT EXISTS wca_person_ranks (
  wca_id              VARCHAR(20) NOT NULL,
  is_avg              BOOLEAN NOT NULL,
  country_id          VARCHAR(50) NOT NULL,
  continent_id        VARCHAR(50) NOT NULL DEFAULT '',  -- 该选手当前国籍所属大洲(分桶/索引用);migration 0038 加
  events_done         SMALLINT NOT NULL,
  total_world_rank    INTEGER NOT NULL,    -- SUM(world_rank);缺项=该项参赛人数+1
  total_country_rank  INTEGER NOT NULL,
  total_continent_rank INTEGER NOT NULL DEFAULT 0,      -- SUM(continent_rank);缺项=该洲该项参赛人数+1;migration 0038 加
  best_final_pos      SMALLINT NOT NULL,   -- 跨 event 累积:final round (round_type c/f) 的 MIN(pos>0);0=从未在 final 拿过有效成绩
  ranks_world         INTEGER[] NOT NULL,  -- 21 元素,对应 RANK_EVENTS 顺序 (0-16 活跃,17-20 废止);0=该项无成绩
  ranks_country       INTEGER[] NOT NULL,
  total_world_rank_21    INTEGER NOT NULL DEFAULT 0,  -- 21 项口径(含 4 废止)名次和;migration 0039 加
  total_country_rank_21  INTEGER NOT NULL DEFAULT 0,
  total_continent_rank_21 INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wca_id, is_avg)
);
CREATE INDEX IF NOT EXISTS pr_total ON wca_person_ranks (is_avg, country_id, total_world_rank);
CREATE INDEX IF NOT EXISTS pr_country_total ON wca_person_ranks (is_avg, country_id, total_country_rank);
CREATE INDEX IF NOT EXISTS pr_continent_total ON wca_person_ranks (is_avg, continent_id, total_continent_rank);
CREATE INDEX IF NOT EXISTS pr_total_21 ON wca_person_ranks (is_avg, country_id, total_world_rank_21);
CREATE INDEX IF NOT EXISTS pr_country_total_21 ON wca_person_ranks (is_avg, country_id, total_country_rank_21);
CREATE INDEX IF NOT EXISTS pr_continent_total_21 ON wca_person_ranks (is_avg, continent_id, total_continent_rank_21);

-- 元信息 — 沿用 meta_historical (key/value/updated_at),按 key 分:
--   wca_stats_extra_imported_at = 最近一次导入

-- ════════════════════════════════════════════════════════════════════════
-- /wca/fun-stats 趣味统计 (port of cubingchina) — 15 张 wca_fs_* 预计算表。
-- 镜像自 migrations/0028_wca_fun_stats.sql (live prod 唯一改 schema 入口;本块仅 fresh-DB bootstrap)。
-- builder 全量重灌;所有表带 country 列支撑 world/continent/country 过滤。
-- ════════════════════════════════════════════════════════════════════════

-- A 各地综合排行
CREATE TABLE IF NOT EXISTS wca_fs_country_ranks (
  is_avg          BOOLEAN     NOT NULL,
  country_id      VARCHAR(50) NOT NULL,
  sum             INTEGER     NOT NULL,
  events_present  SMALLINT    NOT NULL,
  per_event_rank  INTEGER[]   NOT NULL,
  PRIMARY KEY (is_avg, country_id)
);
CREATE INDEX IF NOT EXISTS wfs_cr_sum ON wca_fs_country_ranks (is_avg, sum, country_id);

CREATE TABLE IF NOT EXISTS wca_fs_country_ranks_meta (
  is_avg         BOOLEAN  PRIMARY KEY,
  penalties      INTEGER[] NOT NULL,
  all_penalties  INTEGER  NOT NULL
);

-- B 奖牌 & 名次
CREATE TABLE IF NOT EXISTS wca_fs_medals (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,
  event_id    VARCHAR(20) NOT NULL,
  gold        INTEGER NOT NULL,
  silver      INTEGER NOT NULL,
  bronze      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wfm_event_country ON wca_fs_medals (event_id, country_id);
CREATE INDEX IF NOT EXISTS wfm_event_sort    ON wca_fs_medals (event_id, gold DESC, silver DESC, bronze DESC);
CREATE INDEX IF NOT EXISTS wfm_wca           ON wca_fs_medals (wca_id);

CREATE TABLE IF NOT EXISTS wca_fs_placements (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,
  event_id    VARCHAR(20) NOT NULL,
  pos         SMALLINT NOT NULL,
  count       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wfp_pos_event_country ON wca_fs_placements (pos, event_id, country_id);
CREATE INDEX IF NOT EXISTS wfp_pos_event_sort    ON wca_fs_placements (pos, event_id, count DESC);
CREATE INDEX IF NOT EXISTS wfp_wca              ON wca_fs_placements (wca_id);

CREATE TABLE IF NOT EXISTS wca_fs_best_podiums (
  comp_id      VARCHAR(50) NOT NULL,
  event_id     VARCHAR(20) NOT NULL,
  sum_value    BIGINT NOT NULL,                 -- BIGINT: 333mbf 编码值三人和 ~2.9e9 溢出 INT32
  pos1_wca_id  VARCHAR(20) NOT NULL,
  pos1_value   BIGINT NOT NULL,
  pos2_wca_id  VARCHAR(20) NOT NULL,
  pos2_value   BIGINT NOT NULL,
  pos3_wca_id  VARCHAR(20) NOT NULL,
  pos3_value   BIGINT NOT NULL,
  tie          BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS wfbp_event_sort ON wca_fs_best_podiums (event_id, sum_value ASC);
CREATE INDEX IF NOT EXISTS wfbp_comp       ON wca_fs_best_podiums (comp_id);

-- C 遗憾榜
CREATE TABLE IF NOT EXISTS wca_fs_misser (
  event_id     VARCHAR(20) NOT NULL,
  is_avg       BOOLEAN NOT NULL,
  value        INTEGER NOT NULL,
  wca_id       VARCHAR(20) NOT NULL,
  country_id   VARCHAR(50) NOT NULL,
  ever_first   BOOLEAN NOT NULL,
  ever_podium  BOOLEAN NOT NULL,
  ever_record  BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS wfs_misser_ctry ON wca_fs_misser (event_id, is_avg, country_id, value, wca_id)
  INCLUDE (ever_first, ever_podium, ever_record);
CREATE INDEX IF NOT EXISTS wfs_misser_evt ON wca_fs_misser (event_id, is_avg, value, wca_id)
  INCLUDE (country_id, ever_first, ever_podium, ever_record);

-- D 纪录
CREATE TABLE IF NOT EXISTS wca_fs_records_person (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,
  wr          INTEGER NOT NULL DEFAULT 0,
  cr          INTEGER NOT NULL DEFAULT 0,
  nr          INTEGER NOT NULL DEFAULT 0,
  score       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wca_id, country_id)
);
CREATE INDEX IF NOT EXISTS fs_recp_score   ON wca_fs_records_person (score DESC, wr DESC, cr DESC, nr DESC, wca_id);
CREATE INDEX IF NOT EXISTS fs_recp_country ON wca_fs_records_person (country_id, score DESC);

CREATE TABLE IF NOT EXISTS wca_fs_records_comp (
  comp_id          VARCHAR(50) NOT NULL,
  comp_country_id  VARCHAR(50) NOT NULL,
  wr               INTEGER NOT NULL DEFAULT 0,
  cr               INTEGER NOT NULL DEFAULT 0,
  nr               INTEGER NOT NULL DEFAULT 0,
  score            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (comp_id)
);
CREATE INDEX IF NOT EXISTS fs_recc_score   ON wca_fs_records_comp (score DESC, wr DESC, cr DESC, nr DESC, comp_id);
CREATE INDEX IF NOT EXISTS fs_recc_country ON wca_fs_records_comp (comp_country_id, score DESC);

CREATE TABLE IF NOT EXISTS wca_fs_current_records (
  event_id        VARCHAR(20) NOT NULL,
  is_avg          BOOLEAN NOT NULL,
  scope_kind      CHAR(1) NOT NULL,
  scope_id        VARCHAR(50) NOT NULL DEFAULT '',
  wca_id          VARCHAR(20) NOT NULL,
  country_id      VARCHAR(50) NOT NULL,
  value           INTEGER NOT NULL,
  set_comp_id     VARCHAR(50) NOT NULL DEFAULT '',
  set_date        DATE,
  world_rank      INTEGER,
  continent_rank  INTEGER,
  country_rank    INTEGER,
  PRIMARY KEY (event_id, is_avg, scope_kind, scope_id)
);
CREATE INDEX IF NOT EXISTS fs_curr_scope ON wca_fs_current_records (scope_kind, scope_id, set_date);

-- E 参赛 & 复原次数
CREATE TABLE IF NOT EXISTS wca_fs_person_comps (
  wca_id      VARCHAR(20) PRIMARY KEY,
  country_id  VARCHAR(50) NOT NULL,
  comp_count  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fs_pc_rank    ON wca_fs_person_comps (comp_count DESC, wca_id);
CREATE INDEX IF NOT EXISTS fs_pc_country ON wca_fs_person_comps (country_id, comp_count DESC, wca_id);

CREATE TABLE IF NOT EXISTS wca_fs_comp_persons (
  comp_id          VARCHAR(50) PRIMARY KEY,
  comp_country_id  VARCHAR(50) NOT NULL,
  person_count     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fs_cp_rank    ON wca_fs_comp_persons (person_count DESC, comp_id);
CREATE INDEX IF NOT EXISTS fs_cp_country ON wca_fs_comp_persons (comp_country_id, person_count DESC, comp_id);

CREATE TABLE IF NOT EXISTS wca_fs_person_comp_solves (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,
  comp_id     VARCHAR(50) NOT NULL,
  solve       INTEGER NOT NULL,
  attempt     INTEGER NOT NULL,
  PRIMARY KEY (wca_id, comp_id)
);
CREATE INDEX IF NOT EXISTS fs_pcs_best    ON wca_fs_person_comp_solves (wca_id, solve DESC, attempt ASC, comp_id);
CREATE INDEX IF NOT EXISTS fs_pcs_country ON wca_fs_person_comp_solves (country_id, wca_id, solve DESC, attempt ASC, comp_id);

CREATE TABLE IF NOT EXISTS wca_fs_comp_solves (
  comp_id          VARCHAR(50) PRIMARY KEY,
  comp_country_id  VARCHAR(50) NOT NULL,
  solve            INTEGER NOT NULL,
  attempt          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fs_cs_rank    ON wca_fs_comp_solves (solve DESC, attempt ASC, comp_id);
CREATE INDEX IF NOT EXISTS fs_cs_country ON wca_fs_comp_solves (comp_country_id, solve DESC, attempt ASC, comp_id);

CREATE TABLE IF NOT EXISTS wca_fs_person_solves (
  wca_id      VARCHAR(20) PRIMARY KEY,
  country_id  VARCHAR(50) NOT NULL,
  solve       INTEGER NOT NULL,
  attempt     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fs_ps_rank    ON wca_fs_person_solves (solve DESC, attempt ASC, wca_id);
CREATE INDEX IF NOT EXISTS fs_ps_country ON wca_fs_person_solves (country_id, solve DESC, attempt ASC, wca_id);

CREATE TABLE IF NOT EXISTS wca_fs_person_year_solves (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,
  year        SMALLINT NOT NULL,
  solve       INTEGER NOT NULL,
  attempt     INTEGER NOT NULL,
  PRIMARY KEY (wca_id, year)
);
CREATE INDEX IF NOT EXISTS fs_pys_rank    ON wca_fs_person_year_solves (year, solve DESC, attempt ASC, wca_id);
CREATE INDEX IF NOT EXISTS fs_pys_country ON wca_fs_person_year_solves (year, country_id, solve DESC, attempt ASC, wca_id);
