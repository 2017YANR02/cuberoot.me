-- PostgreSQL does not guarantee short-circuit evaluation for SQL boolean
-- expressions. Branch by trigger table before referencing row fields that only
-- exist on organization_members.
CREATE OR REPLACE FUNCTION trg_require_active_organization_owner() RETURNS TRIGGER AS $$
DECLARE
  check_organization_id UUID;
  moved_organization_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    check_organization_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'organization_members' THEN
    IF TG_OP = 'INSERT' THEN
      check_organization_id := NEW.organization_id;
    ELSE
      check_organization_id := OLD.organization_id;
      IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
          moved_organization_id := NEW.organization_id;
        END IF;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported owner guard trigger table %', TG_TABLE_NAME;
  END IF;

  -- Serialize owner validation per organization. When a membership moves between
  -- organizations, the stable UUID order also prevents opposite moves deadlocking.
  PERFORM id
  FROM organizations
  WHERE id = check_organization_id
     OR id = moved_organization_id
  ORDER BY id
  FOR UPDATE;

  IF EXISTS (SELECT 1 FROM organizations WHERE id = check_organization_id) THEN
    IF NOT EXISTS (
       SELECT 1
       FROM organization_members
       WHERE organization_id = check_organization_id
         AND role = 'owner'
         AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'organization % must retain an active owner', check_organization_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF moved_organization_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM organizations WHERE id = moved_organization_id) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM organization_members
        WHERE organization_id = moved_organization_id
          AND role = 'owner'
          AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'organization % must retain an active owner', moved_organization_id
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
