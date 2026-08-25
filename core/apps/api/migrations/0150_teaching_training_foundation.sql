-- Stage 3A teaching foundation: versioned training templates, publish-time
-- assignment targets, immutable evidence, reviews, rollups, and safe student
-- account binding. Routes are introduced separately after this schema lands.

ALTER TABLE student_profiles
  ADD COLUMN account_linked_at TIMESTAMPTZ;
-- Stage 0 had no product binding flow, but manually linked/imported rows may
-- already exist. Their last row mutation is the closest durable lower-bound
-- snapshot available; clamp future-skewed legacy timestamps at migration time.
UPDATE student_profiles
SET account_linked_at = LEAST(updated_at, clock_timestamp())
WHERE account_user_id IS NOT NULL;
ALTER TABLE student_profiles
  ADD CONSTRAINT student_profiles_account_link_state CHECK (
    (account_user_id IS NULL) = (account_linked_at IS NULL)
  );

CREATE FUNCTION trg_guard_student_account_link() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_user_id IS NULL THEN
    NEW.account_linked_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.account_linked_at IS NULL OR NEW.account_linked_at > clock_timestamp() THEN
      RAISE EXCEPTION 'a linked student account requires a non-future link timestamp'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.account_user_id IS DISTINCT FROM OLD.account_user_id THEN
      IF OLD.account_user_id IS NOT NULL AND NEW.account_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'a linked student account must be unlinked before a different account can be bound'
          USING ERRCODE = '55000';
      END IF;
      IF NEW.account_linked_at IS NULL OR NEW.account_linked_at > clock_timestamp() THEN
        RAISE EXCEPTION 'a linked student account requires a non-future link timestamp'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.account_linked_at IS DISTINCT FROM OLD.account_linked_at THEN
      RAISE EXCEPTION 'student account link time is immutable while the account remains linked'
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_profiles_guard_account_link
BEFORE INSERT OR UPDATE OF account_user_id, account_linked_at ON student_profiles
FOR EACH ROW EXECUTE FUNCTION trg_guard_student_account_link();

ALTER TABLE teaching_relation_locks
  DROP CONSTRAINT teaching_relation_locks_relation_kind_check;
ALTER TABLE teaching_relation_locks
  ADD CONSTRAINT teaching_relation_locks_relation_kind_check CHECK (
    relation_kind IN ('student_group', 'teacher_group', 'teacher_student', 'training_evidence')
  );

CREATE TABLE training_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(4000) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT training_templates_name_format CHECK (
    name = BTRIM(name) AND CHAR_LENGTH(name) BETWEEN 1 AND 200
  ),
  CONSTRAINT training_templates_description_format CHECK (
    CHAR_LENGTH(description) <= 4000
  ),
  CONSTRAINT training_templates_archive_state CHECK (
    (status = 'active' AND archived_at IS NULL)
    OR (status = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE INDEX idx_training_templates_org_status_name
  ON training_templates (organization_id, status, name, id);
CREATE TRIGGER training_templates_set_updated_at
BEFORE UPDATE ON training_templates
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE training_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  title VARCHAR(200) NOT NULL,
  instructions VARCHAR(8000) NOT NULL DEFAULT '',
  source VARCHAR(32) NOT NULL
    CHECK (source IN ('timer', 'predict', 'alg-trainer')),
  activity VARCHAR(64) NOT NULL,
  tool_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, template_id, version_number),
  CONSTRAINT training_template_versions_template_fk
    FOREIGN KEY (organization_id, template_id)
    REFERENCES training_templates(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT training_template_versions_title_format CHECK (
    title = BTRIM(title) AND CHAR_LENGTH(title) BETWEEN 1 AND 200
  ),
  CONSTRAINT training_template_versions_instructions_format CHECK (
    CHAR_LENGTH(instructions) <= 8000
  ),
  CONSTRAINT training_template_versions_source_activity CHECK (
    (source = 'timer' AND activity = 'solve')
    OR (source = 'predict' AND activity = 'prediction')
    OR (source = 'alg-trainer' AND activity = 'algorithm_attempt')
  ),
  CONSTRAINT training_template_versions_tool_config_object CHECK (
    jsonb_typeof(tool_config) = 'object'
  )
);

CREATE INDEX idx_training_template_versions_org_template_version
  ON training_template_versions (organization_id, template_id, version_number DESC);

CREATE TABLE training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  template_version_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  instructions VARCHAR(8000) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'closed')),
  schedule_kind VARCHAR(16) NOT NULL
    CHECK (schedule_kind IN ('once', 'daily')),
  expected_count INTEGER NOT NULL CHECK (expected_count > 0 AND expected_count <= 100000),
  timezone_snapshot VARCHAR(64) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  closed_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT training_assignments_template_version_fk
    FOREIGN KEY (organization_id, template_version_id)
    REFERENCES training_template_versions(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT training_assignments_title_format CHECK (
    title = BTRIM(title) AND CHAR_LENGTH(title) BETWEEN 1 AND 200
  ),
  CONSTRAINT training_assignments_instructions_format CHECK (
    CHAR_LENGTH(instructions) <= 8000
  ),
  CONSTRAINT training_assignments_timezone_format CHECK (
    timezone_snapshot = BTRIM(timezone_snapshot)
    AND CHAR_LENGTH(timezone_snapshot) BETWEEN 1 AND 64
  ),
  CONSTRAINT training_assignments_time_range CHECK (
    (ends_at IS NULL OR ends_at > starts_at)
    AND (schedule_kind = 'daily' OR ends_at IS NOT NULL)
  ),
  CONSTRAINT training_assignments_lifecycle_time CHECK (
    (published_at IS NULL OR published_at >= created_at)
    AND (closed_at IS NULL OR (published_at IS NOT NULL AND closed_at >= published_at))
  ),
  CONSTRAINT training_assignments_lifecycle_state CHECK (
    (status = 'draft' AND published_at IS NULL AND closed_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL AND closed_at IS NULL)
    OR (status = 'closed' AND published_at IS NOT NULL AND closed_at IS NOT NULL)
  )
);

CREATE INDEX idx_training_assignments_org_status_window
  ON training_assignments (organization_id, status, starts_at, ends_at, id);
CREATE INDEX idx_training_assignments_org_template_version
  ON training_assignments (organization_id, template_version_id, created_at DESC, id);
CREATE TRIGGER training_assignments_set_updated_at
BEFORE UPDATE ON training_assignments
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Draft rows may be group selectors or direct students. Publishing expands every
-- selector into immutable student snapshot rows, while retaining the selector
-- snapshot for auditability. Only student rows are evidence/review targets.
CREATE TABLE training_assignment_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL,
  target_kind VARCHAR(16) NOT NULL CHECK (target_kind IN ('group', 'student')),
  group_id UUID,
  source_group_id UUID,
  student_id UUID,
  group_name_snapshot VARCHAR(160),
  student_display_name_snapshot VARCHAR(160),
  student_external_ref_snapshot VARCHAR(100),
  evidence_count BIGINT NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  first_evidence_at TIMESTAMPTZ,
  last_evidence_at TIMESTAMPTZ,
  latest_review_revision INTEGER NOT NULL DEFAULT 0 CHECK (latest_review_revision >= 0),
  latest_review_status VARCHAR(24)
    CHECK (latest_review_status IN ('commented', 'needs_changes', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, assignment_id, student_id),
  CONSTRAINT training_assignment_targets_assignment_fk
    FOREIGN KEY (organization_id, assignment_id)
    REFERENCES training_assignments(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT training_assignment_targets_group_fk
    FOREIGN KEY (organization_id, group_id)
    REFERENCES teaching_groups(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT training_assignment_targets_source_group_fk
    FOREIGN KEY (organization_id, source_group_id)
    REFERENCES teaching_groups(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT training_assignment_targets_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT training_assignment_targets_kind_shape CHECK (
    (
      target_kind = 'group'
      AND group_id IS NOT NULL
      AND source_group_id IS NULL
      AND student_id IS NULL
      AND student_display_name_snapshot IS NULL
      AND student_external_ref_snapshot IS NULL
    )
    OR (
      target_kind = 'student'
      AND group_id IS NULL
      AND student_id IS NOT NULL
      AND group_name_snapshot IS NULL
    )
  ),
  CONSTRAINT training_assignment_targets_group_name_format CHECK (
    group_name_snapshot IS NULL
    OR (group_name_snapshot = BTRIM(group_name_snapshot)
      AND CHAR_LENGTH(group_name_snapshot) BETWEEN 1 AND 160)
  ),
  CONSTRAINT training_assignment_targets_student_name_format CHECK (
    student_display_name_snapshot IS NULL
    OR (student_display_name_snapshot = BTRIM(student_display_name_snapshot)
      AND CHAR_LENGTH(student_display_name_snapshot) BETWEEN 1 AND 160)
  ),
  CONSTRAINT training_assignment_targets_external_ref_format CHECK (
    student_external_ref_snapshot IS NULL
    OR (student_external_ref_snapshot = BTRIM(student_external_ref_snapshot)
      AND CHAR_LENGTH(student_external_ref_snapshot) BETWEEN 1 AND 100)
  ),
  CONSTRAINT training_assignment_targets_evidence_range CHECK (
    (evidence_count = 0 AND first_evidence_at IS NULL AND last_evidence_at IS NULL)
    OR (
      evidence_count > 0
      AND first_evidence_at IS NOT NULL
      AND last_evidence_at IS NOT NULL
      AND last_evidence_at >= first_evidence_at
    )
  ),
  CONSTRAINT training_assignment_targets_review_state CHECK (
    (latest_review_revision = 0 AND latest_review_status IS NULL)
    OR (latest_review_revision > 0 AND latest_review_status IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_training_assignment_targets_group_selector
  ON training_assignment_targets (organization_id, assignment_id, group_id)
  WHERE target_kind = 'group';
CREATE INDEX idx_training_assignment_targets_org_student_assignment
  ON training_assignment_targets (organization_id, student_id, assignment_id)
  WHERE target_kind = 'student';
CREATE INDEX idx_training_assignment_targets_org_source_group_assignment
  ON training_assignment_targets (organization_id, source_group_id, assignment_id, student_id)
  WHERE target_kind = 'student' AND source_group_id IS NOT NULL;

CREATE TABLE training_assignment_goal_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL,
  metric_key VARCHAR(32) NOT NULL
    CHECK (metric_key IN ('evidence_count', 'duration_ms', 'success_count', 'best_result_ms')),
  operator VARCHAR(8) NOT NULL CHECK (operator IN ('gte', 'lte')),
  target_value BIGINT NOT NULL CHECK (target_value BETWEEN 0 AND 9007199254740991),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, assignment_id, metric_key),
  CONSTRAINT training_assignment_goal_metrics_assignment_fk
    FOREIGN KEY (organization_id, assignment_id)
    REFERENCES training_assignments(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE training_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  source VARCHAR(32) NOT NULL
    CHECK (source IN ('timer', 'predict', 'alg-trainer')),
  source_event_id VARCHAR(200) NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  trust_level VARCHAR(40) NOT NULL CHECK (
    trust_level IN (
      'self_reported',
      'server_recomputed',
      'server_challenge_recomputed',
      'server_originated'
    )
  ),
  occurred_at TIMESTAMPTZ NOT NULL,
  timezone_snapshot VARCHAR(64) NOT NULL,
  local_date DATE NOT NULL,
  activity VARCHAR(64) NOT NULL,
  duration_ms BIGINT CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
  result_ms BIGINT CHECK (result_ms IS NULL OR result_ms BETWEEN 0 AND 86400000),
  success BOOLEAN,
  metrics JSONB NOT NULL,
  payload_version INTEGER NOT NULL CHECK (payload_version BETWEEN 1 AND 100),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, id, student_id),
  UNIQUE (organization_id, student_id, source, source_event_id),
  CONSTRAINT training_evidence_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT training_evidence_source_event_format CHECK (
    source_event_id = BTRIM(source_event_id)
    AND CHAR_LENGTH(source_event_id) BETWEEN 1 AND 200
  ),
  CONSTRAINT training_evidence_payload_hash_format CHECK (
    payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT training_evidence_timezone_format CHECK (
    timezone_snapshot = BTRIM(timezone_snapshot)
    AND CHAR_LENGTH(timezone_snapshot) BETWEEN 1 AND 64
  ),
  CONSTRAINT training_evidence_source_activity CHECK (
    (source = 'timer' AND activity = 'solve')
    OR (source = 'predict' AND activity = 'prediction')
    OR (source = 'alg-trainer' AND activity = 'algorithm_attempt')
  ),
  CONSTRAINT training_evidence_json_objects CHECK (
    jsonb_typeof(metrics) = 'object' AND jsonb_typeof(payload) = 'object'
  )
);

CREATE INDEX idx_training_evidence_org_student_occurred
  ON training_evidence (organization_id, student_id, occurred_at DESC, id DESC);
CREATE INDEX idx_training_evidence_org_local_dimension
  ON training_evidence (
    organization_id, local_date, source, activity, trust_level, student_id, occurred_at, id
  );

CREATE TABLE training_evidence_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  evidence_id UUID NOT NULL,
  assignment_id UUID NOT NULL,
  student_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, evidence_id, assignment_id),
  CONSTRAINT training_evidence_assignments_evidence_fk
    FOREIGN KEY (organization_id, evidence_id, student_id)
    REFERENCES training_evidence(organization_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT training_evidence_assignments_target_fk
    FOREIGN KEY (organization_id, assignment_id, student_id)
    REFERENCES training_assignment_targets(organization_id, assignment_id, student_id) ON DELETE RESTRICT
);

CREATE INDEX idx_training_evidence_assignments_org_assignment_student
  ON training_evidence_assignments (organization_id, assignment_id, student_id, created_at, id);

CREATE TABLE training_submission_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL,
  student_id UUID NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  reviewer_user_id BIGINT,
  reviewer_user_id_snapshot BIGINT NOT NULL,
  reviewer_display_name_snapshot VARCHAR(200) NOT NULL,
  reviewer_role_snapshot VARCHAR(16) NOT NULL
    CHECK (reviewer_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')),
  status VARCHAR(24) NOT NULL
    CHECK (status IN ('commented', 'needs_changes', 'accepted')),
  rating SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  feedback VARCHAR(8000) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, assignment_id, student_id, revision),
  CONSTRAINT training_submission_reviews_target_fk
    FOREIGN KEY (organization_id, assignment_id, student_id)
    REFERENCES training_assignment_targets(organization_id, assignment_id, student_id) ON DELETE RESTRICT,
  CONSTRAINT training_submission_reviews_member_fk
    FOREIGN KEY (organization_id, reviewer_user_id)
    REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT training_submission_reviews_reviewer_snapshot_match CHECK (
    reviewer_user_id IS NULL OR reviewer_user_id = reviewer_user_id_snapshot
  ),
  CONSTRAINT training_submission_reviews_reviewer_name_format CHECK (
    reviewer_display_name_snapshot = BTRIM(reviewer_display_name_snapshot)
    AND CHAR_LENGTH(reviewer_display_name_snapshot) BETWEEN 1 AND 200
  ),
  CONSTRAINT training_submission_reviews_feedback_format CHECK (
    CHAR_LENGTH(feedback) <= 8000
  )
);

CREATE INDEX idx_training_submission_reviews_org_target_revision
  ON training_submission_reviews (organization_id, assignment_id, student_id, revision DESC);
CREATE INDEX idx_training_submission_reviews_org_reviewer
  ON training_submission_reviews (organization_id, reviewer_user_id, created_at DESC, id DESC)
  WHERE reviewer_user_id IS NOT NULL;

CREATE TABLE daily_training_rollups (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  local_date DATE NOT NULL,
  source VARCHAR(32) NOT NULL
    CHECK (source IN ('timer', 'predict', 'alg-trainer')),
  activity VARCHAR(64) NOT NULL,
  trust_level VARCHAR(40) NOT NULL CHECK (
    trust_level IN (
      'self_reported',
      'server_recomputed',
      'server_challenge_recomputed',
      'server_originated'
    )
  ),
  evidence_count BIGINT NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  success_count BIGINT NOT NULL DEFAULT 0 CHECK (
    success_count >= 0 AND success_count <= evidence_count
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, student_id, local_date, source, activity, trust_level),
  CONSTRAINT daily_training_rollups_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT daily_training_rollups_source_activity CHECK (
    (source = 'timer' AND activity = 'solve')
    OR (source = 'predict' AND activity = 'prediction')
    OR (source = 'alg-trainer' AND activity = 'algorithm_attempt')
  )
);

CREATE INDEX idx_daily_training_rollups_org_date_dimension
  ON daily_training_rollups (organization_id, local_date DESC, source, activity, trust_level, student_id);

CREATE TABLE student_account_binding_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  expired_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  consumed_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  consumed_by_user_id_snapshot BIGINT,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT student_account_binding_invites_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_account_binding_invites_token_hash_format CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT student_account_binding_invites_expiry CHECK (
    expires_at > created_at
  ),
  CONSTRAINT student_account_binding_invites_terminal_state CHECK (
    num_nonnulls(expired_at, consumed_at, revoked_at) <= 1
    AND (expired_at IS NULL OR expired_at >= expires_at)
    AND (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at))
    AND (revoked_at IS NULL OR revoked_at >= created_at)
    AND ((consumed_at IS NULL) = (consumed_by_user_id_snapshot IS NULL))
    AND (consumed_at IS NOT NULL OR consumed_by_user_id IS NULL)
    AND (
      consumed_by_user_id IS NULL
      OR consumed_by_user_id = consumed_by_user_id_snapshot
    )
    AND (revoked_at IS NOT NULL OR revoked_by_user_id IS NULL)
  )
);

CREATE UNIQUE INDEX uq_student_account_binding_invites_pending
  ON student_account_binding_invites (organization_id, student_id)
  WHERE expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_student_account_binding_invites_expiry
  ON student_account_binding_invites (expires_at)
  WHERE expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL;

CREATE FUNCTION trg_guard_student_account_binding_invite() RETURNS TRIGGER AS $$
DECLARE
  creator_reference_ok BOOLEAN;
  consumer_reference_ok BOOLEAN;
  revoker_reference_ok BOOLEAN;
  base_unchanged BOOLEAN;
  linked_student_status VARCHAR(16);
  linked_student_account_user_id BIGINT;
  linked_student_account_linked_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.consumed_at IS NOT NULL
       OR NEW.expired_at IS NOT NULL
       OR NEW.consumed_by_user_id IS NOT NULL
       OR NEW.consumed_by_user_id_snapshot IS NOT NULL
       OR NEW.revoked_at IS NOT NULL
       OR NEW.revoked_by_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'student account binding invites must start pending'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'student account binding invite history is retained'
      USING ERRCODE = '55000';
  END IF;

  creator_reference_ok := NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
    OR (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL);
  base_unchanged := NEW.id IS NOT DISTINCT FROM OLD.id
    AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
    AND NEW.student_id IS NOT DISTINCT FROM OLD.student_id
    AND NEW.token_hash IS NOT DISTINCT FROM OLD.token_hash
    AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    AND creator_reference_ok;

  IF NOT base_unchanged THEN
    RAISE EXCEPTION 'student account binding invite identity and actor references are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.expired_at IS NOT NULL OR OLD.consumed_at IS NOT NULL OR OLD.revoked_at IS NOT NULL THEN
    consumer_reference_ok := NEW.consumed_by_user_id IS NOT DISTINCT FROM OLD.consumed_by_user_id
      OR (OLD.consumed_by_user_id IS NOT NULL AND NEW.consumed_by_user_id IS NULL);
    revoker_reference_ok := NEW.revoked_by_user_id IS NOT DISTINCT FROM OLD.revoked_by_user_id
      OR (OLD.revoked_by_user_id IS NOT NULL AND NEW.revoked_by_user_id IS NULL);
    IF NOT consumer_reference_ok OR NOT revoker_reference_ok THEN
      RAISE EXCEPTION 'terminal student account binding invite actor references may only be anonymized'
        USING ERRCODE = '55000';
    END IF;
    IF (to_jsonb(NEW) - 'created_by_user_id' - 'consumed_by_user_id' - 'revoked_by_user_id')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'created_by_user_id' - 'consumed_by_user_id' - 'revoked_by_user_id') THEN
      RAISE EXCEPTION 'terminal student account binding invite state is immutable'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.consumed_at IS NOT NULL
     AND NEW.consumed_at >= NEW.created_at
     AND NEW.consumed_at < NEW.expires_at
     AND NEW.consumed_at <= clock_timestamp()
     AND NEW.expires_at > clock_timestamp()
     AND NEW.consumed_by_user_id IS NOT NULL
     AND NEW.consumed_by_user_id_snapshot = NEW.consumed_by_user_id
     AND NEW.expired_at IS NULL
     AND NEW.revoked_at IS NULL
     AND NEW.revoked_by_user_id IS NULL THEN
    PERFORM 1
    FROM app_users
    WHERE id = NEW.consumed_by_user_id
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'student account binding consumer does not exist'
        USING ERRCODE = '23503';
    END IF;
    SELECT status, account_user_id, account_linked_at
      INTO linked_student_status, linked_student_account_user_id, linked_student_account_linked_at
    FROM student_profiles
    WHERE organization_id = NEW.organization_id AND id = NEW.student_id
    FOR UPDATE;
    IF linked_student_status IS DISTINCT FROM 'active'
       OR linked_student_account_user_id IS DISTINCT FROM NEW.consumed_by_user_id
       OR linked_student_account_linked_at IS NULL
       OR linked_student_account_linked_at > NEW.consumed_at THEN
      RAISE EXCEPTION 'student account binding invite consumption requires the active linked student'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.expired_at IS NOT NULL
     AND NEW.expired_at >= NEW.expires_at
     AND NEW.expired_at <= clock_timestamp()
     AND NEW.consumed_at IS NULL
     AND NEW.consumed_by_user_id IS NULL
     AND NEW.consumed_by_user_id_snapshot IS NULL
     AND NEW.revoked_at IS NULL
     AND NEW.revoked_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.revoked_at IS NOT NULL
     AND NEW.revoked_at >= NEW.created_at
     AND NEW.revoked_at <= clock_timestamp()
     AND NEW.consumed_at IS NULL
     AND NEW.consumed_by_user_id IS NULL
     AND NEW.consumed_by_user_id_snapshot IS NULL
     AND NEW.expired_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'created_by_user_id')
     IS NOT DISTINCT FROM (to_jsonb(OLD) - 'created_by_user_id') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'student account binding invite may only be consumed or revoked once'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_account_binding_invites_guard
BEFORE INSERT OR UPDATE OR DELETE ON student_account_binding_invites
FOR EACH ROW EXECUTE FUNCTION trg_guard_student_account_binding_invite();

CREATE FUNCTION teaching_is_iana_timezone(candidate TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = candidate
  );
$$ LANGUAGE sql STABLE;

CREATE FUNCTION teaching_training_goal_is_registered(
  candidate_source TEXT,
  candidate_activity TEXT,
  candidate_metric_key TEXT,
  candidate_operator TEXT
) RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN candidate_source = 'timer' AND candidate_activity = 'solve' THEN
      (candidate_metric_key, candidate_operator) IN (
        ('evidence_count', 'gte'),
        ('duration_ms', 'gte'),
        ('success_count', 'gte'),
        ('best_result_ms', 'lte')
      )
    WHEN candidate_source = 'predict' AND candidate_activity = 'prediction' THEN
      (candidate_metric_key, candidate_operator) IN (
        ('evidence_count', 'gte'),
        ('duration_ms', 'gte'),
        ('success_count', 'gte')
      )
    WHEN candidate_source = 'alg-trainer' AND candidate_activity = 'algorithm_attempt' THEN
      (candidate_metric_key, candidate_operator) IN (
        ('evidence_count', 'gte'),
        ('duration_ms', 'gte'),
        ('success_count', 'gte')
      )
    ELSE FALSE
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION trg_guard_training_template() RETURNS TRIGGER AS $$
DECLARE
  creator_reference_ok BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'active' OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'training templates must start active'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'training templates are retained; archive instead'
      USING ERRCODE = '55000';
  END IF;

  creator_reference_ok := NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
    OR (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL);
  IF NOT creator_reference_ok THEN
    RAISE EXCEPTION 'training template creator reference is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.status = 'archived' THEN
    IF (to_jsonb(NEW) - 'updated_at' - 'created_by_user_id')
       IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'created_by_user_id') THEN
      RAISE EXCEPTION 'training template archive is terminal'
        USING ERRCODE = '55000';
    END IF;
  ELSIF NEW.status = 'archived' THEN
    IF NEW.archived_at < NEW.created_at
       OR NEW.archived_at > clock_timestamp()
       OR (to_jsonb(NEW) - 'status' - 'archived_at' - 'updated_at' - 'created_by_user_id')
          IS DISTINCT FROM
          (to_jsonb(OLD) - 'status' - 'archived_at' - 'updated_at' - 'created_by_user_id') THEN
      RAISE EXCEPTION 'training template archive transition is invalid'
        USING ERRCODE = '55000';
    END IF;
  ELSIF NEW.status <> 'active' THEN
    RAISE EXCEPTION 'training template lifecycle transition is invalid'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_templates_guard_lifecycle
BEFORE INSERT OR UPDATE OR DELETE ON training_templates
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_template();

CREATE FUNCTION trg_guard_training_template_version() RETURNS TRIGGER AS $$
DECLARE
  template_status VARCHAR(16);
  creator_reference_ok BOOLEAN;
  publisher_reference_ok BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO template_status
    FROM training_templates
    WHERE organization_id = NEW.organization_id AND id = NEW.template_id
    FOR UPDATE;
    IF template_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'training template version requires an active template'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    creator_reference_ok := NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
      OR (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL);
    publisher_reference_ok := NEW.published_by_user_id IS NOT DISTINCT FROM OLD.published_by_user_id
      OR (OLD.published_by_user_id IS NOT NULL AND NEW.published_by_user_id IS NULL);
    IF creator_reference_ok
       AND publisher_reference_ok
       AND (to_jsonb(NEW) - 'created_by_user_id' - 'published_by_user_id')
         IS NOT DISTINCT FROM (to_jsonb(OLD) - 'created_by_user_id' - 'published_by_user_id') THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'published training template versions are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_template_versions_append_only
BEFORE UPDATE OR DELETE ON training_template_versions
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_template_version();
CREATE TRIGGER training_template_versions_validate_insert
BEFORE INSERT ON training_template_versions
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_template_version();

CREATE FUNCTION trg_guard_training_assignment() RETURNS TRIGGER AS $$
DECLARE
  creator_reference_ok BOOLEAN;
  publisher_reference_ok BOOLEAN;
  closer_reference_ok BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'training assignments are retained; close instead'
      USING ERRCODE = '55000';
  END IF;
  IF NOT teaching_is_iana_timezone(NEW.timezone_snapshot) THEN
    RAISE EXCEPTION 'training assignment timezone must be an installed IANA timezone'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft'
       OR NEW.published_at IS NOT NULL
       OR NEW.closed_at IS NOT NULL
       OR NEW.published_by_user_id IS NOT NULL
       OR NEW.closed_by_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'training assignments must start as drafts'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'training assignment identity and creation time are immutable'
      USING ERRCODE = '55000';
  END IF;
  creator_reference_ok := NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
    OR (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL);
  publisher_reference_ok := NEW.published_by_user_id IS NOT DISTINCT FROM OLD.published_by_user_id
    OR (OLD.published_by_user_id IS NOT NULL AND NEW.published_by_user_id IS NULL);
  closer_reference_ok := NEW.closed_by_user_id IS NOT DISTINCT FROM OLD.closed_by_user_id
    OR (OLD.closed_by_user_id IS NOT NULL AND NEW.closed_by_user_id IS NULL);
  IF NOT creator_reference_ok THEN
    RAISE EXCEPTION 'training assignment creator reference is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
    IF NOT publisher_reference_ok OR NOT closer_reference_ok THEN
      RAISE EXCEPTION 'draft training assignment lifecycle actors are immutable'
        USING ERRCODE = '55000';
    END IF;
  ELSIF OLD.status = 'draft' AND NEW.status = 'published' THEN
    IF OLD.published_by_user_id IS NOT NULL
       OR NEW.published_by_user_id IS NULL
       OR NEW.published_at IS NULL
       OR NEW.published_at > clock_timestamp()
       OR NEW.closed_by_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'training assignment publish transition is invalid'
        USING ERRCODE = '55000';
    END IF;
  ELSIF OLD.status = 'published' AND NEW.status = 'published' THEN
    IF NOT publisher_reference_ok
       OR NOT closer_reference_ok
       OR (to_jsonb(NEW) - 'updated_at' - 'created_by_user_id' - 'published_by_user_id' - 'closed_by_user_id')
          IS DISTINCT FROM
          (to_jsonb(OLD) - 'updated_at' - 'created_by_user_id' - 'published_by_user_id' - 'closed_by_user_id') THEN
      RAISE EXCEPTION 'published training assignment schedule, content, and lifecycle are immutable'
        USING ERRCODE = '55000';
    END IF;
  ELSIF OLD.status = 'published' AND NEW.status = 'closed' THEN
    IF NOT publisher_reference_ok
       OR OLD.closed_by_user_id IS NOT NULL
       OR NEW.closed_by_user_id IS NULL
       OR NEW.closed_at IS NULL
       OR NEW.closed_at > clock_timestamp()
       OR (to_jsonb(NEW) - 'status' - 'closed_at' - 'updated_at'
             - 'created_by_user_id' - 'published_by_user_id' - 'closed_by_user_id')
          IS DISTINCT FROM
          (to_jsonb(OLD) - 'status' - 'closed_at' - 'updated_at'
             - 'created_by_user_id' - 'published_by_user_id' - 'closed_by_user_id') THEN
      RAISE EXCEPTION 'training assignment close transition is invalid'
        USING ERRCODE = '55000';
    END IF;
  ELSIF OLD.status = 'closed' AND NEW.status = 'closed' THEN
    IF NOT publisher_reference_ok
       OR NOT closer_reference_ok
       OR (to_jsonb(NEW) - 'updated_at' - 'created_by_user_id' - 'published_by_user_id' - 'closed_by_user_id')
          IS DISTINCT FROM
          (to_jsonb(OLD) - 'updated_at' - 'created_by_user_id' - 'published_by_user_id' - 'closed_by_user_id') THEN
      RAISE EXCEPTION 'closed training assignment is immutable'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    RAISE EXCEPTION 'training assignment lifecycle transition is invalid'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_assignments_guard_mutation
BEFORE INSERT OR UPDATE OR DELETE ON training_assignments
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_assignment();

CREATE FUNCTION trg_guard_training_assignment_target() RETURNS TRIGGER AS $$
DECLARE
  assignment_status VARCHAR(16);
  aggregate_changed BOOLEAN := FALSE;
  content_changed BOOLEAN := FALSE;
BEGIN
  SELECT status INTO assignment_status
  FROM training_assignments
  WHERE organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
    AND id = COALESCE(NEW.assignment_id, OLD.assignment_id)
  FOR UPDATE;

  IF assignment_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    aggregate_changed := (NEW.evidence_count, NEW.first_evidence_at, NEW.last_evidence_at,
                          NEW.latest_review_revision, NEW.latest_review_status)
      IS DISTINCT FROM
                         (OLD.evidence_count, OLD.first_evidence_at, OLD.last_evidence_at,
                          OLD.latest_review_revision, OLD.latest_review_status);
    content_changed := (to_jsonb(NEW)
                          - 'evidence_count' - 'first_evidence_at' - 'last_evidence_at'
                          - 'latest_review_revision' - 'latest_review_status')
      IS DISTINCT FROM (to_jsonb(OLD)
                          - 'evidence_count' - 'first_evidence_at' - 'last_evidence_at'
                          - 'latest_review_revision' - 'latest_review_status');
    IF aggregate_changed AND pg_trigger_depth() < 2 THEN
      RAISE EXCEPTION 'training assignment target aggregates are maintained by evidence and review triggers'
        USING ERRCODE = '55000';
    END IF;
    IF aggregate_changed AND content_changed THEN
      RAISE EXCEPTION 'training assignment target aggregate updates cannot change target identity or snapshots'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF assignment_status <> 'draft' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'published training assignment targets are immutable'
        USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'INSERT' OR content_changed THEN
      RAISE EXCEPTION 'published training assignment targets are immutable'
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_assignment_targets_guard_mutation
BEFORE INSERT OR UPDATE OR DELETE ON training_assignment_targets
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_assignment_target();

CREATE FUNCTION trg_guard_training_assignment_goal() RETURNS TRIGGER AS $$
DECLARE
  assignment_status VARCHAR(16);
  assignment_source VARCHAR(32);
  assignment_activity VARCHAR(64);
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'training assignment goal identity is immutable'
      USING ERRCODE = '55000';
  END IF;

  SELECT assignment.status, template_version.source, template_version.activity
    INTO assignment_status, assignment_source, assignment_activity
  FROM training_assignments assignment
  JOIN training_template_versions template_version
    ON template_version.organization_id = assignment.organization_id
   AND template_version.id = assignment.template_version_id
  WHERE assignment.organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
    AND assignment.id = COALESCE(NEW.assignment_id, OLD.assignment_id)
  FOR UPDATE OF assignment;
  IF assignment_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'published training assignment goals are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP <> 'DELETE'
     AND NOT teaching_training_goal_is_registered(
       assignment_source,
       assignment_activity,
       NEW.metric_key,
       NEW.operator
     ) THEN
    RAISE EXCEPTION 'training assignment goal is not registered for the template source and activity'
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_assignment_goal_metrics_guard_mutation
BEFORE INSERT OR UPDATE OR DELETE ON training_assignment_goal_metrics
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_assignment_goal();

-- Stage 1 serializes each student/group interval with a pair lock. Publishing
-- additionally needs a stable lock for the whole membership set so a new pair
-- cannot appear between group expansion and the deferred publish check.
CREATE FUNCTION trg_lock_student_group_membership_set() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO teaching_relation_locks (
    organization_id, relation_kind, subject_key, target_key
  ) VALUES (
    NEW.organization_id, 'student_group', '*', NEW.group_id::text
  )
  ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
  DO UPDATE SET revision = teaching_relation_locks.revision + 1,
                touched_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_group_memberships_00_training_publish_lock
BEFORE INSERT OR UPDATE ON student_group_memberships
FOR EACH ROW EXECUTE FUNCTION trg_lock_student_group_membership_set();

CREATE FUNCTION assert_training_assignment_has_targets(
  target_organization_id UUID,
  target_assignment_id UUID,
  validate_publish_snapshot BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
  assignment_status VARCHAR(16);
  assignment_published_at TIMESTAMPTZ;
  locked_group_id UUID;
BEGIN
  SELECT status, published_at INTO assignment_status, assignment_published_at
  FROM training_assignments
  WHERE organization_id = target_organization_id AND id = target_assignment_id;
  IF assignment_status IN ('published', 'closed') THEN
    IF validate_publish_snapshot THEN
      FOR locked_group_id IN
        SELECT group_id
        FROM training_assignment_targets
        WHERE organization_id = target_organization_id
          AND assignment_id = target_assignment_id
          AND target_kind = 'group'
        ORDER BY group_id
      LOOP
        INSERT INTO teaching_relation_locks (
          organization_id, relation_kind, subject_key, target_key
        ) VALUES (
          target_organization_id, 'student_group', '*', locked_group_id::text
        )
        ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
        DO UPDATE SET revision = teaching_relation_locks.revision + 1,
                      touched_at = clock_timestamp();
      END LOOP;

      PERFORM 1
      FROM teaching_groups teaching_group
      JOIN training_assignment_targets target
        ON target.organization_id = teaching_group.organization_id
       AND target.group_id = teaching_group.id
       AND target.target_kind = 'group'
      WHERE target.organization_id = target_organization_id
        AND target.assignment_id = target_assignment_id
      ORDER BY teaching_group.id
      FOR UPDATE OF teaching_group;

      PERFORM 1
      FROM student_profiles student
      WHERE student.organization_id = target_organization_id
        AND student.id IN (
          SELECT direct_target.student_id
          FROM training_assignment_targets direct_target
          WHERE direct_target.organization_id = target_organization_id
            AND direct_target.assignment_id = target_assignment_id
            AND direct_target.target_kind = 'student'
          UNION
          SELECT membership.student_id
          FROM training_assignment_targets group_target
          JOIN student_group_memberships membership
            ON membership.organization_id = group_target.organization_id
           AND membership.group_id = group_target.group_id
           AND membership.effective_from <= assignment_published_at
           AND (membership.effective_to IS NULL OR membership.effective_to > assignment_published_at)
          WHERE group_target.organization_id = target_organization_id
            AND group_target.assignment_id = target_assignment_id
            AND group_target.target_kind = 'group'
        )
      ORDER BY student.id
      FOR UPDATE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM training_assignment_targets
      WHERE organization_id = target_organization_id
        AND assignment_id = target_assignment_id
        AND target_kind = 'student'
        AND student_display_name_snapshot IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'published training assignment requires a student target snapshot'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM training_assignment_goal_metrics goal
      JOIN training_assignments assignment
        ON assignment.organization_id = goal.organization_id
       AND assignment.id = goal.assignment_id
      JOIN training_template_versions template_version
        ON template_version.organization_id = assignment.organization_id
       AND template_version.id = assignment.template_version_id
      WHERE goal.organization_id = target_organization_id
        AND goal.assignment_id = target_assignment_id
        AND NOT teaching_training_goal_is_registered(
          template_version.source,
          template_version.activity,
          goal.metric_key,
          goal.operator
        )
    ) THEN
      RAISE EXCEPTION 'published training assignment contains an unregistered goal'
        USING ERRCODE = '23514';
    END IF;
    IF validate_publish_snapshot AND EXISTS (
      SELECT 1 FROM training_assignment_targets
      WHERE organization_id = target_organization_id
        AND assignment_id = target_assignment_id
        AND (
          (target_kind = 'student' AND student_display_name_snapshot IS NULL)
          OR (target_kind = 'group' AND group_name_snapshot IS NULL)
        )
    ) THEN
      RAISE EXCEPTION 'published training assignment targets require display snapshots'
        USING ERRCODE = '23514';
    END IF;
    IF validate_publish_snapshot AND EXISTS (
      SELECT 1
      FROM training_assignment_targets target
      LEFT JOIN student_profiles student
        ON student.organization_id = target.organization_id
       AND student.id = target.student_id
      LEFT JOIN teaching_groups teaching_group
        ON teaching_group.organization_id = target.organization_id
       AND teaching_group.id = target.group_id
      WHERE target.organization_id = target_organization_id
        AND target.assignment_id = target_assignment_id
        AND (
          (
            target.target_kind = 'student'
            AND (
              student.id IS NULL
              OR student.status <> 'active'
              OR target.student_display_name_snapshot IS DISTINCT FROM student.display_name
              OR target.student_external_ref_snapshot IS DISTINCT FROM student.external_ref
            )
          )
          OR (
            target.target_kind = 'group'
            AND (
              teaching_group.id IS NULL
              OR teaching_group.status <> 'active'
              OR target.group_name_snapshot IS DISTINCT FROM teaching_group.name
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'published training assignment targets must match active publish-time resources'
        USING ERRCODE = '23514';
    END IF;
    IF validate_publish_snapshot AND EXISTS (
      SELECT 1
      FROM training_assignment_targets student_target
      WHERE student_target.organization_id = target_organization_id
        AND student_target.assignment_id = target_assignment_id
        AND student_target.target_kind = 'student'
        AND student_target.source_group_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM training_assignment_targets group_target
          JOIN student_group_memberships membership
            ON membership.organization_id = group_target.organization_id
           AND membership.group_id = group_target.group_id
           AND membership.student_id = student_target.student_id
           AND membership.effective_from <= assignment_published_at
           AND (membership.effective_to IS NULL OR membership.effective_to > assignment_published_at)
          JOIN student_profiles student
            ON student.organization_id = membership.organization_id
           AND student.id = membership.student_id
           AND student.status = 'active'
          WHERE group_target.organization_id = student_target.organization_id
            AND group_target.assignment_id = student_target.assignment_id
            AND group_target.target_kind = 'group'
            AND group_target.group_id = student_target.source_group_id
        )
    ) THEN
      RAISE EXCEPTION 'expanded training target source must be a selected group with an active publish-time membership'
        USING ERRCODE = '23514';
    END IF;
    IF validate_publish_snapshot AND EXISTS (
      WITH expected_students AS (
        SELECT direct_target.student_id
        FROM training_assignment_targets direct_target
        WHERE direct_target.organization_id = target_organization_id
          AND direct_target.assignment_id = target_assignment_id
          AND direct_target.target_kind = 'student'
          AND direct_target.source_group_id IS NULL
        UNION
        SELECT membership.student_id
        FROM training_assignment_targets group_target
        JOIN student_group_memberships membership
          ON membership.organization_id = group_target.organization_id
         AND membership.group_id = group_target.group_id
         AND membership.effective_from <= assignment_published_at
         AND (membership.effective_to IS NULL OR membership.effective_to > assignment_published_at)
        JOIN student_profiles student
          ON student.organization_id = membership.organization_id
         AND student.id = membership.student_id
         AND student.status = 'active'
        WHERE group_target.organization_id = target_organization_id
          AND group_target.assignment_id = target_assignment_id
          AND group_target.target_kind = 'group'
      ),
      actual_students AS (
        SELECT student_id
        FROM training_assignment_targets
        WHERE organization_id = target_organization_id
          AND assignment_id = target_assignment_id
          AND target_kind = 'student'
      )
      SELECT 1
      FROM expected_students expected
      FULL OUTER JOIN actual_students actual USING (student_id)
      WHERE expected.student_id IS NULL OR actual.student_id IS NULL
    ) THEN
      RAISE EXCEPTION 'published training student targets must exactly match direct targets and active group memberships'
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION trg_assert_training_assignment_has_targets() RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'training_assignments' THEN
    PERFORM assert_training_assignment_has_targets(
      NEW.organization_id,
      NEW.id,
      (TG_OP = 'INSERT' AND NEW.status IN ('published', 'closed'))
      OR (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'published')
    );
  ELSE
    PERFORM assert_training_assignment_has_targets(OLD.organization_id, OLD.assignment_id, FALSE);
    IF TG_OP = 'UPDATE'
       AND (NEW.organization_id, NEW.assignment_id)
         IS DISTINCT FROM (OLD.organization_id, OLD.assignment_id) THEN
      PERFORM assert_training_assignment_has_targets(NEW.organization_id, NEW.assignment_id, FALSE);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER training_assignments_require_targets
AFTER INSERT OR UPDATE ON training_assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_training_assignment_has_targets();
CREATE CONSTRAINT TRIGGER training_assignment_targets_preserve_nonempty
AFTER UPDATE OR DELETE ON training_assignment_targets
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_training_assignment_has_targets();

CREATE FUNCTION trg_prepare_training_evidence() RETURNS TRIGGER AS $$
DECLARE
  organization_timezone VARCHAR(64);
  student_status VARCHAR(16);
  student_account_user_id BIGINT;
  student_account_linked_at TIMESTAMPTZ;
  metric_success BOOLEAN;
  metric_result_text TEXT;
  metric_result_numeric NUMERIC;
  metric_result_ms BIGINT;
BEGIN
  IF NEW.occurred_at > clock_timestamp() + INTERVAL '5 minutes'
     OR NEW.created_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'training evidence timestamps cannot be more than five minutes in the future'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(NEW.metrics -> 'success') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'training evidence success must exactly match metrics.success'
      USING ERRCODE = '23514';
  END IF;
  metric_success := (NEW.metrics ->> 'success')::boolean;
  IF NEW.success IS DISTINCT FROM metric_success THEN
    RAISE EXCEPTION 'training evidence success must exactly match metrics.success'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.source = 'timer' AND NEW.activity = 'solve' THEN
    IF (NEW.metrics - 'success' - 'resultMs') <> '{}'::jsonb THEN
      RAISE EXCEPTION 'timer evidence result must exactly match registered metrics.resultMs'
        USING ERRCODE = '23514';
    END IF;
    metric_result_ms := NULL;
    IF NEW.metrics ? 'resultMs' AND NEW.metrics -> 'resultMs' <> 'null'::jsonb THEN
      IF jsonb_typeof(NEW.metrics -> 'resultMs') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'timer evidence result must exactly match registered metrics.resultMs'
          USING ERRCODE = '23514';
      END IF;
      metric_result_text := NEW.metrics ->> 'resultMs';
      IF metric_result_text !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'timer evidence result must exactly match registered metrics.resultMs'
          USING ERRCODE = '23514';
      END IF;
      metric_result_numeric := metric_result_text::NUMERIC;
      IF metric_result_numeric > 86400000 THEN
        RAISE EXCEPTION 'timer evidence result must exactly match registered metrics.resultMs'
          USING ERRCODE = '23514';
      END IF;
      metric_result_ms := metric_result_numeric::BIGINT;
    END IF;
    IF NEW.result_ms IS DISTINCT FROM metric_result_ms
       OR (metric_success AND metric_result_ms IS NULL) THEN
      RAISE EXCEPTION 'timer evidence result must exactly match registered metrics.resultMs'
        USING ERRCODE = '23514';
    END IF;
  ELSIF (NEW.metrics - 'success') <> '{}'::jsonb OR NEW.result_ms IS NOT NULL THEN
    RAISE EXCEPTION 'this training evidence activity does not register resultMs'
      USING ERRCODE = '23514';
  END IF;

  -- Account deletion takes the app-user row before unlinking student profiles.
  -- Match that order here to avoid a user/student lock inversion.
  IF NEW.submitted_by_user_id IS NOT NULL THEN
    PERFORM 1
    FROM app_users
    WHERE id = NEW.submitted_by_user_id
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'training evidence account does not exist'
        USING ERRCODE = '23503';
    END IF;
  END IF;
  IF NEW.trust_level = 'self_reported' AND NEW.submitted_by_user_id IS NULL THEN
    RAISE EXCEPTION 'self-reported training evidence requires the linked account'
      USING ERRCODE = '23514';
  END IF;

  SELECT timezone INTO organization_timezone
  FROM organizations
  WHERE id = NEW.organization_id;
  IF organization_timezone IS NULL OR NOT teaching_is_iana_timezone(organization_timezone) THEN
    RAISE EXCEPTION 'organization requires an installed IANA timezone for training evidence'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.timezone_snapshot IS DISTINCT FROM organization_timezone THEN
    RAISE EXCEPTION 'training evidence timezone must snapshot the organization timezone'
      USING ERRCODE = '23514';
  END IF;
  SELECT status, account_user_id, account_linked_at
    INTO student_status, student_account_user_id, student_account_linked_at
  FROM student_profiles
  WHERE organization_id = NEW.organization_id AND id = NEW.student_id
  FOR UPDATE;
  IF student_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'training evidence requires an active student'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.trust_level = 'self_reported' AND (
    student_account_user_id IS DISTINCT FROM NEW.submitted_by_user_id
    OR student_account_linked_at IS NULL
    OR NEW.occurred_at < student_account_linked_at
    OR NEW.created_at < student_account_linked_at
  ) THEN
    RAISE EXCEPTION 'self-reported training evidence must follow the active student account link'
      USING ERRCODE = '23514';
  END IF;
  NEW.local_date := (NEW.occurred_at AT TIME ZONE NEW.timezone_snapshot)::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_evidence_prepare
BEFORE INSERT ON training_evidence
FOR EACH ROW EXECUTE FUNCTION trg_prepare_training_evidence();

CREATE FUNCTION trg_reject_training_evidence_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.submitted_by_user_id IS NOT NULL
     AND NEW.submitted_by_user_id IS NULL
     AND (to_jsonb(NEW) - 'submitted_by_user_id')
       IS NOT DISTINCT FROM (to_jsonb(OLD) - 'submitted_by_user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'training evidence is append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_evidence_append_only
BEFORE UPDATE OR DELETE ON training_evidence
FOR EACH ROW EXECUTE FUNCTION trg_reject_training_evidence_mutation();

CREATE FUNCTION trg_rollup_training_evidence() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_training_rollups (
    organization_id,
    student_id,
    local_date,
    source,
    activity,
    trust_level,
    evidence_count,
    duration_ms,
    success_count,
    updated_at
  ) VALUES (
    NEW.organization_id,
    NEW.student_id,
    NEW.local_date,
    NEW.source,
    NEW.activity,
    NEW.trust_level,
    1,
    COALESCE(NEW.duration_ms, 0),
    CASE WHEN NEW.success IS TRUE THEN 1 ELSE 0 END,
    clock_timestamp()
  )
  ON CONFLICT (organization_id, student_id, local_date, source, activity, trust_level)
  DO UPDATE SET
    evidence_count = daily_training_rollups.evidence_count + 1,
    duration_ms = daily_training_rollups.duration_ms + EXCLUDED.duration_ms,
    success_count = daily_training_rollups.success_count + EXCLUDED.success_count,
    updated_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_evidence_rollup
AFTER INSERT ON training_evidence
FOR EACH ROW EXECUTE FUNCTION trg_rollup_training_evidence();

CREATE FUNCTION rebuild_daily_training_rollups(
  target_organization_id UUID,
  target_student_id UUID
) RETURNS VOID AS $$
BEGIN
  PERFORM 1
  FROM student_profiles
  WHERE organization_id = target_organization_id AND id = target_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'training rollup student not found'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM daily_training_rollups
  WHERE organization_id = target_organization_id AND student_id = target_student_id;

  INSERT INTO daily_training_rollups (
    organization_id,
    student_id,
    local_date,
    source,
    activity,
    trust_level,
    evidence_count,
    duration_ms,
    success_count,
    updated_at
  )
  SELECT
    organization_id,
    student_id,
    local_date,
    source,
    activity,
    trust_level,
    COUNT(*),
    COALESCE(SUM(duration_ms), 0),
    COUNT(*) FILTER (WHERE success IS TRUE),
    clock_timestamp()
  FROM training_evidence
  WHERE organization_id = target_organization_id AND student_id = target_student_id
  GROUP BY organization_id, student_id, local_date, source, activity, trust_level;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION trg_guard_training_evidence_assignment() RETURNS TRIGGER AS $$
DECLARE
  evidence_occurred_at TIMESTAMPTZ;
  evidence_source VARCHAR(32);
  evidence_activity VARCHAR(64);
  assignment_status VARCHAR(16);
  assignment_starts_at TIMESTAMPTZ;
  assignment_ends_at TIMESTAMPTZ;
  assignment_source VARCHAR(32);
  assignment_activity VARCHAR(64);
BEGIN
  SELECT occurred_at, source, activity
    INTO evidence_occurred_at, evidence_source, evidence_activity
  FROM training_evidence
  WHERE organization_id = NEW.organization_id
    AND id = NEW.evidence_id
    AND student_id = NEW.student_id;

  SELECT assignment.status, assignment.starts_at, assignment.ends_at,
         template_version.source, template_version.activity
    INTO assignment_status, assignment_starts_at, assignment_ends_at,
         assignment_source, assignment_activity
  FROM training_assignments assignment
  JOIN training_template_versions template_version
    ON template_version.organization_id = assignment.organization_id
   AND template_version.id = assignment.template_version_id
  WHERE assignment.organization_id = NEW.organization_id AND assignment.id = NEW.assignment_id
  FOR UPDATE OF assignment;

  IF evidence_occurred_at IS NULL
     OR assignment_status IS DISTINCT FROM 'published'
     OR evidence_source IS DISTINCT FROM assignment_source
     OR evidence_activity IS DISTINCT FROM assignment_activity
     OR evidence_occurred_at < assignment_starts_at
     OR (assignment_ends_at IS NOT NULL AND evidence_occurred_at >= assignment_ends_at) THEN
    RAISE EXCEPTION 'training evidence cannot be linked to this assignment target'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_evidence_assignments_validate_insert
BEFORE INSERT ON training_evidence_assignments
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_evidence_assignment();

CREATE FUNCTION trg_reject_training_evidence_assignment_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'training evidence assignment links are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_evidence_assignments_append_only
BEFORE UPDATE OR DELETE ON training_evidence_assignments
FOR EACH ROW EXECUTE FUNCTION trg_reject_training_evidence_assignment_mutation();

CREATE FUNCTION trg_update_training_target_evidence_aggregate() RETURNS TRIGGER AS $$
DECLARE
  evidence_occurred_at TIMESTAMPTZ;
BEGIN
  SELECT occurred_at INTO evidence_occurred_at
  FROM training_evidence
  WHERE organization_id = NEW.organization_id AND id = NEW.evidence_id;
  UPDATE training_assignment_targets
  SET evidence_count = evidence_count + 1,
      first_evidence_at = LEAST(COALESCE(first_evidence_at, evidence_occurred_at), evidence_occurred_at),
      last_evidence_at = GREATEST(COALESCE(last_evidence_at, evidence_occurred_at), evidence_occurred_at)
  WHERE organization_id = NEW.organization_id
    AND assignment_id = NEW.assignment_id
    AND student_id = NEW.student_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_evidence_assignments_update_target
AFTER INSERT ON training_evidence_assignments
FOR EACH ROW EXECUTE FUNCTION trg_update_training_target_evidence_aggregate();

CREATE FUNCTION trg_guard_training_submission_review() RETURNS TRIGGER AS $$
DECLARE
  assignment_status VARCHAR(16);
  target_evidence_count BIGINT;
  reviewer_status VARCHAR(16);
  reviewer_role VARCHAR(16);
  reviewer_name VARCHAR(200);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.reviewer_user_id IS NOT NULL
       AND NEW.reviewer_user_id IS NULL
       AND (to_jsonb(NEW) - 'reviewer_user_id')
         IS NOT DISTINCT FROM (to_jsonb(OLD) - 'reviewer_user_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'training submission reviews are append-only'
      USING ERRCODE = '55000';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'training submission reviews are append-only'
      USING ERRCODE = '55000';
  END IF;

  SELECT assignment.status, target.evidence_count
    INTO assignment_status, target_evidence_count
  FROM training_assignment_targets target
  JOIN training_assignments assignment
    ON assignment.organization_id = target.organization_id
   AND assignment.id = target.assignment_id
  WHERE target.organization_id = NEW.organization_id
    AND target.assignment_id = NEW.assignment_id
    AND target.student_id = NEW.student_id
    AND target.target_kind = 'student'
  FOR UPDATE OF target;
  IF assignment_status NOT IN ('published', 'closed') THEN
    RAISE EXCEPTION 'review requires a published assignment target'
      USING ERRCODE = '23514';
  END IF;
  IF target_evidence_count < 1 THEN
    RAISE EXCEPTION 'review requires a submission with training evidence'
      USING ERRCODE = '23514';
  END IF;

  SELECT member.status, member.role, app_user.display_name
    INTO reviewer_status, reviewer_role, reviewer_name
  FROM organization_members member
  JOIN app_users app_user ON app_user.id = member.user_id
  WHERE member.organization_id = NEW.organization_id
    AND member.user_id = NEW.reviewer_user_id
  FOR UPDATE OF member;
  IF reviewer_status IS DISTINCT FROM 'active'
     OR reviewer_role NOT IN ('owner', 'admin', 'teacher', 'assistant') THEN
    RAISE EXCEPTION 'reviewer must be an active teaching member'
      USING ERRCODE = '23514';
  END IF;

  NEW.reviewer_user_id_snapshot := NEW.reviewer_user_id;
  NEW.reviewer_display_name_snapshot := reviewer_name;
  NEW.reviewer_role_snapshot := reviewer_role;
  SELECT COALESCE(MAX(revision), 0) + 1 INTO NEW.revision
  FROM training_submission_reviews
  WHERE organization_id = NEW.organization_id
    AND assignment_id = NEW.assignment_id
    AND student_id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_submission_reviews_guard
BEFORE INSERT OR UPDATE OR DELETE ON training_submission_reviews
FOR EACH ROW EXECUTE FUNCTION trg_guard_training_submission_review();

CREATE FUNCTION trg_update_training_target_review_aggregate() RETURNS TRIGGER AS $$
BEGIN
  UPDATE training_assignment_targets
  SET latest_review_revision = NEW.revision,
      latest_review_status = NEW.status
  WHERE organization_id = NEW.organization_id
    AND assignment_id = NEW.assignment_id
    AND student_id = NEW.student_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_submission_reviews_update_target
AFTER INSERT ON training_submission_reviews
FOR EACH ROW EXECUTE FUNCTION trg_update_training_target_review_aggregate();
