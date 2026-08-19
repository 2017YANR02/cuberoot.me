-- Revisioned post-lesson feedback. Historical revisions are append-only;
-- account deletion may only anonymize the live author reference.

CREATE TABLE lesson_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  revision INTEGER NOT NULL,
  visibility VARCHAR(24) NOT NULL DEFAULT 'staff_only',
  summary VARCHAR(2000) NOT NULL,
  strengths VARCHAR(4000),
  challenges VARCHAR(4000),
  next_goals VARCHAR(4000),
  internal_notes VARCHAR(4000),
  student_display_name_snapshot VARCHAR(200) NOT NULL,
  attendance_status_snapshot VARCHAR(16) NOT NULL,
  credit_cost_snapshot INTEGER NOT NULL,
  author_user_id BIGINT,
  author_user_id_snapshot BIGINT NOT NULL,
  author_display_name_snapshot VARCHAR(200) NOT NULL,
  author_role_snapshot VARCHAR(16) NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_feedback_revision_check CHECK (revision >= 1),
  CONSTRAINT lesson_feedback_visibility_check CHECK (
    visibility IN ('staff_only', 'student', 'student_and_guardians')
  ),
  CONSTRAINT lesson_feedback_summary_check CHECK (
    length(summary) BETWEEN 1 AND 2000 AND summary = btrim(summary)
  ),
  CONSTRAINT lesson_feedback_strengths_check CHECK (strengths IS NULL OR length(strengths) <= 4000),
  CONSTRAINT lesson_feedback_challenges_check CHECK (challenges IS NULL OR length(challenges) <= 4000),
  CONSTRAINT lesson_feedback_next_goals_check CHECK (next_goals IS NULL OR length(next_goals) <= 4000),
  CONSTRAINT lesson_feedback_internal_notes_check CHECK (internal_notes IS NULL OR length(internal_notes) <= 4000),
  CONSTRAINT lesson_feedback_attendance_status_check CHECK (
    attendance_status_snapshot IN ('expected', 'present', 'late', 'absent', 'excused')
  ),
  CONSTRAINT lesson_feedback_credit_cost_check CHECK (credit_cost_snapshot >= 0),
  CONSTRAINT lesson_feedback_author_role_check CHECK (
    author_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')
  ),
  CONSTRAINT lesson_feedback_publication_check CHECK (
    (visibility = 'staff_only' AND published_at IS NULL)
    OR (visibility <> 'staff_only' AND published_at IS NOT NULL)
  ),
  CONSTRAINT lesson_feedback_organization_fk FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT lesson_feedback_attendance_fk FOREIGN KEY (organization_id, session_id, student_id)
    REFERENCES attendance_records(organization_id, session_id, student_id) ON DELETE RESTRICT,
  CONSTRAINT lesson_feedback_author_fk FOREIGN KEY (author_user_id)
    REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT lesson_feedback_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT lesson_feedback_revision_unique UNIQUE (organization_id, session_id, student_id, revision)
);

CREATE INDEX idx_lesson_feedback_session_created
  ON lesson_feedback (organization_id, session_id, created_at DESC, id DESC);
CREATE INDEX idx_lesson_feedback_student_created
  ON lesson_feedback (organization_id, student_id, created_at DESC, id DESC);

CREATE FUNCTION trg_guard_lesson_feedback() RETURNS TRIGGER AS $$
DECLARE
  session_status VARCHAR(16);
  attendance_status VARCHAR(16);
  attendance_credit_cost INTEGER;
  student_name VARCHAR(200);
  member_status VARCHAR(16);
  member_role VARCHAR(16);
  member_name VARCHAR(200);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.author_user_id IS NOT NULL
       AND NEW.author_user_id IS NULL
       AND (to_jsonb(NEW) - 'author_user_id')
         IS NOT DISTINCT FROM (to_jsonb(OLD) - 'author_user_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'lesson feedback is append-only' USING ERRCODE = '55000';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'lesson feedback is append-only' USING ERRCODE = '55000';
  END IF;

  SELECT session.status, attendance.status, attendance.credit_cost, student.display_name
    INTO session_status, attendance_status, attendance_credit_cost, student_name
  FROM teaching_sessions session
  JOIN attendance_records attendance
    ON attendance.organization_id = session.organization_id
   AND attendance.session_id = session.id
  JOIN student_profiles student
    ON student.organization_id = attendance.organization_id
   AND student.id = attendance.student_id
  WHERE session.organization_id = NEW.organization_id
    AND session.id = NEW.session_id
    AND attendance.student_id = NEW.student_id
  FOR UPDATE OF session, attendance;

  IF session_status IS NULL THEN
    RAISE EXCEPTION 'lesson feedback requires session attendance' USING ERRCODE = '23503';
  END IF;
  IF session_status <> 'completed' THEN
    RAISE EXCEPTION 'lesson feedback requires a completed session' USING ERRCODE = '23514';
  END IF;

  SELECT member.status, member.role, app_user.display_name
    INTO member_status, member_role, member_name
  FROM organization_members member
  JOIN app_users app_user ON app_user.id = member.user_id
  WHERE member.organization_id = NEW.organization_id
    AND member.user_id = NEW.author_user_id
  FOR UPDATE OF member;

  IF member_status IS DISTINCT FROM 'active'
     OR member_role NOT IN ('owner', 'admin', 'teacher', 'assistant') THEN
    RAISE EXCEPTION 'lesson feedback author must be an active teaching member'
      USING ERRCODE = '23514';
  END IF;

  NEW.summary := btrim(NEW.summary);
  NEW.strengths := NULLIF(btrim(NEW.strengths), '');
  NEW.challenges := NULLIF(btrim(NEW.challenges), '');
  NEW.next_goals := NULLIF(btrim(NEW.next_goals), '');
  NEW.internal_notes := NULLIF(btrim(NEW.internal_notes), '');
  NEW.student_display_name_snapshot := student_name;
  NEW.attendance_status_snapshot := attendance_status;
  NEW.credit_cost_snapshot := attendance_credit_cost;
  NEW.author_user_id_snapshot := NEW.author_user_id;
  NEW.author_display_name_snapshot := member_name;
  NEW.author_role_snapshot := member_role;
  SELECT COALESCE(MAX(revision), 0) + 1 INTO NEW.revision
  FROM lesson_feedback
  WHERE organization_id = NEW.organization_id
    AND session_id = NEW.session_id
    AND student_id = NEW.student_id;
  NEW.published_at := CASE WHEN NEW.visibility = 'staff_only' THEN NULL ELSE clock_timestamp() END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_feedback_guard
BEFORE INSERT OR UPDATE OR DELETE ON lesson_feedback
FOR EACH ROW EXECUTE FUNCTION trg_guard_lesson_feedback();
