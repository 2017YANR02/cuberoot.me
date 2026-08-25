-- Atomic leave approval and makeup scheduling. The partial source uniqueness
-- plus the existing unique attendance consume make a second billing anchor
-- unnecessary: one source can have only one live attempt and one target can
-- be consumed only once.

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_session_attendance_student_unique
  UNIQUE (organization_id, session_id, id, student_id);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL,
  attendance_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason VARCHAR(500) NOT NULL,
  decision_reason VARCHAR(500),
  requested_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  requested_by_user_id_snapshot BIGINT NOT NULL,
  requested_by_display_name_snapshot VARCHAR(160) NOT NULL,
  requested_by_role_snapshot VARCHAR(20) NOT NULL
    CHECK (requested_by_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant', 'student', 'guardian')),
  requested_by_relationship_snapshot VARCHAR(100),
  decided_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  decided_by_user_id_snapshot BIGINT,
  decided_by_display_name_snapshot VARCHAR(160),
  decided_by_role_snapshot VARCHAR(20)
    CHECK (decided_by_role_snapshot IS NULL OR decided_by_role_snapshot IN (
      'owner', 'admin', 'teacher', 'assistant', 'student', 'guardian'
    )),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_requests_attendance_fk
    FOREIGN KEY (organization_id, session_id, attendance_id, student_id)
    REFERENCES attendance_records(organization_id, session_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT leave_requests_reason_format CHECK (
    reason = BTRIM(reason) AND CHAR_LENGTH(reason) BETWEEN 1 AND 500
  ),
  CONSTRAINT leave_requests_requester_format CHECK (
    requested_by_display_name_snapshot = BTRIM(requested_by_display_name_snapshot)
    AND CHAR_LENGTH(requested_by_display_name_snapshot) BETWEEN 1 AND 160
    AND (requested_by_relationship_snapshot IS NULL OR (
      requested_by_role_snapshot = 'guardian'
      AND requested_by_relationship_snapshot = BTRIM(requested_by_relationship_snapshot)
      AND CHAR_LENGTH(requested_by_relationship_snapshot) BETWEEN 1 AND 100
    ))
  ),
  CONSTRAINT leave_requests_decision_shape CHECK (
    (status = 'pending'
      AND decision_reason IS NULL
      AND decided_by_user_id IS NULL
      AND decided_by_user_id_snapshot IS NULL
      AND decided_by_display_name_snapshot IS NULL
      AND decided_by_role_snapshot IS NULL
      AND decided_at IS NULL)
    OR (status IN ('approved', 'rejected', 'cancelled')
      AND decision_reason = BTRIM(decision_reason)
      AND CHAR_LENGTH(decision_reason) BETWEEN 1 AND 500
      AND decided_by_user_id_snapshot IS NOT NULL
      AND decided_by_display_name_snapshot = BTRIM(decided_by_display_name_snapshot)
      AND CHAR_LENGTH(decided_by_display_name_snapshot) BETWEEN 1 AND 160
      AND decided_by_role_snapshot IS NOT NULL
      AND decided_at IS NOT NULL)
  ),
  UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX uq_leave_requests_active_attendance
  ON leave_requests (organization_id, attendance_id)
  WHERE status IN ('pending', 'approved');

CREATE INDEX idx_leave_requests_session_created
  ON leave_requests (organization_id, session_id, created_at DESC, id DESC);

CREATE TABLE makeup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_session_id UUID NOT NULL,
  source_attendance_id UUID NOT NULL,
  target_session_id UUID NOT NULL,
  target_attendance_id UUID NOT NULL,
  student_id UUID NOT NULL,
  student_package_id UUID NOT NULL,
  credit_cost INTEGER NOT NULL CHECK (credit_cost BETWEEN 1 AND 1000000),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'fulfilled', 'failed', 'cancelled')),
  reason VARCHAR(500) NOT NULL,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_by_user_id_snapshot BIGINT NOT NULL,
  created_by_display_name_snapshot VARCHAR(160) NOT NULL,
  created_by_role_snapshot VARCHAR(20) NOT NULL
    CHECK (created_by_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')),
  resolved_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  resolved_by_user_id_snapshot BIGINT,
  resolved_by_display_name_snapshot VARCHAR(160),
  resolved_by_role_snapshot VARCHAR(20)
    CHECK (resolved_by_role_snapshot IS NULL OR resolved_by_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')),
  resolution_reason VARCHAR(500),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT makeup_attempts_source_attendance_fk
    FOREIGN KEY (organization_id, source_session_id, source_attendance_id, student_id)
    REFERENCES attendance_records(organization_id, session_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT makeup_attempts_target_attendance_fk
    FOREIGN KEY (organization_id, target_session_id, target_attendance_id, student_id)
    REFERENCES attendance_records(organization_id, session_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT makeup_attempts_package_fk
    FOREIGN KEY (organization_id, student_package_id, student_id)
    REFERENCES student_packages(organization_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT makeup_attempts_distinct_sessions CHECK (source_session_id <> target_session_id),
  CONSTRAINT makeup_attempts_reason_format CHECK (
    reason = BTRIM(reason) AND CHAR_LENGTH(reason) BETWEEN 1 AND 500
  ),
  CONSTRAINT makeup_attempts_creator_format CHECK (
    created_by_display_name_snapshot = BTRIM(created_by_display_name_snapshot)
    AND CHAR_LENGTH(created_by_display_name_snapshot) BETWEEN 1 AND 160
  ),
  CONSTRAINT makeup_attempts_resolution_shape CHECK (
    (status = 'scheduled'
      AND resolved_by_user_id IS NULL
      AND resolved_by_user_id_snapshot IS NULL
      AND resolved_by_display_name_snapshot IS NULL
      AND resolved_by_role_snapshot IS NULL
      AND resolution_reason IS NULL
      AND resolved_at IS NULL)
    OR (status IN ('fulfilled', 'failed', 'cancelled')
      AND resolved_by_user_id_snapshot IS NOT NULL
      AND resolved_by_display_name_snapshot = BTRIM(resolved_by_display_name_snapshot)
      AND CHAR_LENGTH(resolved_by_display_name_snapshot) BETWEEN 1 AND 160
      AND resolved_by_role_snapshot IS NOT NULL
      AND resolution_reason = BTRIM(resolution_reason)
      AND CHAR_LENGTH(resolution_reason) BETWEEN 1 AND 500
      AND resolved_at IS NOT NULL)
  ),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, target_attendance_id)
);

CREATE UNIQUE INDEX uq_makeup_attempts_live_source
  ON makeup_attempts (organization_id, source_attendance_id)
  WHERE status IN ('scheduled', 'fulfilled');

CREATE INDEX idx_makeup_attempts_source_created
  ON makeup_attempts (organization_id, source_attendance_id, created_at DESC, id DESC);

CREATE INDEX idx_makeup_attempts_target_session
  ON makeup_attempts (organization_id, target_session_id, target_attendance_id, id);

CREATE TRIGGER leave_requests_set_updated_at
BEFORE UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER makeup_attempts_set_updated_at
BEFORE UPDATE ON makeup_attempts
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE OR REPLACE FUNCTION trg_validate_leave_request_mutation()
RETURNS TRIGGER AS $$
DECLARE
  attendance_status VARCHAR(20);
  session_status VARCHAR(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'leave_requests is auditable and cannot be deleted' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' AND (
    NEW.requested_by_user_id IS NULL
    OR NEW.requested_by_user_id_snapshot IS DISTINCT FROM NEW.requested_by_user_id
  ) THEN
    RAISE EXCEPTION 'leave request requester live reference must match its snapshot'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.session_id IS DISTINCT FROM OLD.session_id
       OR NEW.attendance_id IS DISTINCT FROM OLD.attendance_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.requested_by_user_id_snapshot IS DISTINCT FROM OLD.requested_by_user_id_snapshot
       OR NEW.requested_by_display_name_snapshot IS DISTINCT FROM OLD.requested_by_display_name_snapshot
       OR NEW.requested_by_role_snapshot IS DISTINCT FROM OLD.requested_by_role_snapshot
       OR NEW.requested_by_relationship_snapshot IS DISTINCT FROM OLD.requested_by_relationship_snapshot
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'leave request identity and requester snapshot are immutable' USING ERRCODE = '55000';
    END IF;
    IF NEW.requested_by_user_id IS DISTINCT FROM OLD.requested_by_user_id
       AND NOT (OLD.requested_by_user_id IS NOT NULL AND NEW.requested_by_user_id IS NULL) THEN
      RAISE EXCEPTION 'leave request actor references can only be cleared by account deletion'
        USING ERRCODE = '55000';
    END IF;
    IF NOT (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'cancelled'))
       AND NEW.decided_by_user_id IS DISTINCT FROM OLD.decided_by_user_id
       AND NOT (OLD.decided_by_user_id IS NOT NULL AND NEW.decided_by_user_id IS NULL) THEN
      RAISE EXCEPTION 'leave request decider reference cannot be replaced'
        USING ERRCODE = '55000';
    END IF;
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'cancelled')
       AND (NEW.decided_by_user_id IS NULL
         OR NEW.decided_by_user_id_snapshot IS DISTINCT FROM NEW.decided_by_user_id) THEN
      RAISE EXCEPTION 'leave request decider live reference must match its snapshot'
        USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'cancelled') THEN
      SELECT status INTO session_status
      FROM teaching_sessions
      WHERE organization_id = NEW.organization_id AND id = NEW.session_id
      FOR UPDATE;
      SELECT status INTO attendance_status
      FROM attendance_records
      WHERE organization_id = NEW.organization_id
        AND session_id = NEW.session_id
        AND id = NEW.attendance_id
        AND student_id = NEW.student_id
      FOR UPDATE;
      IF session_status IS NULL OR attendance_status IS NULL
         OR session_status NOT IN ('scheduled', 'in_progress')
         OR (NEW.status = 'approved' AND attendance_status <> 'excused') THEN
        RAISE EXCEPTION 'leave decision requires an open session and synchronized attendance'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected', 'cancelled') THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.decision_reason IS DISTINCT FROM OLD.decision_reason
         OR NEW.decided_by_user_id_snapshot IS DISTINCT FROM OLD.decided_by_user_id_snapshot
         OR NEW.decided_by_display_name_snapshot IS DISTINCT FROM OLD.decided_by_display_name_snapshot
         OR NEW.decided_by_role_snapshot IS DISTINCT FROM OLD.decided_by_role_snapshot
         OR NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN
        RAISE EXCEPTION 'leave request has already reached a terminal state' USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT status INTO session_status
  FROM teaching_sessions
  WHERE organization_id = NEW.organization_id AND id = NEW.session_id
  FOR UPDATE;
  SELECT status INTO attendance_status
  FROM attendance_records
  WHERE organization_id = NEW.organization_id
    AND session_id = NEW.session_id
    AND id = NEW.attendance_id
    AND student_id = NEW.student_id
  FOR UPDATE;

  IF session_status IS NULL OR attendance_status IS NULL
     OR NEW.status <> 'pending' OR attendance_status <> 'expected'
     OR session_status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'leave request requires an expected attendance in an open session'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leave_requests_validate_mutation
BEFORE INSERT OR UPDATE OR DELETE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION trg_validate_leave_request_mutation();

CREATE OR REPLACE FUNCTION trg_validate_leave_attendance_sync()
RETURNS TRIGGER AS $$
DECLARE
  check_organization_id UUID;
  check_attendance_id UUID;
  attendance_status VARCHAR(20);
BEGIN
  IF TG_TABLE_NAME = 'leave_requests' THEN
    check_organization_id := NEW.organization_id;
    check_attendance_id := NEW.attendance_id;
  ELSE
    check_organization_id := NEW.organization_id;
    check_attendance_id := NEW.id;
  END IF;

  SELECT status INTO attendance_status
  FROM attendance_records
  WHERE organization_id = check_organization_id AND id = check_attendance_id;

  IF EXISTS (
    SELECT 1 FROM leave_requests
    WHERE organization_id = check_organization_id
      AND attendance_id = check_attendance_id
      AND status = 'pending'
  ) AND attendance_status <> 'expected' THEN
    RAISE EXCEPTION 'pending leave request requires expected attendance' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM leave_requests
    WHERE organization_id = check_organization_id
      AND attendance_id = check_attendance_id
      AND status = 'approved'
  ) <> (attendance_status = 'excused') THEN
    RAISE EXCEPTION 'approved leave and excused attendance must be committed together' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER leave_requests_attendance_sync
AFTER INSERT OR UPDATE OF status ON leave_requests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_validate_leave_attendance_sync();

CREATE CONSTRAINT TRIGGER attendance_records_leave_sync
AFTER UPDATE OF status ON attendance_records
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_validate_leave_attendance_sync();

CREATE OR REPLACE FUNCTION trg_validate_makeup_attempt_mutation()
RETURNS TRIGGER AS $$
DECLARE
  source_session teaching_sessions%ROWTYPE;
  target_session teaching_sessions%ROWTYPE;
  source_attendance attendance_records%ROWTYPE;
  target_attendance attendance_records%ROWTYPE;
  target_package student_packages%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'makeup_attempts is auditable and cannot be deleted' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' AND (
    NEW.created_by_user_id IS NULL
    OR NEW.created_by_user_id_snapshot IS DISTINCT FROM NEW.created_by_user_id
  ) THEN
    RAISE EXCEPTION 'makeup attempt creator live reference must match its snapshot'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.source_session_id IS DISTINCT FROM OLD.source_session_id
       OR NEW.source_attendance_id IS DISTINCT FROM OLD.source_attendance_id
       OR NEW.target_session_id IS DISTINCT FROM OLD.target_session_id
       OR NEW.target_attendance_id IS DISTINCT FROM OLD.target_attendance_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.student_package_id IS DISTINCT FROM OLD.student_package_id
       OR NEW.credit_cost IS DISTINCT FROM OLD.credit_cost
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_by_user_id_snapshot IS DISTINCT FROM OLD.created_by_user_id_snapshot
       OR NEW.created_by_display_name_snapshot IS DISTINCT FROM OLD.created_by_display_name_snapshot
       OR NEW.created_by_role_snapshot IS DISTINCT FROM OLD.created_by_role_snapshot
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'makeup attempt identity and creator snapshot are immutable' USING ERRCODE = '55000';
    END IF;
    IF NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       AND NOT (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL) THEN
      RAISE EXCEPTION 'makeup attempt actor references can only be cleared by account deletion'
        USING ERRCODE = '55000';
    END IF;
    IF NOT (OLD.status = 'scheduled' AND NEW.status IN ('fulfilled', 'failed', 'cancelled'))
       AND NEW.resolved_by_user_id IS DISTINCT FROM OLD.resolved_by_user_id
       AND NOT (OLD.resolved_by_user_id IS NOT NULL AND NEW.resolved_by_user_id IS NULL) THEN
      RAISE EXCEPTION 'makeup attempt resolver reference cannot be replaced'
        USING ERRCODE = '55000';
    END IF;
    IF OLD.status = 'scheduled' AND NEW.status IN ('fulfilled', 'failed', 'cancelled')
       AND (NEW.resolved_by_user_id IS NULL
         OR NEW.resolved_by_user_id_snapshot IS DISTINCT FROM NEW.resolved_by_user_id) THEN
      RAISE EXCEPTION 'makeup attempt resolver live reference must match its snapshot'
        USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'scheduled' OR NEW.status NOT IN ('fulfilled', 'failed', 'cancelled') THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.resolved_by_user_id_snapshot IS DISTINCT FROM OLD.resolved_by_user_id_snapshot
         OR NEW.resolved_by_display_name_snapshot IS DISTINCT FROM OLD.resolved_by_display_name_snapshot
         OR NEW.resolved_by_role_snapshot IS DISTINCT FROM OLD.resolved_by_role_snapshot
         OR NEW.resolution_reason IS DISTINCT FROM OLD.resolution_reason
         OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
        RAISE EXCEPTION 'makeup attempt has already reached a terminal state' USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM teaching_sessions
  WHERE organization_id = NEW.organization_id
    AND id IN (NEW.source_session_id, NEW.target_session_id)
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM attendance_records
  WHERE organization_id = NEW.organization_id
    AND id IN (NEW.source_attendance_id, NEW.target_attendance_id)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO source_session FROM teaching_sessions
  WHERE organization_id = NEW.organization_id AND id = NEW.source_session_id;
  SELECT * INTO target_session FROM teaching_sessions
  WHERE organization_id = NEW.organization_id AND id = NEW.target_session_id;
  SELECT * INTO source_attendance FROM attendance_records
  WHERE organization_id = NEW.organization_id AND id = NEW.source_attendance_id;
  SELECT * INTO target_attendance FROM attendance_records
  WHERE organization_id = NEW.organization_id AND id = NEW.target_attendance_id;
  SELECT * INTO target_package FROM student_packages
  WHERE organization_id = NEW.organization_id
    AND id = NEW.student_package_id
    AND student_id = NEW.student_id
  FOR SHARE;

  IF NEW.status <> 'scheduled'
     OR source_session.status NOT IN ('scheduled', 'in_progress', 'completed')
     OR source_attendance.status <> 'excused'
     OR NOT EXISTS (
       SELECT 1 FROM leave_requests
       WHERE organization_id = NEW.organization_id
         AND attendance_id = NEW.source_attendance_id
         AND status = 'approved'
     )
     OR target_session.status <> 'scheduled'
     OR target_session.starts_at <= NOW()
     OR target_session.starts_at <= source_session.ends_at
     OR target_attendance.status <> 'expected'
     OR target_attendance.student_id <> source_attendance.student_id
     OR target_attendance.student_package_id IS DISTINCT FROM source_attendance.student_package_id
     OR target_attendance.credit_cost <> source_attendance.credit_cost
     OR NEW.student_id <> source_attendance.student_id
     OR NEW.student_package_id IS DISTINCT FROM source_attendance.student_package_id
     OR NEW.credit_cost <> source_attendance.credit_cost
     OR target_package.id IS NULL
     OR target_package.lifecycle_status <> 'active'
     OR target_package.valid_from > target_session.starts_at
     OR (target_package.valid_until IS NOT NULL
       AND target_package.valid_until <= target_session.starts_at) THEN
    RAISE EXCEPTION 'makeup attempt does not match an approved leave and future expected target'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM makeup_attempts
    WHERE organization_id = NEW.organization_id
      AND (target_attendance_id = NEW.source_attendance_id
        OR source_attendance_id = NEW.target_attendance_id)
  ) THEN
    RAISE EXCEPTION 'nested makeup chains are not allowed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER makeup_attempts_validate_mutation
BEFORE INSERT OR UPDATE OR DELETE ON makeup_attempts
FOR EACH ROW EXECUTE FUNCTION trg_validate_makeup_attempt_mutation();

CREATE OR REPLACE FUNCTION trg_validate_makeup_terminal_state()
RETURNS TRIGGER AS $$
DECLARE
  attempt makeup_attempts%ROWTYPE;
  source_session_status VARCHAR(20);
  target_session_status VARCHAR(20);
  target_attendance_status VARCHAR(20);
  consume_count BIGINT;
BEGIN
  FOR attempt IN
    SELECT * FROM makeup_attempts
    WHERE organization_id = NEW.organization_id
      AND (
        (TG_TABLE_NAME = 'makeup_attempts' AND id = NEW.id)
        OR (TG_TABLE_NAME = 'teaching_sessions'
          AND (source_session_id = NEW.id OR target_session_id = NEW.id))
        OR (TG_TABLE_NAME = 'attendance_records' AND target_attendance_id = NEW.id)
      )
  LOOP
    SELECT status INTO source_session_status FROM teaching_sessions
    WHERE organization_id = attempt.organization_id AND id = attempt.source_session_id;
    SELECT status INTO target_session_status FROM teaching_sessions
    WHERE organization_id = attempt.organization_id AND id = attempt.target_session_id;
    SELECT status INTO target_attendance_status FROM attendance_records
    WHERE organization_id = attempt.organization_id AND id = attempt.target_attendance_id;
    SELECT COUNT(*) INTO consume_count FROM lesson_credit_ledger
    WHERE organization_id = attempt.organization_id
      AND attendance_id = attempt.target_attendance_id
      AND entry_type = 'consume';

    IF (attempt.status = 'scheduled' AND NOT (
          source_session_status IN ('scheduled', 'in_progress', 'completed')
          AND target_session_status IN ('scheduled', 'in_progress')
          AND target_attendance_status IN ('expected', 'present', 'late', 'absent', 'excused')
          AND consume_count = 0))
       OR (attempt.status = 'fulfilled' AND NOT (
          target_session_status = 'completed' AND target_attendance_status IN ('present', 'late') AND consume_count = 1))
       OR (attempt.status = 'failed' AND NOT (
          target_session_status = 'completed' AND target_attendance_status IN ('absent', 'excused') AND consume_count = 0))
       OR (attempt.status = 'cancelled' AND NOT (
          (target_session_status = 'cancelled' OR EXISTS (
            SELECT 1 FROM teaching_sessions source_session
            WHERE source_session.organization_id = attempt.organization_id
              AND source_session.id = attempt.source_session_id
              AND source_session.status = 'cancelled'
          )) AND consume_count = 0)) THEN
      RAISE EXCEPTION 'makeup attempt status does not match its target fulfilment state'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER makeup_attempts_terminal_state
AFTER INSERT OR UPDATE OF status ON makeup_attempts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_validate_makeup_terminal_state();

CREATE CONSTRAINT TRIGGER teaching_sessions_makeup_terminal_state
AFTER UPDATE OF status ON teaching_sessions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_validate_makeup_terminal_state();

CREATE CONSTRAINT TRIGGER attendance_records_makeup_terminal_state
AFTER UPDATE OF status ON attendance_records
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_validate_makeup_terminal_state();

ALTER TABLE session_events
  DROP CONSTRAINT session_events_event_type_check;

ALTER TABLE session_events
  ADD CONSTRAINT session_events_event_type_check CHECK (
    event_type IN (
      'scheduled', 'attendance_updated', 'completed', 'cancelled',
      'leave_requested', 'leave_decided', 'leave_cancelled', 'makeup_scheduled',
      'makeup_fulfilled', 'makeup_failed', 'makeup_cancelled'
    )
  );

CREATE OR REPLACE FUNCTION trg_validate_lesson_credit_ledger_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_balance BIGINT;
  target_row lesson_credit_ledger%ROWTYPE;
  attendance_row attendance_records%ROWTYPE;
  session_status VARCHAR(20);
BEGIN
  UPDATE student_packages
  SET credit_ledger_revision = credit_ledger_revision + 1
  WHERE organization_id = NEW.organization_id
    AND id = NEW.student_package_id
    AND student_id = NEW.student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student package does not match ledger tenant and student'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.entry_type = 'consume' THEN
    SELECT * INTO attendance_row
    FROM attendance_records
    WHERE organization_id = NEW.organization_id AND id = NEW.attendance_id;
    SELECT status INTO session_status
    FROM teaching_sessions
    WHERE organization_id = NEW.organization_id AND id = NEW.session_id;

    IF attendance_row.id IS NULL
       OR session_status IS NULL
       OR attendance_row.session_id <> NEW.session_id
       OR attendance_row.student_id <> NEW.student_id
       OR attendance_row.student_package_id IS DISTINCT FROM NEW.student_package_id
       OR attendance_row.credit_cost <> -NEW.delta
       OR attendance_row.status NOT IN ('present', 'late')
       OR session_status <> 'completed' THEN
      RAISE EXCEPTION 'credit consume requires matching completed billable attendance'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.entry_type = 'reversal' THEN
    SELECT * INTO target_row
    FROM lesson_credit_ledger
    WHERE organization_id = NEW.organization_id
      AND id = NEW.reversal_of_ledger_id;

    IF NOT FOUND
       OR target_row.student_package_id <> NEW.student_package_id
       OR target_row.student_id <> NEW.student_id
       OR target_row.entry_type = 'reversal'
       OR NEW.delta <> -target_row.delta THEN
      RAISE EXCEPTION 'credit ledger reversal must exactly reverse one entry in the same package'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT COALESCE(SUM(delta), 0)
  INTO current_balance
  FROM lesson_credit_ledger
  WHERE organization_id = NEW.organization_id
    AND student_package_id = NEW.student_package_id;

  IF current_balance + NEW.delta < 0 THEN
    RAISE EXCEPTION 'student package credit balance cannot be negative'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
