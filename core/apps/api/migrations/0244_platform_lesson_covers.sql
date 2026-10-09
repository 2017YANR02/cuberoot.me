ALTER TABLE platform_lesson_revisions
  ADD COLUMN cover_media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL;
