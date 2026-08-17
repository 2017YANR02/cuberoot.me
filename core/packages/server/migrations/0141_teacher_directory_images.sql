ALTER TABLE teacher_directory_entries
  ADD COLUMN images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT teacher_directory_images_array CHECK (jsonb_typeof(images) = 'array');
