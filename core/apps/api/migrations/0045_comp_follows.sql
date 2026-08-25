-- 比赛关注（首页「报名」标签的「盯一下」）：登录用户标记想盯的比赛，跨设备同步。
-- 身份取 JWT（requireAuth），客户端不传 wca_id。一个用户一条 (wca_id, comp_id)。
-- 不设 FK：comp_id 是 WCA competitionId 字符串，server 无本地 competitions 全表镜像，
-- 比赛存在性由客户端展示层（all_upcoming_comps.json）兜底。
CREATE TABLE IF NOT EXISTS comp_follows (
  wca_id      VARCHAR(20) NOT NULL,
  comp_id     VARCHAR(64) NOT NULL,
  created_at  BIGINT      NOT NULL,
  PRIMARY KEY (wca_id, comp_id)
);
-- 拉某用户的关注列表（GET /v1/comp/follows）。
CREATE INDEX IF NOT EXISTS idx_comp_follows_user ON comp_follows(wca_id);
