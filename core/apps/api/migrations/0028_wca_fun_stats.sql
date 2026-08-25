-- 0028_wca_fun_stats.sql — /wca/fun-stats 趣味统计 (port of cubingchina /results/statistics)
-- 15 张 wca_fs_* 预计算表,由 stats-build/wca_stats_extra_build.ts 全量重灌 (TRUNCATE + \copy)。
-- 所有表带 country 列 (per-person 当前/比赛时国籍 或 比赛国),支撑 world/continent/country region 过滤。
-- 数据流:builder 产 *.copy.tsv → scp → 生成的 load.sql TRUNCATE/\copy/ANALYZE。本文件只建表+索引。
-- 已 committed 后禁改本文件 body (sha 锁,见 memory feedback_migration_grep_exclude)。

-- ── A 各地综合排行 (country-aggregate sum-of-ranks) ──
CREATE TABLE IF NOT EXISTS wca_fs_country_ranks (
  is_avg          BOOLEAN     NOT NULL,
  country_id      VARCHAR(50) NOT NULL,
  sum             INTEGER     NOT NULL,
  events_present  SMALLINT    NOT NULL,
  per_event_rank  INTEGER[]   NOT NULL,        -- 17 元素 (ACTIVE_EVENTS 顺序);world rank 或 penalty;0=不参与(avg mbf)
  PRIMARY KEY (is_avg, country_id)
);
CREATE INDEX IF NOT EXISTS wfs_cr_sum ON wca_fs_country_ranks (is_avg, sum, country_id);

CREATE TABLE IF NOT EXISTS wca_fs_country_ranks_meta (
  is_avg         BOOLEAN  PRIMARY KEY,
  penalties      INTEGER[] NOT NULL,           -- 17 元素,每项 MAX(world_rank)+1;0=该项无人(avg mbf)
  all_penalties  INTEGER  NOT NULL
);

-- ── B 奖牌 & 名次 ──
CREATE TABLE IF NOT EXISTS wca_fs_medals (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,            -- 当前国籍
  event_id    VARCHAR(20) NOT NULL,            -- 单项 id 或 '__all__'
  gold        INTEGER NOT NULL,
  silver      INTEGER NOT NULL,
  bronze      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wfm_event_country ON wca_fs_medals (event_id, country_id);
CREATE INDEX IF NOT EXISTS wfm_event_sort    ON wca_fs_medals (event_id, gold DESC, silver DESC, bronze DESC);
CREATE INDEX IF NOT EXISTS wfm_wca           ON wca_fs_medals (wca_id);

CREATE TABLE IF NOT EXISTS wca_fs_placements (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,            -- 比赛时国籍 (per-result)
  event_id    VARCHAR(20) NOT NULL,            -- 单项 id 或 '__all__'
  pos         SMALLINT NOT NULL,               -- 2 或 4
  count       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wfp_pos_event_country ON wca_fs_placements (pos, event_id, country_id);
CREATE INDEX IF NOT EXISTS wfp_pos_event_sort    ON wca_fs_placements (pos, event_id, count DESC);
CREATE INDEX IF NOT EXISTS wfp_wca              ON wca_fs_placements (wca_id);

CREATE TABLE IF NOT EXISTS wca_fs_best_podiums (
  comp_id      VARCHAR(50) NOT NULL,
  event_id     VARCHAR(20) NOT NULL,
  sum_value    BIGINT NOT NULL,                 -- BIGINT: 333mbf 编码值 ~9.9e8/解,三人和 ~2.9e9 溢出 INT32
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

-- ── C 遗憾榜 (best-misser) ──
CREATE TABLE IF NOT EXISTS wca_fs_misser (
  event_id     VARCHAR(20) NOT NULL,
  is_avg       BOOLEAN NOT NULL,
  value        INTEGER NOT NULL,
  wca_id       VARCHAR(20) NOT NULL,
  country_id   VARCHAR(50) NOT NULL,           -- 比赛时国籍 (per-result)
  ever_first   BOOLEAN NOT NULL,
  ever_podium  BOOLEAN NOT NULL,
  ever_record  BOOLEAN NOT NULL                -- 与 is_avg 匹配的纪录类型
);
CREATE INDEX IF NOT EXISTS wfs_misser_ctry ON wca_fs_misser (event_id, is_avg, country_id, value, wca_id)
  INCLUDE (ever_first, ever_podium, ever_record);
CREATE INDEX IF NOT EXISTS wfs_misser_evt ON wca_fs_misser (event_id, is_avg, value, wca_id)
  INCLUDE (country_id, ever_first, ever_podium, ever_record);

-- ── D 纪录 ──
CREATE TABLE IF NOT EXISTS wca_fs_records_person (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,            -- 比赛时国籍 (per-result)
  wr          INTEGER NOT NULL DEFAULT 0,
  cr          INTEGER NOT NULL DEFAULT 0,
  nr          INTEGER NOT NULL DEFAULT 0,
  score       INTEGER NOT NULL DEFAULT 0,      -- wr*10 + cr*5 + nr*1
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
  scope_kind      CHAR(1) NOT NULL,            -- 'W' world | 'K' continent | 'N' country
  scope_id        VARCHAR(50) NOT NULL DEFAULT '',  -- '' | continent_id | country_id
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

-- ── E 参赛 & 复原次数 ──
CREATE TABLE IF NOT EXISTS wca_fs_person_comps (
  wca_id      VARCHAR(20) PRIMARY KEY,
  country_id  VARCHAR(50) NOT NULL,            -- 当前国籍
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
  country_id  VARCHAR(50) NOT NULL,            -- 当前国籍
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
  country_id  VARCHAR(50) NOT NULL,            -- 当前国籍
  solve       INTEGER NOT NULL,
  attempt     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fs_ps_rank    ON wca_fs_person_solves (solve DESC, attempt ASC, wca_id);
CREATE INDEX IF NOT EXISTS fs_ps_country ON wca_fs_person_solves (country_id, solve DESC, attempt ASC, wca_id);

CREATE TABLE IF NOT EXISTS wca_fs_person_year_solves (
  wca_id      VARCHAR(20) NOT NULL,
  country_id  VARCHAR(50) NOT NULL,            -- 当前国籍
  year        SMALLINT NOT NULL,
  solve       INTEGER NOT NULL,
  attempt     INTEGER NOT NULL,
  PRIMARY KEY (wca_id, year)
);
CREATE INDEX IF NOT EXISTS fs_pys_rank    ON wca_fs_person_year_solves (year, solve DESC, attempt ASC, wca_id);
CREATE INDEX IF NOT EXISTS fs_pys_country ON wca_fs_person_year_solves (year, country_id, solve DESC, attempt ASC, wca_id);
