-- 小程序原生登录态向 web-view 网页环境换取网站会话的一次性票据。
-- 只保存随机票据的 SHA-256；短时、单次核销，长期 JWT 不进入 URL。
CREATE TABLE auth_web_session_tickets (
  ticket_hash CHAR(64) PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_web_session_tickets_expires
  ON auth_web_session_tickets(expires_at);
