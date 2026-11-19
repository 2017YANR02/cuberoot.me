CREATE TABLE platform_homepage_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  featured_items JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(featured_items) = 'array' AND jsonb_array_length(featured_items) <= 12),
  sections JSONB NOT NULL DEFAULT '["popular", "weekly", "latest", "teacher", "organization", "event"]'::jsonb
    CHECK (jsonb_typeof(sections) = 'array' AND jsonb_array_length(sections) <= 6),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preserve the existing homepage's real featured course, if present and published.
INSERT INTO platform_homepage_settings (featured_items)
SELECT COALESCE(jsonb_agg(jsonb_build_object('type', 'course', 'id', id::text,
  'coverUrl', '/images/ruimin/gallery/photo-03.webp', 'startsAt', NULL, 'endsAt', NULL)), '[]'::jsonb)
FROM platform_courses WHERE slug = 'yan-ruimin-3x3-beginner' AND status = 'published';

CREATE INDEX idx_platform_course_entitlements_course ON platform_course_entitlements(course_id, created_at)
  WHERE status = 'active' AND user_id IS NOT NULL;
