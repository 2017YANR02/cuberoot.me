-- Let teachers keep a roster for students who do not have a WCA ID yet.
CREATE TABLE wca_teacher_named_students (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_wca_id VARCHAR(20)  NOT NULL,
  student_name   VARCHAR(160) NOT NULL,
  created_by     VARCHAR(20)  NOT NULL,
  updated_by     VARCHAR(20)  NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (length(trim(student_name)) BETWEEN 1 AND 160)
);
CREATE INDEX idx_wca_teacher_named_students_teacher
  ON wca_teacher_named_students(teacher_wca_id, student_name, id);
CREATE TRIGGER wca_teacher_named_students_updated_at
  BEFORE UPDATE ON wca_teacher_named_students
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE wca_teacher_named_student_events (
  student_id UUID        NOT NULL REFERENCES wca_teacher_named_students(id) ON DELETE CASCADE,
  event_id   VARCHAR(20) NOT NULL,
  created_by VARCHAR(20) NOT NULL,
  updated_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, event_id),
  CHECK (length(trim(event_id)) > 0)
);
CREATE INDEX idx_wca_teacher_named_student_events_event
  ON wca_teacher_named_student_events(event_id, student_id);
CREATE TRIGGER wca_teacher_named_student_events_updated_at
  BEFORE UPDATE ON wca_teacher_named_student_events
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
