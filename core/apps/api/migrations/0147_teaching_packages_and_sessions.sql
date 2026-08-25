-- Stage 2 teaching SaaS: immutable package credit accounting and class fulfilment.

CREATE TABLE lesson_package_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  credit_unit VARCHAR(20) NOT NULL
    CHECK (credit_unit IN ('lesson', 'minute')),
  credit_type VARCHAR(64) NOT NULL,
  total_credits INTEGER NOT NULL CHECK (total_credits BETWEEN 1 AND 1000000),
  validity_days INTEGER CHECK (validity_days BETWEEN 1 AND 36500),
  price_amount_minor BIGINT NOT NULL
    CHECK (price_amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_package_products_code_format CHECK (
    code = BTRIM(code) AND code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'
  ),
  CONSTRAINT lesson_package_products_name_format CHECK (
    name = BTRIM(name) AND CHAR_LENGTH(name) BETWEEN 1 AND 160
  ),
  CONSTRAINT lesson_package_products_credit_type_format CHECK (
    credit_type = BTRIM(credit_type) AND credit_type ~ '^[a-z][a-z0-9_-]{0,63}$'
  ),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, code)
);

CREATE INDEX idx_lesson_package_products_org_status
  ON lesson_package_products (organization_id, status, name, id);

CREATE TRIGGER lesson_package_products_set_updated_at
BEFORE UPDATE ON lesson_package_products
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE student_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_code_snapshot VARCHAR(64) NOT NULL,
  product_name_snapshot VARCHAR(160) NOT NULL,
  credit_unit VARCHAR(20) NOT NULL
    CHECK (credit_unit IN ('lesson', 'minute')),
  credit_type VARCHAR(64) NOT NULL,
  entitled_credits INTEGER NOT NULL CHECK (entitled_credits BETWEEN 1 AND 1000000),
  validity_days_snapshot INTEGER CHECK (validity_days_snapshot BETWEEN 1 AND 36500),
  price_amount_minor BIGINT NOT NULL
    CHECK (price_amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'frozen', 'cancelled')),
  acquisition_type VARCHAR(20) NOT NULL
    CHECK (acquisition_type IN ('purchase', 'grant', 'migration')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  source_system VARCHAR(64),
  source_ref VARCHAR(160),
  source_line_ref VARCHAR(160),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_packages_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_packages_product_fk
    FOREIGN KEY (organization_id, product_id)
    REFERENCES lesson_package_products(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_packages_validity CHECK (
    valid_until IS NULL OR valid_until > valid_from
  ),
  CONSTRAINT student_packages_source_tuple CHECK (
    (source_system IS NULL AND source_ref IS NULL AND source_line_ref IS NULL)
    OR (
      source_system IS NOT NULL AND source_system = BTRIM(source_system)
      AND CHAR_LENGTH(source_system) BETWEEN 1 AND 64
      AND source_ref IS NOT NULL AND source_ref = BTRIM(source_ref)
      AND CHAR_LENGTH(source_ref) BETWEEN 1 AND 160
      AND (source_line_ref IS NULL OR (
        source_line_ref = BTRIM(source_line_ref)
        AND CHAR_LENGTH(source_line_ref) BETWEEN 1 AND 160
      ))
    )
  ),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, id, student_id)
);

CREATE UNIQUE INDEX uq_student_packages_external_source
  ON student_packages (
    organization_id, source_system, source_ref, COALESCE(source_line_ref, '')
  )
  WHERE source_system IS NOT NULL;

CREATE INDEX idx_student_packages_org_student
  ON student_packages (organization_id, student_id, lifecycle_status, valid_from DESC, id);

CREATE TRIGGER student_packages_set_updated_at
BEFORE UPDATE ON student_packages
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE teaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title VARCHAR(160) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teaching_sessions_title_format CHECK (
    title = BTRIM(title) AND CHAR_LENGTH(title) BETWEEN 1 AND 160
  ),
  CONSTRAINT teaching_sessions_time_range CHECK (ends_at > starts_at),
  CONSTRAINT teaching_sessions_completion_state CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND completed_at IS NULL)
    OR (status IN ('scheduled', 'in_progress') AND completed_at IS NULL AND cancelled_at IS NULL)
  ),
  UNIQUE (organization_id, id)
);

CREATE INDEX idx_teaching_sessions_org_starts
  ON teaching_sessions (organization_id, starts_at DESC, id);

CREATE TRIGGER teaching_sessions_set_updated_at
BEFORE UPDATE ON teaching_sessions
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE session_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL,
  teacher_user_id BIGINT,
  teacher_user_id_snapshot BIGINT NOT NULL,
  teacher_display_name_snapshot VARCHAR(160) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'lead'
    CHECK (role IN ('lead', 'assistant', 'substitute')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_teachers_session_fk
    FOREIGN KEY (organization_id, session_id)
    REFERENCES teaching_sessions(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT session_teachers_member_fk
    FOREIGN KEY (organization_id, teacher_user_id)
    REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT session_teachers_snapshot_match CHECK (
    teacher_user_id IS NULL OR teacher_user_id = teacher_user_id_snapshot
  ),
  CONSTRAINT session_teachers_name_format CHECK (
    teacher_display_name_snapshot = BTRIM(teacher_display_name_snapshot)
    AND CHAR_LENGTH(teacher_display_name_snapshot) BETWEEN 1 AND 160
  ),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, teacher_user_id_snapshot)
);

CREATE UNIQUE INDEX uq_session_teachers_one_lead
  ON session_teachers (organization_id, session_id)
  WHERE role = 'lead';

CREATE INDEX idx_session_teachers_org_user
  ON session_teachers (organization_id, teacher_user_id, session_id)
  WHERE teacher_user_id IS NOT NULL;

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  student_package_id UUID,
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('expected', 'present', 'late', 'absent', 'excused')),
  credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost BETWEEN 0 AND 1000000),
  notes VARCHAR(500) NOT NULL DEFAULT '',
  recorded_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_records_session_fk
    FOREIGN KEY (organization_id, session_id)
    REFERENCES teaching_sessions(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT attendance_records_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT attendance_records_package_fk
    FOREIGN KEY (organization_id, student_package_id, student_id)
    REFERENCES student_packages(organization_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT attendance_records_billing_shape CHECK (
    (status IN ('present', 'late') AND student_package_id IS NOT NULL AND credit_cost > 0)
    OR (status = 'expected' AND (
      (student_package_id IS NOT NULL AND credit_cost > 0)
      OR (student_package_id IS NULL AND credit_cost = 0)
    ))
    OR (status IN ('absent', 'excused') AND (
      (student_package_id IS NOT NULL AND credit_cost > 0)
      OR (student_package_id IS NULL AND credit_cost = 0)
    ))
  ),
  CONSTRAINT attendance_records_notes_format CHECK (
    notes = BTRIM(notes) AND CHAR_LENGTH(notes) <= 500
  ),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, id, student_id),
  UNIQUE (organization_id, session_id, student_id)
);

CREATE INDEX idx_attendance_records_org_session
  ON attendance_records (organization_id, session_id, student_id);

CREATE TRIGGER attendance_records_set_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE lesson_credit_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL,
  student_package_id UUID NOT NULL,
  student_id UUID NOT NULL,
  entry_type VARCHAR(20) NOT NULL
    CHECK (entry_type IN ('purchase', 'grant', 'consume', 'refund', 'adjustment', 'expiration', 'reversal')),
  delta INTEGER NOT NULL CHECK (delta BETWEEN -1000000 AND 1000000 AND delta <> 0),
  attendance_id UUID,
  session_id UUID,
  idempotency_key VARCHAR(200) NOT NULL,
  source_system VARCHAR(64),
  source_ref VARCHAR(160),
  source_line_ref VARCHAR(160),
  reversal_of_ledger_id BIGINT,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  actor_role VARCHAR(20) NOT NULL,
  actor_display_name VARCHAR(160) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_credit_ledger_package_fk
    FOREIGN KEY (organization_id, student_package_id, student_id)
    REFERENCES student_packages(organization_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT lesson_credit_ledger_session_fk
    FOREIGN KEY (organization_id, session_id)
    REFERENCES teaching_sessions(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT lesson_credit_ledger_attendance_fk
    FOREIGN KEY (organization_id, attendance_id, student_id)
    REFERENCES attendance_records(organization_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT lesson_credit_ledger_reversal_fk
    FOREIGN KEY (organization_id, reversal_of_ledger_id)
    REFERENCES lesson_credit_ledger(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT lesson_credit_ledger_consume_shape CHECK (
    (entry_type = 'consume' AND delta < 0 AND attendance_id IS NOT NULL AND session_id IS NOT NULL)
    OR (entry_type <> 'consume')
  ),
  CONSTRAINT lesson_credit_ledger_source_tuple CHECK (
    (source_system IS NULL AND source_ref IS NULL AND source_line_ref IS NULL)
    OR (
      source_system IS NOT NULL AND source_system = BTRIM(source_system)
      AND CHAR_LENGTH(source_system) BETWEEN 1 AND 64
      AND source_ref IS NOT NULL AND source_ref = BTRIM(source_ref)
      AND CHAR_LENGTH(source_ref) BETWEEN 1 AND 160
      AND (source_line_ref IS NULL OR (
        source_line_ref = BTRIM(source_line_ref)
        AND CHAR_LENGTH(source_line_ref) BETWEEN 1 AND 160
      ))
    )
  ),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, student_package_id, idempotency_key)
);

CREATE UNIQUE INDEX uq_lesson_credit_ledger_attendance_consume
  ON lesson_credit_ledger (organization_id, attendance_id)
  WHERE entry_type = 'consume';

CREATE UNIQUE INDEX uq_lesson_credit_ledger_reversal
  ON lesson_credit_ledger (organization_id, reversal_of_ledger_id)
  WHERE reversal_of_ledger_id IS NOT NULL;

CREATE INDEX idx_lesson_credit_ledger_package_created
  ON lesson_credit_ledger (organization_id, student_package_id, created_at, id);

CREATE TABLE session_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL,
  event_type VARCHAR(40) NOT NULL
    CHECK (event_type IN ('scheduled', 'attendance_updated', 'completed', 'cancelled')),
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  actor_role VARCHAR(20) NOT NULL,
  actor_display_name VARCHAR(160) NOT NULL,
  request_id VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_events_session_fk
    FOREIGN KEY (organization_id, session_id)
    REFERENCES teaching_sessions(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);

CREATE INDEX idx_session_events_org_session
  ON session_events (organization_id, session_id, id);

CREATE OR REPLACE FUNCTION trg_reject_teaching_business_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.actor_user_id IS NOT NULL
     AND NEW.actor_user_id IS NULL
     AND (TO_JSONB(NEW) - 'actor_user_id') = (TO_JSONB(OLD) - 'actor_user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_credit_ledger_append_only
BEFORE UPDATE OR DELETE ON lesson_credit_ledger
FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_business_event_mutation();

CREATE TRIGGER session_events_append_only
BEFORE UPDATE OR DELETE ON session_events
FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_business_event_mutation();
