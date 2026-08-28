-- Named students have no WCA profile, so their nationality belongs to the roster entry.
ALTER TABLE wca_teacher_named_students
  ADD COLUMN country_iso2 VARCHAR(2)
  CHECK (country_iso2 IS NULL OR country_iso2 ~ '^[A-Z]{2}$');

-- Existing rows default to the teacher's WCA nationality when it is available.
UPDATE wca_teacher_named_students student
   SET country_iso2 = UPPER(country.iso2)
  FROM wca_persons teacher
  JOIN wca_countries country ON country.id = teacher.country_id
 WHERE teacher.wca_id = student.teacher_wca_id
   AND country.iso2 ~* '^[A-Z]{2}$';

ALTER TABLE wca_teacher_named_students
  ALTER COLUMN country_iso2 SET NOT NULL;

-- A teacher edits an existing roster entry instead of creating the same named student twice.
CREATE UNIQUE INDEX uq_wca_teacher_named_students_teacher_name
  ON wca_teacher_named_students(teacher_wca_id, LOWER(student_name));
