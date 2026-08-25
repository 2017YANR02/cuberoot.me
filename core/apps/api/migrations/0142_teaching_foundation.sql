-- Multi-tenant teaching foundation. Business tables intentionally remain separate from
-- the legacy course-content tables prefixed with teaching_advanced / teaching_trial.
CREATE TABLE organizations (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               VARCHAR(64)  NOT NULL UNIQUE,
  name               VARCHAR(160) NOT NULL,
  timezone           VARCHAR(64)  NOT NULL DEFAULT 'Asia/Shanghai',
  status             VARCHAR(16)  NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'suspended', 'archived')),
  settings           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  version            INTEGER      NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id BIGINT       REFERENCES app_users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (slug = lower(slug)),
  CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  CHECK (length(trim(name)) > 0),
  CHECK (length(trim(timezone)) > 0),
  CHECK (jsonb_typeof(settings) = 'object')
);
CREATE INDEX idx_organizations_status_slug ON organizations(status, slug);
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE organization_members (
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id         BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role            VARCHAR(16) NOT NULL
                              CHECK (role IN ('owner', 'admin', 'teacher', 'assistant', 'finance', 'viewer')),
  status          VARCHAR(16) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  invited_by_user_id BIGINT   REFERENCES app_users(id) ON DELETE SET NULL,
  joined_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id),
  CHECK ((status = 'active' AND joined_at IS NOT NULL) OR status <> 'active')
);
CREATE INDEX idx_organization_members_user_active
  ON organization_members(user_id, organization_id) WHERE status = 'active';
CREATE INDEX idx_organization_members_org_role_status
  ON organization_members(organization_id, role, status, user_id);
CREATE TRIGGER organization_members_updated_at BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE student_profiles (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  account_user_id    BIGINT       REFERENCES app_users(id) ON DELETE SET NULL,
  external_ref       VARCHAR(100),
  display_name       VARCHAR(160) NOT NULL,
  status             VARCHAR(16)  NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'inactive', 'archived')),
  profile             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id BIGINT       REFERENCES app_users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CHECK (length(trim(display_name)) > 0),
  CHECK (external_ref IS NULL OR length(trim(external_ref)) > 0),
  CHECK (jsonb_typeof(profile) = 'object')
);
CREATE UNIQUE INDEX uq_student_profiles_org_external_ref
  ON student_profiles(organization_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX uq_student_profiles_org_account
  ON student_profiles(organization_id, account_user_id) WHERE account_user_id IS NOT NULL;
CREATE INDEX idx_student_profiles_org_status_name
  ON student_profiles(organization_id, status, display_name, id);
CREATE TRIGGER student_profiles_updated_at BEFORE UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE guardian_links (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  student_id         UUID        NOT NULL,
  guardian_user_id   BIGINT      REFERENCES app_users(id) ON DELETE SET NULL,
  relationship       VARCHAR(32) NOT NULL DEFAULT 'guardian',
  status             VARCHAR(16) NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'revoked')),
  visibility         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id BIGINT      REFERENCES app_users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, student_id, guardian_user_id),
  FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE CASCADE,
  CHECK (length(trim(relationship)) > 0),
  CHECK (jsonb_typeof(visibility) = 'object')
);
CREATE INDEX idx_guardian_links_org_guardian_status
  ON guardian_links(organization_id, guardian_user_id, status, student_id);
CREATE INDEX idx_guardian_links_org_student_status
  ON guardian_links(organization_id, student_id, status, guardian_user_id);
CREATE TRIGGER guardian_links_updated_at BEFORE UPDATE ON guardian_links
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE teaching_audit_events (
  id                 BIGINT       GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id      BIGINT       REFERENCES app_users(id) ON DELETE SET NULL,
  actor_role         VARCHAR(16),
  actor_display_name VARCHAR(200)  NOT NULL DEFAULT '',
  action             VARCHAR(100) NOT NULL,
  entity_type        VARCHAR(80)  NOT NULL,
  entity_id          VARCHAR(100),
  outcome            VARCHAR(16)  NOT NULL DEFAULT 'succeeded'
                                  CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  request_id         VARCHAR(100),
  metadata           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (actor_role IS NULL OR actor_role IN ('owner', 'admin', 'teacher', 'assistant', 'finance', 'viewer')),
  CHECK (length(trim(action)) > 0),
  CHECK (length(trim(entity_type)) > 0),
  CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX idx_teaching_audit_events_org_created
  ON teaching_audit_events(organization_id, created_at DESC, id DESC);
CREATE INDEX idx_teaching_audit_events_org_actor_created
  ON teaching_audit_events(organization_id, actor_user_id, created_at DESC);

CREATE FUNCTION trg_reject_teaching_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'teaching audit events are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_audit_events_append_only
  BEFORE UPDATE OR DELETE ON teaching_audit_events
  FOR EACH ROW EXECUTE FUNCTION trg_reject_teaching_audit_mutation();

CREATE TABLE teaching_idempotency_requests (
  id                 BIGINT       GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  organization_id    UUID         REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id      BIGINT       NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  scope_key          VARCHAR(100) NOT NULL,
  operation          VARCHAR(100) NOT NULL,
  idempotency_key    VARCHAR(200) NOT NULL,
  request_hash       CHAR(64)     NOT NULL,
  state              VARCHAR(16)  NOT NULL DEFAULT 'processing'
                                  CHECK (state IN ('processing', 'completed')),
  response_status    SMALLINT,
  response_body      JSONB,
  resource_type      VARCHAR(80),
  resource_id        VARCHAR(100),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ  NOT NULL,
  UNIQUE (actor_user_id, scope_key, operation, idempotency_key),
  CHECK (
    (organization_id IS NULL AND scope_key = 'global')
    OR (organization_id IS NOT NULL AND scope_key = 'org:' || organization_id::text)
  ),
  CHECK (length(trim(operation)) > 0),
  CHECK (length(trim(idempotency_key)) > 0),
  CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  CHECK (
    (state = 'processing' AND response_status IS NULL AND response_body IS NULL AND completed_at IS NULL)
    OR (state = 'completed' AND response_status IS NOT NULL AND response_body IS NOT NULL AND completed_at IS NOT NULL)
  ),
  CHECK (response_body IS NULL OR jsonb_typeof(response_body) IN ('object', 'array')),
  CHECK (expires_at > created_at)
);
CREATE INDEX idx_teaching_idempotency_requests_expiry
  ON teaching_idempotency_requests(expires_at);
CREATE INDEX idx_teaching_idempotency_requests_org_created
  ON teaching_idempotency_requests(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- Constraint triggers run at commit so organization creation and owner transfer can
-- change multiple rows atomically while every committed organization retains an owner.
CREATE FUNCTION trg_require_active_organization_owner() RETURNS TRIGGER AS $$
DECLARE
  check_organization_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    check_organization_id := NEW.id;
  ELSIF TG_OP = 'INSERT' THEN
    check_organization_id := NEW.organization_id;
  ELSE
    check_organization_id := OLD.organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM organizations WHERE id = check_organization_id)
     AND NOT EXISTS (
       SELECT 1
       FROM organization_members
       WHERE organization_id = check_organization_id
         AND role = 'owner'
         AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'organization % must retain an active owner', check_organization_id
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'organization_members'
     AND TG_OP = 'UPDATE'
     AND NEW.organization_id <> OLD.organization_id
     AND EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id)
     AND NOT EXISTS (
       SELECT 1
       FROM organization_members
       WHERE organization_id = NEW.organization_id
         AND role = 'owner'
         AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'organization % must retain an active owner', NEW.organization_id
      USING ERRCODE = '23514';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER organizations_require_active_owner
  AFTER INSERT OR UPDATE ON organizations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_require_active_organization_owner();

CREATE CONSTRAINT TRIGGER organization_members_require_active_owner
  AFTER INSERT OR UPDATE OR DELETE ON organization_members
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_require_active_organization_owner();
