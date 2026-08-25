-- 反馈对话:把单向反馈升级成 GitHub issue 式来回对话。
-- feedback 本体的 body 仍是「开帖」(第 0 条);后续往来存 feedback_messages。
-- 读状态:user_read_at / admin_read_at 各记录该方最后读到的时刻;
--   last_reply_at / last_reply_role 记录最后一条往来,用于未读判定 + 列表排序。
-- 未读(用户)= last_reply_role='admin' AND (user_read_at IS NULL OR last_reply_at > user_read_at)。
-- 未读(管理)= 最后动作来自用户(含仅开帖) AND (admin_read_at IS NULL OR 活跃时刻 > admin_read_at)。
-- runner 自动包事务,勿写 BEGIN/COMMIT。

ALTER TABLE feedback ADD COLUMN last_reply_at   TIMESTAMPTZ;
ALTER TABLE feedback ADD COLUMN last_reply_role VARCHAR(8);   -- 'user' | 'admin' | NULL(仅开帖)
ALTER TABLE feedback ADD COLUMN user_read_at    TIMESTAMPTZ;
ALTER TABLE feedback ADD COLUMN admin_read_at   TIMESTAMPTZ;

CREATE TABLE feedback_messages (
  id          BIGSERIAL PRIMARY KEY,
  feedback_id BIGINT      NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  role        VARCHAR(8)  NOT NULL,                   -- 'user'(发帖人) | 'admin'(管理员)
  wca_id      VARCHAR(20) NOT NULL,
  wca_name    TEXT        NOT NULL DEFAULT '',
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feedback_messages_fb ON feedback_messages (feedback_id, created_at);
