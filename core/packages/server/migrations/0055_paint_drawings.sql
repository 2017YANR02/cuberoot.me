-- /paint 云作品库:登录用户的矢量画作多图存储,跨设备同步(换设备重新登录可见)。
-- 身份取 JWT(requireAuth.wcaId),客户端不传 wca_id。一个用户多行(多张作品)。
-- doc 是 JSON.stringify(PaintDoc {shapes, order, paper}) 存 TEXT —— 服务端不查文档内部,
-- 走 TEXT-JSON 避开 jsonb driver 坑(同 timer_backups.blob / recon co_persons 套路)。
-- thumbnail 是小 PNG dataURL(可空)给作品库网格预览。不设 FK:同 timer_backups,
-- requireAuth 不保证 wca_users 行。
CREATE TABLE IF NOT EXISTS paint_drawings (
  id          SERIAL       PRIMARY KEY,
  wca_id      VARCHAR(20)  NOT NULL,
  title       VARCHAR(120) NOT NULL DEFAULT 'Untitled',
  doc         TEXT         NOT NULL,
  thumbnail   TEXT,
  byte_size   INTEGER      NOT NULL DEFAULT 0,
  created_at  BIGINT       NOT NULL,
  updated_at  BIGINT       NOT NULL
);
-- 拉某用户的作品列表(GET /v1/paint/drawings,按最近更新排序)。
CREATE INDEX IF NOT EXISTS idx_paint_drawings_user ON paint_drawings(wca_id, updated_at DESC);
