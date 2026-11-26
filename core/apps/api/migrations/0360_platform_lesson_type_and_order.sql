ALTER TABLE platform_lessons
  ADD COLUMN lesson_type VARCHAR(20) CHECK (lesson_type IN ('introduction', 'core')),
  DROP CONSTRAINT platform_lessons_course_id_ordinal_key,
  ADD CONSTRAINT platform_lessons_course_id_ordinal_key UNIQUE (course_id, ordinal) DEFERRABLE INITIALLY IMMEDIATE;
