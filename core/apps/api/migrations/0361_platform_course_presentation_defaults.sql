ALTER TABLE platform_courses
  ADD COLUMN presentation_defaults JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(presentation_defaults) = 'object');

-- Supply defaults for historical catalog data without rewriting sealed revisions.
UPDATE platform_courses
SET presentation_defaults = '{
  "levelZh": "零基础学员",
  "levelEn": "Absolute beginners",
  "summaryZh": "用层先法，从十字开始学到独立复原。",
  "summaryEn": "Learn the layer-by-layer method, from the first cross to solving on your own.",
  "targetZh": "独立使用层先法复原三阶",
  "targetEn": "Solve a 3×3 independently using layer-by-layer",
  "tags": ["puzzle:333", "topic:beginner"],
  "coverUrl": "/images/ruimin/gallery/photo-03.webp",
  "mobileCoverUrl": "/images/ruimin/gallery/course-cover-portrait.webp"
}'::jsonb
WHERE slug = 'yan-ruimin-3x3-beginner';
