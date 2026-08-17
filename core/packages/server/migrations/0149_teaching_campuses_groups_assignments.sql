-- Stage 1 teaching CRM: campuses, groups, effective-dated student memberships,
-- and resource-scoped teacher assignments.

-- Session teacher snapshots share app_users.display_name's full supported width.
ALTER TABLE session_teachers
  DROP CONSTRAINT session_teachers_name_format;
ALTER TABLE session_teachers
  ALTER COLUMN teacher_display_name_snapshot TYPE VARCHAR(200);
ALTER TABLE session_teachers
  ADD CONSTRAINT session_teachers_name_format CHECK (
    teacher_display_name_snapshot = BTRIM(teacher_display_name_snapshot)
    AND CHAR_LENGTH(teacher_display_name_snapshot) BETWEEN 1 AND 200
  );

CREATE TABLE teaching_campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code VARCHAR(64),
  name VARCHAR(160) NOT NULL,
  timezone VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT teaching_campuses_code_format CHECK (
    code IS NULL OR (code = BTRIM(code) AND code ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
  ),
  CONSTRAINT teaching_campuses_name_format CHECK (
    name = BTRIM(name) AND CHAR_LENGTH(name) BETWEEN 1 AND 160
  ),
  CONSTRAINT teaching_campuses_timezone_format CHECK (
    timezone IS NULL OR (timezone = BTRIM(timezone) AND CHAR_LENGTH(timezone) BETWEEN 1 AND 64)
  ),
  CONSTRAINT teaching_campuses_archive_state CHECK (
    (status = 'active' AND archived_at IS NULL)
    OR (status = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_teaching_campuses_org_code
  ON teaching_campuses (organization_id, code)
  WHERE code IS NOT NULL;
CREATE INDEX idx_teaching_campuses_org_status_name
  ON teaching_campuses (organization_id, status, name, id);
CREATE TRIGGER teaching_campuses_set_updated_at
BEFORE UPDATE ON teaching_campuses
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE teaching_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  campus_id UUID,
  code VARCHAR(64),
  name VARCHAR(160) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT teaching_groups_campus_fk
    FOREIGN KEY (organization_id, campus_id)
    REFERENCES teaching_campuses(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT teaching_groups_code_format CHECK (
    code IS NULL OR (code = BTRIM(code) AND code ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
  ),
  CONSTRAINT teaching_groups_name_format CHECK (
    name = BTRIM(name) AND CHAR_LENGTH(name) BETWEEN 1 AND 160
  ),
  CONSTRAINT teaching_groups_archive_state CHECK (
    (status = 'active' AND archived_at IS NULL)
    OR (status = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_teaching_groups_org_code
  ON teaching_groups (organization_id, code)
  WHERE code IS NOT NULL;
CREATE INDEX idx_teaching_groups_org_status_name
  ON teaching_groups (organization_id, status, name, id);
CREATE INDEX idx_teaching_groups_org_campus_status
  ON teaching_groups (organization_id, campus_id, status, name, id)
  WHERE campus_id IS NOT NULL;
CREATE TRIGGER teaching_groups_set_updated_at
BEFORE UPDATE ON teaching_groups
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- A real row lock, rather than an advisory lock, serializes overlap checks under
-- READ COMMITTED. Under REPEATABLE READ a concurrent conflicting upsert aborts
-- with 40001 instead of allowing a stale-snapshot write skew.
CREATE TABLE teaching_relation_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  relation_kind VARCHAR(32) NOT NULL
    CHECK (relation_kind IN ('student_group', 'teacher_group', 'teacher_student')),
  subject_key VARCHAR(64) NOT NULL,
  target_key VARCHAR(64) NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, relation_kind, subject_key, target_key),
  CHECK (subject_key = BTRIM(subject_key) AND CHAR_LENGTH(subject_key) BETWEEN 1 AND 64),
  CHECK (target_key = BTRIM(target_key) AND CHAR_LENGTH(target_key) BETWEEN 1 AND 64)
);

CREATE TABLE student_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  group_id UUID NOT NULL,
  student_id UUID NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT student_group_memberships_group_fk
    FOREIGN KEY (organization_id, group_id)
    REFERENCES teaching_groups(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_group_memberships_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_group_memberships_effective_range CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX idx_student_group_memberships_org_group_range
  ON student_group_memberships (organization_id, group_id, effective_from, effective_to, student_id);
CREATE INDEX idx_student_group_memberships_org_student_range
  ON student_group_memberships (organization_id, student_id, effective_from, effective_to, group_id);

CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  teacher_user_id BIGINT,
  teacher_user_id_snapshot BIGINT NOT NULL,
  teacher_display_name_snapshot VARCHAR(200) NOT NULL,
  teacher_role_snapshot VARCHAR(16) NOT NULL
    CHECK (teacher_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')),
  group_id UUID,
  student_id UUID,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT teacher_assignments_member_fk
    FOREIGN KEY (organization_id, teacher_user_id)
    REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT teacher_assignments_group_fk
    FOREIGN KEY (organization_id, group_id)
    REFERENCES teaching_groups(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT teacher_assignments_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT teacher_assignments_snapshot_match CHECK (
    teacher_user_id IS NULL OR teacher_user_id = teacher_user_id_snapshot
  ),
  CONSTRAINT teacher_assignments_target_xor CHECK (
    (group_id IS NOT NULL AND student_id IS NULL)
    OR (group_id IS NULL AND student_id IS NOT NULL)
  ),
  CONSTRAINT teacher_assignments_name_format CHECK (
    teacher_display_name_snapshot = BTRIM(teacher_display_name_snapshot)
    AND CHAR_LENGTH(teacher_display_name_snapshot) BETWEEN 1 AND 200
  ),
  CONSTRAINT teacher_assignments_effective_range CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX idx_teacher_assignments_org_teacher_range
  ON teacher_assignments (
    organization_id, teacher_user_id, effective_from, effective_to, group_id, student_id
  ) WHERE teacher_user_id IS NOT NULL;
CREATE INDEX idx_teacher_assignments_org_group_range
  ON teacher_assignments (organization_id, group_id, effective_from, effective_to, teacher_user_id_snapshot)
  WHERE group_id IS NOT NULL;
CREATE INDEX idx_teacher_assignments_org_student_range
  ON teacher_assignments (organization_id, student_id, effective_from, effective_to, teacher_user_id_snapshot)
  WHERE student_id IS NOT NULL;

CREATE FUNCTION trg_guard_teaching_structure_archive() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'archived' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION '% archive is terminal', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;

  IF TG_TABLE_NAME = 'teaching_campuses'
     AND OLD.status = 'active'
     AND NEW.status = 'archived'
     AND EXISTS (
       SELECT 1 FROM teaching_groups
       WHERE organization_id = OLD.organization_id
         AND campus_id = OLD.id
         AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'campus has active groups' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'teaching_groups'
     AND OLD.status = 'active'
     AND NEW.status = 'archived'
     AND (
       EXISTS (
         SELECT 1 FROM student_group_memberships membership
         WHERE membership.organization_id = OLD.organization_id
           AND membership.group_id = OLD.id
           AND membership.effective_to IS DISTINCT FROM membership.effective_from
           AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
       )
       OR EXISTS (
         SELECT 1 FROM teacher_assignments assignment
         WHERE assignment.organization_id = OLD.organization_id
           AND assignment.group_id = OLD.id
           AND assignment.effective_to IS DISTINCT FROM assignment.effective_from
           AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
       )
     ) THEN
    RAISE EXCEPTION 'group has active memberships or teacher assignments' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_campuses_guard_archive
BEFORE UPDATE ON teaching_campuses
FOR EACH ROW EXECUTE FUNCTION trg_guard_teaching_structure_archive();
CREATE TRIGGER teaching_groups_guard_archive
BEFORE UPDATE ON teaching_groups
FOR EACH ROW EXECUTE FUNCTION trg_guard_teaching_structure_archive();

CREATE FUNCTION trg_validate_teaching_group_campus() RETURNS TRIGGER AS $$
DECLARE
  locked_campus_status VARCHAR(16);
BEGIN
  IF NEW.campus_id IS NOT NULL AND NEW.status = 'active' THEN
    SELECT status INTO locked_campus_status
    FROM teaching_campuses
    WHERE organization_id = NEW.organization_id AND id = NEW.campus_id
    FOR UPDATE;

    IF locked_campus_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'active group requires an active campus in the same organization'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_groups_validate_campus
BEFORE INSERT OR UPDATE OF organization_id, campus_id, status ON teaching_groups
FOR EACH ROW EXECUTE FUNCTION trg_validate_teaching_group_campus();

CREATE FUNCTION trg_reject_teaching_crm_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% history is append-only; archive or end the effective range instead', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_campuses_reject_delete
BEFORE DELETE ON teaching_campuses
FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_crm_delete();
CREATE TRIGGER teaching_groups_reject_delete
BEFORE DELETE ON teaching_groups
FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_crm_delete();
CREATE TRIGGER student_group_memberships_reject_delete
BEFORE DELETE ON student_group_memberships
FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_crm_delete();
CREATE TRIGGER teacher_assignments_reject_delete
BEFORE DELETE ON teacher_assignments
FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_crm_delete();

CREATE FUNCTION trg_reject_teaching_relation_lock_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'teaching relation lock rows are permanent concurrency identities'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_relation_locks_reject_delete
BEFORE DELETE ON teaching_relation_locks
FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_relation_lock_delete();

CREATE FUNCTION trg_guard_teaching_relation_lock_update() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.relation_kind IS DISTINCT FROM OLD.relation_kind
     OR NEW.subject_key IS DISTINCT FROM OLD.subject_key
     OR NEW.target_key IS DISTINCT FROM OLD.target_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'teaching relation lock identity is immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_relation_locks_guard_update
BEFORE UPDATE ON teaching_relation_locks
FOR EACH ROW EXECUTE FUNCTION trg_guard_teaching_relation_lock_update();

CREATE FUNCTION trg_validate_teaching_relation() RETURNS TRIGGER AS $$
DECLARE
  lock_kind VARCHAR(32);
  lock_subject VARCHAR(64);
  lock_target VARCHAR(64);
  locked_group_status VARCHAR(16);
  locked_group_campus_id UUID;
  locked_campus_status VARCHAR(16);
  locked_student_status VARCHAR(16);
  locked_member_status VARCHAR(16);
  locked_member_role VARCHAR(16);
  locked_member_display_name VARCHAR(200);
  creator_reference_unchanged_or_cleared BOOLEAN;
  creator_reference_only_cleared BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.effective_to IS NOT NULL
     AND NEW.effective_to <= NEW.effective_from THEN
    RAISE EXCEPTION 'new teaching relation effective_to must be after effective_from'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'student_group_memberships' THEN
    IF TG_OP = 'UPDATE' THEN
      creator_reference_unchanged_or_cleared :=
        NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
        OR (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL);
      creator_reference_only_cleared :=
        OLD.created_by_user_id IS NOT NULL
        AND NEW.created_by_user_id IS NULL
        AND (to_jsonb(NEW) - 'created_by_user_id')
          IS NOT DISTINCT FROM (to_jsonb(OLD) - 'created_by_user_id');

      IF NOT creator_reference_only_cleared AND (
         NEW.effective_to IS NULL
         OR (OLD.effective_to IS NOT NULL AND NEW.effective_to > OLD.effective_to)
         OR NOT (NEW.effective_to = NEW.effective_from OR NEW.effective_to <= clock_timestamp())
         OR NOT creator_reference_unchanged_or_cleared
         OR (to_jsonb(NEW) - 'effective_to' - 'created_by_user_id')
           IS DISTINCT FROM (to_jsonb(OLD) - 'effective_to' - 'created_by_user_id')
      ) THEN
        RAISE EXCEPTION 'student group membership identity and history are immutable'
          USING ERRCODE = '55000';
      END IF;
    END IF;

    lock_kind := 'student_group';
    lock_subject := NEW.student_id::text;
    lock_target := NEW.group_id::text;

  ELSE
    IF TG_OP = 'INSERT' AND NEW.teacher_user_id IS NULL THEN
      RAISE EXCEPTION 'new teacher assignment requires a live member'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      creator_reference_unchanged_or_cleared :=
        NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
        OR (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL);
      creator_reference_only_cleared :=
        OLD.created_by_user_id IS NOT NULL
        AND NEW.created_by_user_id IS NULL
        AND (to_jsonb(NEW) - 'created_by_user_id')
          IS NOT DISTINCT FROM (to_jsonb(OLD) - 'created_by_user_id');

      IF creator_reference_only_cleared THEN
        NULL;
      ELSIF NEW.teacher_user_id IS NOT DISTINCT FROM OLD.teacher_user_id THEN
        IF NEW.effective_to IS NULL
           OR (OLD.effective_to IS NOT NULL AND NEW.effective_to > OLD.effective_to)
           OR NOT (NEW.effective_to = NEW.effective_from OR NEW.effective_to <= clock_timestamp())
           OR NOT creator_reference_unchanged_or_cleared
           OR (to_jsonb(NEW) - 'effective_to' - 'created_by_user_id')
             IS DISTINCT FROM (to_jsonb(OLD) - 'effective_to' - 'created_by_user_id') THEN
          RAISE EXCEPTION 'teacher assignment identity and history are immutable'
            USING ERRCODE = '55000';
        END IF;
      ELSIF NOT (
        OLD.teacher_user_id IS NOT NULL
        AND NEW.teacher_user_id IS NULL
        AND NEW.effective_to IS NOT NULL
        AND (OLD.effective_to IS NULL OR NEW.effective_to <= OLD.effective_to)
        AND (NEW.effective_to = NEW.effective_from OR NEW.effective_to <= clock_timestamp())
        AND creator_reference_unchanged_or_cleared
        AND (to_jsonb(NEW) - 'teacher_user_id' - 'effective_to' - 'created_by_user_id')
          IS NOT DISTINCT FROM (to_jsonb(OLD) - 'teacher_user_id' - 'effective_to' - 'created_by_user_id')
      ) THEN
        RAISE EXCEPTION 'teacher assignment account unlink is invalid'
          USING ERRCODE = '55000';
      END IF;
    END IF;

    lock_subject := NEW.teacher_user_id_snapshot::text;
    IF NEW.group_id IS NOT NULL THEN
      lock_kind := 'teacher_group';
      lock_target := NEW.group_id::text;
    ELSE
      lock_kind := 'teacher_student';
      lock_target := NEW.student_id::text;
    END IF;

  END IF;

  INSERT INTO teaching_relation_locks (
    organization_id, relation_kind, subject_key, target_key
  ) VALUES (
    NEW.organization_id, lock_kind, lock_subject, lock_target
  )
  ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
  DO UPDATE SET revision = teaching_relation_locks.revision + 1, touched_at = clock_timestamp();

  -- Lock resource rows in a stable group -> campus -> student/member order. These
  -- locks conflict with status/archive updates, so whichever transaction commits
  -- first determines whether a new active relation is accepted.
  IF TG_TABLE_NAME = 'student_group_memberships' THEN
    SELECT status, campus_id INTO locked_group_status, locked_group_campus_id
    FROM teaching_groups
    WHERE organization_id = NEW.organization_id AND id = NEW.group_id
    FOR UPDATE;

    IF locked_group_campus_id IS NOT NULL THEN
      SELECT status INTO locked_campus_status
      FROM teaching_campuses
      WHERE organization_id = NEW.organization_id AND id = locked_group_campus_id
      FOR UPDATE;
    END IF;

    SELECT status INTO locked_student_status
    FROM student_profiles
    WHERE organization_id = NEW.organization_id AND id = NEW.student_id
    FOR UPDATE;

    IF TG_OP = 'INSERT' AND (
      locked_group_status IS DISTINCT FROM 'active'
      OR (locked_group_campus_id IS NOT NULL AND locked_campus_status IS DISTINCT FROM 'active')
      OR locked_student_status IS DISTINCT FROM 'active'
    ) THEN
      RAISE EXCEPTION 'membership targets must be active in the same organization'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.group_id IS NOT NULL THEN
      SELECT status, campus_id INTO locked_group_status, locked_group_campus_id
      FROM teaching_groups
      WHERE organization_id = NEW.organization_id AND id = NEW.group_id
      FOR UPDATE;

      IF locked_group_campus_id IS NOT NULL THEN
        SELECT status INTO locked_campus_status
        FROM teaching_campuses
        WHERE organization_id = NEW.organization_id AND id = locked_group_campus_id
        FOR UPDATE;
      END IF;
    ELSE
      SELECT status INTO locked_student_status
      FROM student_profiles
      WHERE organization_id = NEW.organization_id AND id = NEW.student_id
      FOR UPDATE;
    END IF;
    IF NEW.teacher_user_id IS NOT NULL THEN
      SELECT member.status, member.role, app_user.display_name
        INTO locked_member_status, locked_member_role, locked_member_display_name
      FROM organization_members member
      JOIN app_users app_user ON app_user.id = member.user_id
      WHERE member.organization_id = NEW.organization_id AND member.user_id = NEW.teacher_user_id
      FOR UPDATE OF member;
    END IF;

    IF TG_OP = 'INSERT' AND (
      locked_member_status IS DISTINCT FROM 'active'
      OR locked_member_role IS DISTINCT FROM NEW.teacher_role_snapshot
      OR locked_member_role NOT IN ('owner', 'admin', 'teacher', 'assistant')
      OR locked_member_display_name IS DISTINCT FROM NEW.teacher_display_name_snapshot
    ) THEN
      RAISE EXCEPTION 'teacher assignment requires an active teaching member with matching snapshots'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.group_id IS NOT NULL AND (
      locked_group_status IS DISTINCT FROM 'active'
      OR (locked_group_campus_id IS NOT NULL AND locked_campus_status IS DISTINCT FROM 'active')
    ) THEN
      RAISE EXCEPTION 'teacher assignment group must be active in the same organization'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.student_id IS NOT NULL
       AND locked_student_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'teacher assignment student must be active in the same organization'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.effective_to IS NULL OR NEW.effective_to > NEW.effective_from THEN
    IF TG_TABLE_NAME = 'student_group_memberships' THEN
      IF EXISTS (
        SELECT 1 FROM student_group_memberships existing
        WHERE existing.organization_id = NEW.organization_id
          AND existing.group_id = NEW.group_id
          AND existing.student_id = NEW.student_id
          AND existing.id <> NEW.id
          AND tstzrange(existing.effective_from, existing.effective_to, '[)')
            && tstzrange(NEW.effective_from, NEW.effective_to, '[)')
      ) THEN
        RAISE EXCEPTION 'student group membership effective range overlaps'
          USING ERRCODE = '23P01';
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM teacher_assignments existing
      WHERE existing.organization_id = NEW.organization_id
        AND existing.teacher_user_id_snapshot = NEW.teacher_user_id_snapshot
        AND existing.group_id IS NOT DISTINCT FROM NEW.group_id
        AND existing.student_id IS NOT DISTINCT FROM NEW.student_id
        AND existing.id <> NEW.id
        AND tstzrange(existing.effective_from, existing.effective_to, '[)')
          && tstzrange(NEW.effective_from, NEW.effective_to, '[)')
    ) THEN
      RAISE EXCEPTION 'teacher assignment effective range overlaps'
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_group_memberships_validate
BEFORE INSERT OR UPDATE ON student_group_memberships
FOR EACH ROW EXECUTE FUNCTION trg_validate_teaching_relation();
CREATE TRIGGER teacher_assignments_validate
BEFORE INSERT OR UPDATE ON teacher_assignments
FOR EACH ROW EXECUTE FUNCTION trg_validate_teaching_relation();
