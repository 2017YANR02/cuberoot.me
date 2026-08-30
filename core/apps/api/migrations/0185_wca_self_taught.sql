ALTER TABLE wca_teachers
  ALTER COLUMN teacher_wca_id DROP NOT NULL,
  ALTER COLUMN teacher_name DROP NOT NULL;

ALTER TABLE wca_teachers
  ADD CONSTRAINT wca_teachers_learning_source
  CHECK (
    (teacher_wca_id IS NULL AND teacher_name IS NULL)
    OR (teacher_wca_id IS NOT NULL AND teacher_name IS NOT NULL)
  );
