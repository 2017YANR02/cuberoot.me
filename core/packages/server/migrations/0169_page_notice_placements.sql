-- 0169_page_notice_placements.sql — 页面通知增加展示位、目标链接与生效时间窗。
-- 同一路径可同时保留顶部运维通知与首页焦点新闻；公开接口只返回当前生效的行。

ALTER TABLE page_notices
  ADD COLUMN placement TEXT NOT NULL DEFAULT 'page_top',
  ADD COLUMN href TEXT NOT NULL DEFAULT '',
  ADD COLUMN starts_at TIMESTAMPTZ,
  ADD COLUMN ends_at TIMESTAMPTZ;

ALTER TABLE page_notices DROP CONSTRAINT page_notices_path_key;
ALTER TABLE page_notices
  ADD CONSTRAINT page_notices_placement_check
    CHECK (placement IN ('page_top', 'home_featured')),
  ADD CONSTRAINT page_notices_href_check
    CHECK (href = '' OR href = '/' OR href ~ '^/[^/]' OR href ~ '^https?://'),
  ADD CONSTRAINT page_notices_time_window_check
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  ADD CONSTRAINT page_notices_path_placement_key UNIQUE (path, placement);

INSERT INTO page_notices (
  path, placement, level, icon, color, body_en, body_zh,
  href, enabled, dismissible
)
VALUES (
  '/',
  'home_featured',
  'info',
  'megaphone',
  'terracotta',
  'From January 2, 2027, all official WCA attempts performed with a speedsolving timer must use a Speed Stacks G5 StackMat™ Pro Timer in 4-pad mode; existing records will not be reset.',
  '2027 年 1 月 2 日起，所有使用速拧计时器完成的 WCA 官方尝试，必须使用 Speed Stacks G5 StackMat™ Pro Timer 的 4-pad 模式；现有纪录不会重置。',
  '/regulation/news#4-pad-2027',
  TRUE,
  FALSE
)
ON CONFLICT (path, placement) DO UPDATE SET
  level = EXCLUDED.level,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  body_en = EXCLUDED.body_en,
  body_zh = EXCLUDED.body_zh,
  href = EXCLUDED.href,
  enabled = EXCLUDED.enabled,
  dismissible = EXCLUDED.dismissible,
  updated_at = NOW();
