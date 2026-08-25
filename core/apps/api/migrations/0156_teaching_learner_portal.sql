ALTER TABLE guardian_links
  ADD COLUMN account_linked_at TIMESTAMPTZ;

UPDATE guardian_links
SET account_linked_at = LEAST(updated_at, clock_timestamp())
WHERE guardian_user_id IS NOT NULL;

ALTER TABLE guardian_links
  ADD CONSTRAINT guardian_links_account_link_state CHECK (
    (guardian_user_id IS NULL) = (account_linked_at IS NULL)
  );

CREATE TABLE guardian_account_binding_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  guardian_link_id UUID NOT NULL,
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
  CONSTRAINT guardian_account_binding_invites_guardian_fk
    FOREIGN KEY (organization_id, guardian_link_id)
    REFERENCES guardian_links(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT guardian_account_binding_invites_token_hash_format CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT guardian_account_binding_invites_expiry CHECK (
    expires_at > created_at
  ),
  CONSTRAINT guardian_account_binding_invites_terminal_state CHECK (
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

CREATE UNIQUE INDEX uq_guardian_account_binding_invites_pending
  ON guardian_account_binding_invites (organization_id, guardian_link_id)
  WHERE expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_guardian_account_binding_invites_expiry
  ON guardian_account_binding_invites (expires_at)
  WHERE expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL;

CREATE FUNCTION trg_guard_guardian_account_binding_invite() RETURNS TRIGGER AS $$
DECLARE
  creator_reference_ok BOOLEAN;
  consumer_reference_ok BOOLEAN;
  revoker_reference_ok BOOLEAN;
  base_unchanged BOOLEAN;
  linked_guardian_status VARCHAR(16);
  linked_guardian_user_id BIGINT;
  linked_guardian_account_linked_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.consumed_at IS NOT NULL
       OR NEW.expired_at IS NOT NULL
       OR NEW.consumed_by_user_id IS NOT NULL
       OR NEW.consumed_by_user_id_snapshot IS NOT NULL
       OR NEW.revoked_at IS NOT NULL
       OR NEW.revoked_by_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'guardian account binding invites must start pending'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'guardian account binding invite history is retained'
      USING ERRCODE = '55000';
  END IF;

  creator_reference_ok := NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
    OR (OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL);
  base_unchanged := NEW.id IS NOT DISTINCT FROM OLD.id
    AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
    AND NEW.guardian_link_id IS NOT DISTINCT FROM OLD.guardian_link_id
    AND NEW.token_hash IS NOT DISTINCT FROM OLD.token_hash
    AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    AND creator_reference_ok;

  IF NOT base_unchanged THEN
    RAISE EXCEPTION 'guardian account binding invite identity and actor references are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.expired_at IS NOT NULL OR OLD.consumed_at IS NOT NULL OR OLD.revoked_at IS NOT NULL THEN
    consumer_reference_ok := NEW.consumed_by_user_id IS NOT DISTINCT FROM OLD.consumed_by_user_id
      OR (OLD.consumed_by_user_id IS NOT NULL AND NEW.consumed_by_user_id IS NULL);
    revoker_reference_ok := NEW.revoked_by_user_id IS NOT DISTINCT FROM OLD.revoked_by_user_id
      OR (OLD.revoked_by_user_id IS NOT NULL AND NEW.revoked_by_user_id IS NULL);
    IF NOT consumer_reference_ok OR NOT revoker_reference_ok THEN
      RAISE EXCEPTION 'terminal guardian account binding invite actor references may only be anonymized'
        USING ERRCODE = '55000';
    END IF;
    IF (to_jsonb(NEW) - 'created_by_user_id' - 'consumed_by_user_id' - 'revoked_by_user_id')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'created_by_user_id' - 'consumed_by_user_id' - 'revoked_by_user_id') THEN
      RAISE EXCEPTION 'terminal guardian account binding invite state is immutable'
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
    PERFORM 1 FROM app_users WHERE id = NEW.consumed_by_user_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'guardian account binding consumer does not exist'
        USING ERRCODE = '23503';
    END IF;
    SELECT status, guardian_user_id, account_linked_at
      INTO linked_guardian_status, linked_guardian_user_id, linked_guardian_account_linked_at
    FROM guardian_links
    WHERE organization_id = NEW.organization_id AND id = NEW.guardian_link_id
    FOR UPDATE;
    IF linked_guardian_status IS DISTINCT FROM 'active'
       OR linked_guardian_user_id IS DISTINCT FROM NEW.consumed_by_user_id
       OR linked_guardian_account_linked_at IS NULL
       OR linked_guardian_account_linked_at > NEW.consumed_at THEN
      RAISE EXCEPTION 'guardian account binding invite consumption requires the active linked guardian'
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

  RAISE EXCEPTION 'guardian account binding invite may only be consumed or revoked once'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guardian_account_binding_invites_guard
BEFORE INSERT OR UPDATE OR DELETE ON guardian_account_binding_invites
FOR EACH ROW EXECUTE FUNCTION trg_guard_guardian_account_binding_invite();
