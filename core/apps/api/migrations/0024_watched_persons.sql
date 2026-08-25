-- 关注选手(PR 监控),替代本地 video-by-face/person 目录耦合。
CREATE TABLE watched_persons (
  wca_id    VARCHAR(12) PRIMARY KEY,
  match_key TEXT,
  note      TEXT,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 关注选手 PR 基线(厘秒),live PR 检测比对 + 自更新。
CREATE TABLE watched_pr_baseline (
  wca_id     VARCHAR(12) NOT NULL,
  event_id   VARCHAR(8)  NOT NULL,
  rec_type   VARCHAR(8)  NOT NULL,
  value      INTEGER     NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wca_id, event_id, rec_type)
);
