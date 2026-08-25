-- 桌宠「反馈」入口:需求 / Bug / 其他。任何登录 WCA 用户可提(requireAuth)。
-- runner 自动包事务,勿写 BEGIN/COMMIT。
--
-- feedback        = 一条反馈正文 + 提交时自动捕获的环境(页面/语言/主题/视口/UA),便于复现。
-- feedback_media  = 附件。截图存 bytea(data,沿用 article_image);短视频落磁盘只存 disk_path
--                   (不进 PG → 不进每日 pg_dump 备份)。两类都经 admin-gated
--                   GET /v1/feedback/media/:id 取,不公开(可能含用户私密屏幕内容)。

CREATE TABLE feedback (
  id          BIGSERIAL PRIMARY KEY,
  kind        VARCHAR(12) NOT NULL DEFAULT 'other',   -- 'need' | 'bug' | 'other'
  body        TEXT        NOT NULL,
  wca_id      VARCHAR(20) NOT NULL,
  wca_name    TEXT        NOT NULL DEFAULT '',
  contact     TEXT,                                   -- 可选回信渠道(邮箱等)
  page_url    TEXT,                                   -- 反馈时所在页面
  lang        VARCHAR(8),
  theme       VARCHAR(16),
  viewport    VARCHAR(24),                            -- 'WxH'
  user_agent  TEXT,
  status      VARCHAR(12) NOT NULL DEFAULT 'new',     -- 'new' | 'triaged' | 'done'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feedback_created ON feedback (created_at DESC);
CREATE INDEX idx_feedback_status  ON feedback (status, created_at DESC);
CREATE INDEX idx_feedback_wca     ON feedback (wca_id, created_at DESC);

CREATE TABLE feedback_media (
  id          BIGSERIAL PRIMARY KEY,
  feedback_id BIGINT      NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  kind        VARCHAR(8)  NOT NULL,                   -- 'image' | 'video'
  mime        VARCHAR(40) NOT NULL,
  size_bytes  INTEGER     NOT NULL,
  width       INTEGER,
  height      INTEGER,
  duration_ms INTEGER,                                -- video 客户端测量(best-effort)
  data        BYTEA,                                  -- image: 内联;video: NULL
  disk_path   TEXT,                                   -- video: 媒体目录下相对路径;image: NULL
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feedback_media_fb ON feedback_media (feedback_id);
