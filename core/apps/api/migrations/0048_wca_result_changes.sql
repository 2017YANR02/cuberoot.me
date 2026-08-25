-- 关注选手「往期成绩变更」监控(成绩取消 / 修正 / 纪录标记变动 / 整条移除)。
-- 数据流:wca_past_results 监控每 N 小时拉一次 watched_persons 每人的全生涯成绩
-- (WCA /api/v0/persons/:id/results),与上次快照逐条比对,检出 removed / modified 写入变更日志。
-- /wca/result-watch 页只读这两张表;首页式实时推送复用 Bark(同 MONITOR_PUSH_ENABLED 门)。

-- 每位关注选手最近一次抓取的成绩快照。results_json 是 { [resultId]: fingerprint } 映射,
-- fingerprint 仅含会变动的字段(成绩/名次/单步/纪录标记),content_hash 用于整体未变快速跳过。
CREATE TABLE wca_person_results_snapshot (
  wca_id        VARCHAR(12) PRIMARY KEY,
  person_name   TEXT,                       -- WCA 档案名(含括号本地名),读端直接用
  country_iso2  VARCHAR(2),
  results_json  JSONB       NOT NULL,        -- { [resultId]: {c,e,r,f,b,a,p,at,rs,ra} }
  result_count  INTEGER     NOT NULL DEFAULT 0,
  content_hash  TEXT        NOT NULL,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 每轮都刷新(无论是否变动)
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- 仅快照内容变动时刷新
);

-- 检出的成绩变更日志(append-only)。一条 = 某选手某条成绩被移除或被修改。
CREATE TABLE wca_result_changes (
  id             BIGSERIAL PRIMARY KEY,
  wca_id         VARCHAR(12) NOT NULL,
  result_id      BIGINT,                     -- WCA result.id;removed 时仍记原 id
  competition_id VARCHAR(40),
  event_id       VARCHAR(8),
  round_type_id  VARCHAR(4),
  change_type    VARCHAR(12) NOT NULL,       -- 'removed' | 'modified'
  fields         JSONB,                      -- modified: [{field, old, new}];removed: null
  before_json    JSONB,                      -- 变更前 fingerprint
  after_json     JSONB,                      -- 变更后 fingerprint(removed 时 null)
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wrc_detected ON wca_result_changes (detected_at DESC);
CREATE INDEX idx_wrc_person   ON wca_result_changes (wca_id, detected_at DESC);
