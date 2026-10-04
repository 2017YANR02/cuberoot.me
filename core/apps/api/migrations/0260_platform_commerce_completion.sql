ALTER TABLE platform_products
  ADD COLUMN category VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN member_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN presentation JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(presentation)='object');

ALTER TABLE platform_events
  ADD COLUMN category VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN program JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(program)='array');

ALTER TABLE platform_news_articles
  ADD COLUMN category VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN excerpt_zh TEXT NOT NULL DEFAULT '',
  ADD COLUMN excerpt_en TEXT NOT NULL DEFAULT '';
