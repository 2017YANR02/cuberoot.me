-- recons 加 visibility 列:YouTube 风格的三态可见性。
--   'public'   公开——出现在 /recon 列表、比赛页、首页「今日复盘」等所有发现入口
--   'unlisted' 不公开列出——不进任何列表,但有直链谁都能看(noindex)
--   'private'  私享——仅添加者本人(added_by_id)+ 管理员可见,其余人 /recon/:id 返回 403
-- 缺省 / 旧数据 = 'public'(与迁移前「所有人都能看」行为一致)。
-- 列表过滤 + 详情鉴权见 routes/recon.ts,校验见 utils/recon_helpers.ts validateRow。
ALTER TABLE recons ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'unlisted', 'private'));
