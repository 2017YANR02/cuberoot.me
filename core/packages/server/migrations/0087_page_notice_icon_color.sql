-- 0087_page_notice_icon_color.sql — 给 page_notices 加可选图标 + 可选横幅颜色。
-- icon:空串 = 按 level 回退到默认图标(info/warning/maintenance);非空 = lucide 图标 key。
-- color:空串 = 按 level 回退到默认色;非空 = 调色板 key(blue/green/amber/red/terracotta/purple/cyan/pink)。
-- key 白名单见 client/components/PageNoticeBar.tsx (ICONS / COLORS) 与 server/routes/page_notices.ts。
ALTER TABLE page_notices ADD COLUMN IF NOT EXISTS icon  TEXT NOT NULL DEFAULT '';
ALTER TABLE page_notices ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '';
