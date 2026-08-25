-- Revisioned weekly teaching reports. Drafts are replaceable snapshots;
-- published revisions are immutable except for live account-reference removal.

CREATE TABLE teaching_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  student_display_name_snapshot VARCHAR(200) NOT NULL,
  student_external_ref_snapshot VARCHAR(160),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  timezone_snapshot VARCHAR(64) NOT NULL,
  revision INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  visibility VARCHAR(24) NOT NULL DEFAULT 'staff_only',
  teacher_summary VARCHAR(5000) NOT NULL DEFAULT '',
  next_week_plan VARCHAR(5000) NOT NULL DEFAULT '',
  aggregate JSONB NOT NULL,
  generated_by_user_id BIGINT,
  generated_by_user_id_snapshot BIGINT NOT NULL,
  generated_by_display_name_snapshot VARCHAR(200) NOT NULL,
  generated_by_role_snapshot VARCHAR(16) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by_user_id BIGINT,
  published_by_user_id_snapshot BIGINT,
  published_by_display_name_snapshot VARCHAR(200),
  published_by_role_snapshot VARCHAR(16),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teaching_weekly_reports_organization_fk FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT teaching_weekly_reports_student_fk FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT teaching_weekly_reports_generated_by_fk FOREIGN KEY (generated_by_user_id)
    REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT teaching_weekly_reports_published_by_fk FOREIGN KEY (published_by_user_id)
    REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT teaching_weekly_reports_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT teaching_weekly_reports_revision_unique
    UNIQUE (organization_id, student_id, week_start, revision),
  CONSTRAINT teaching_weekly_reports_week_check CHECK (
    week_end = week_start + 6 AND EXTRACT(ISODOW FROM week_start) = 1
  ),
  CONSTRAINT teaching_weekly_reports_timezone_check CHECK (
    timezone_snapshot = BTRIM(timezone_snapshot)
    AND CHAR_LENGTH(timezone_snapshot) BETWEEN 1 AND 64
  ),
  CONSTRAINT teaching_weekly_reports_revision_check CHECK (revision >= 1),
  CONSTRAINT teaching_weekly_reports_status_check CHECK (status IN ('draft', 'published')),
  CONSTRAINT teaching_weekly_reports_visibility_check CHECK (
    visibility IN ('staff_only', 'student', 'student_and_guardians')
  ),
  CONSTRAINT teaching_weekly_reports_aggregate_check CHECK (
    jsonb_typeof(aggregate) = 'object'
    AND aggregate ?& ARRAY['attendance', 'credits', 'training', 'assignments', 'lessonFeedback']
    AND NOT jsonb_path_exists(aggregate, '$.**.internalNotes')
  ),
  CONSTRAINT teaching_weekly_reports_generated_actor_check CHECK (
    generated_by_user_id IS NULL OR generated_by_user_id = generated_by_user_id_snapshot
  ),
  CONSTRAINT teaching_weekly_reports_generated_name_check CHECK (
    generated_by_display_name_snapshot = BTRIM(generated_by_display_name_snapshot)
    AND CHAR_LENGTH(generated_by_display_name_snapshot) BETWEEN 1 AND 200
  ),
  CONSTRAINT teaching_weekly_reports_generated_role_check CHECK (
    generated_by_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')
  ),
  CONSTRAINT teaching_weekly_reports_published_actor_check CHECK (
    published_by_user_id IS NULL OR published_by_user_id = published_by_user_id_snapshot
  ),
  CONSTRAINT teaching_weekly_reports_publication_check CHECK (
    (
      status = 'draft'
      AND visibility = 'staff_only'
      AND teacher_summary = ''
      AND next_week_plan = ''
      AND published_by_user_id IS NULL
      AND published_by_user_id_snapshot IS NULL
      AND published_by_display_name_snapshot IS NULL
      AND published_by_role_snapshot IS NULL
      AND published_at IS NULL
    ) OR (
      status = 'published'
      AND teacher_summary = BTRIM(teacher_summary)
      AND CHAR_LENGTH(teacher_summary) BETWEEN 1 AND 5000
      AND next_week_plan = BTRIM(next_week_plan)
      AND CHAR_LENGTH(next_week_plan) BETWEEN 1 AND 5000
      AND published_by_user_id_snapshot IS NOT NULL
      AND published_by_display_name_snapshot = BTRIM(published_by_display_name_snapshot)
      AND CHAR_LENGTH(published_by_display_name_snapshot) BETWEEN 1 AND 200
      AND published_by_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')
      AND published_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX uq_teaching_weekly_reports_one_draft
  ON teaching_weekly_reports (organization_id, student_id, week_start)
  WHERE status = 'draft';
CREATE INDEX idx_teaching_weekly_reports_org_student_week
  ON teaching_weekly_reports (organization_id, student_id, week_start DESC, revision DESC);
CREATE INDEX idx_teaching_weekly_reports_org_week_status
  ON teaching_weekly_reports (organization_id, week_start DESC, status, student_id, revision DESC);

CREATE FUNCTION trg_guard_teaching_weekly_report() RETURNS TRIGGER AS $$
DECLARE
  student_name VARCHAR(200);
  student_external_ref VARCHAR(160);
  organization_timezone VARCHAR(64);
  actor_status VARCHAR(16);
  actor_role VARCHAR(16);
  actor_name VARCHAR(200);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'teaching weekly reports cannot be deleted' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.generated_by_user_id IS DISTINCT FROM OLD.generated_by_user_id
          OR NEW.published_by_user_id IS DISTINCT FROM OLD.published_by_user_id)
     AND (
       NEW.generated_by_user_id IS NOT DISTINCT FROM OLD.generated_by_user_id
       OR (OLD.generated_by_user_id IS NOT NULL AND NEW.generated_by_user_id IS NULL)
     )
     AND (
       NEW.published_by_user_id IS NOT DISTINCT FROM OLD.published_by_user_id
       OR (OLD.published_by_user_id IS NOT NULL AND NEW.published_by_user_id IS NULL)
     )
     AND (to_jsonb(NEW) - ARRAY['generated_by_user_id', 'published_by_user_id'])
       IS NOT DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['generated_by_user_id', 'published_by_user_id']) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
    RAISE EXCEPTION 'published teaching weekly reports are immutable' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.student_id IS DISTINCT FROM OLD.student_id
    OR NEW.week_start IS DISTINCT FROM OLD.week_start
    OR NEW.week_end IS DISTINCT FROM OLD.week_end
    OR NEW.timezone_snapshot IS DISTINCT FROM OLD.timezone_snapshot
    OR NEW.revision IS DISTINCT FROM OLD.revision
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'teaching weekly report identity is immutable' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status = 'draft' THEN
    SELECT student.display_name, student.external_ref, organization.timezone
      INTO student_name, student_external_ref, organization_timezone
    FROM student_profiles student
    JOIN organizations organization ON organization.id = student.organization_id
    WHERE student.organization_id = NEW.organization_id
      AND student.id = NEW.student_id
      AND student.status = 'active'
    FOR UPDATE OF student;
    IF student_name IS NULL THEN
      RAISE EXCEPTION 'weekly report requires an active student' USING ERRCODE = '23514';
    END IF;

    SELECT member.status, member.role, app_user.display_name
      INTO actor_status, actor_role, actor_name
    FROM organization_members member
    JOIN app_users app_user ON app_user.id = member.user_id
    WHERE member.organization_id = NEW.organization_id
      AND member.user_id = NEW.generated_by_user_id
    FOR UPDATE OF member;
    IF actor_status IS DISTINCT FROM 'active'
       OR actor_role NOT IN ('owner', 'admin', 'teacher', 'assistant') THEN
      RAISE EXCEPTION 'weekly report generator must be an active teaching member'
        USING ERRCODE = '23514';
    END IF;

    NEW.student_display_name_snapshot := student_name;
    NEW.student_external_ref_snapshot := student_external_ref;
    NEW.generated_by_user_id_snapshot := NEW.generated_by_user_id;
    NEW.generated_by_display_name_snapshot := actor_name;
    NEW.generated_by_role_snapshot := actor_role;
    NEW.generated_at := clock_timestamp();
    IF TG_OP = 'INSERT' THEN
      NEW.week_end := NEW.week_start + 6;
      NEW.timezone_snapshot := organization_timezone;
      PERFORM pg_advisory_xact_lock(hashtextextended(
        'teaching-weekly-report-revision:' || NEW.organization_id::text || ':'
          || NEW.student_id::text || ':' || NEW.week_start::text,
        0
      ));
      SELECT COALESCE(MAX(report.revision), 0) + 1 INTO NEW.revision
      FROM teaching_weekly_reports report
      WHERE report.organization_id = NEW.organization_id
        AND report.student_id = NEW.student_id
        AND report.week_start = NEW.week_start;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'published' THEN
    IF OLD.status <> 'draft'
       OR NEW.aggregate IS DISTINCT FROM OLD.aggregate
       OR NEW.student_display_name_snapshot IS DISTINCT FROM OLD.student_display_name_snapshot
       OR NEW.student_external_ref_snapshot IS DISTINCT FROM OLD.student_external_ref_snapshot
       OR NEW.generated_by_user_id IS DISTINCT FROM OLD.generated_by_user_id
       OR NEW.generated_by_user_id_snapshot IS DISTINCT FROM OLD.generated_by_user_id_snapshot
       OR NEW.generated_by_display_name_snapshot IS DISTINCT FROM OLD.generated_by_display_name_snapshot
       OR NEW.generated_by_role_snapshot IS DISTINCT FROM OLD.generated_by_role_snapshot
       OR NEW.generated_at IS DISTINCT FROM OLD.generated_at THEN
      RAISE EXCEPTION 'weekly report publication cannot replace aggregate evidence'
        USING ERRCODE = '55000';
    END IF;
    SELECT member.status, member.role, app_user.display_name
      INTO actor_status, actor_role, actor_name
    FROM organization_members member
    JOIN app_users app_user ON app_user.id = member.user_id
    WHERE member.organization_id = NEW.organization_id
      AND member.user_id = NEW.published_by_user_id
    FOR UPDATE OF member;
    IF actor_status IS DISTINCT FROM 'active'
       OR actor_role NOT IN ('owner', 'admin', 'teacher', 'assistant') THEN
      RAISE EXCEPTION 'weekly report publisher must be an active teaching member'
        USING ERRCODE = '23514';
    END IF;
    NEW.teacher_summary := BTRIM(NEW.teacher_summary);
    NEW.next_week_plan := BTRIM(NEW.next_week_plan);
    NEW.published_by_user_id_snapshot := NEW.published_by_user_id;
    NEW.published_by_display_name_snapshot := actor_name;
    NEW.published_by_role_snapshot := actor_role;
    NEW.published_at := clock_timestamp();
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_weekly_reports_guard
BEFORE INSERT OR UPDATE OR DELETE ON teaching_weekly_reports
FOR EACH ROW EXECUTE FUNCTION trg_guard_teaching_weekly_report();
