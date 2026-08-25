-- 0087_page_notice_icon.sql — 给 page_notices 加可选图标 key。
-- 空串 = 按 level 回退到默认图标(info/warning/maintenance);非空 = 前端 ICONS 白名单里的 lucide key。
-- 见 client/components/PageNoticeBar.tsx 的 ICONS 与 server/routes/page_notices.ts 的 ICON_KEYS。
ALTER TABLE page_notices ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';
