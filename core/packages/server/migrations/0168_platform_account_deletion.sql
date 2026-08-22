-- 0168_platform_account_deletion.sql
-- Make main-site account deletion complete for Platform data while retaining
-- anonymous financial, revision, and audit evidence.

ALTER TABLE platform_instructors
  ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE platform_instructors
  DROP CONSTRAINT platform_instructors_user_id_fkey;
ALTER TABLE platform_instructors
  ADD CONSTRAINT platform_instructors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE platform_media_assets
  ADD COLUMN owner_tombstone_key VARCHAR(160)
  CHECK (owner_tombstone_key = BTRIM(owner_tombstone_key) AND owner_tombstone_key <> '');

ALTER TABLE platform_checkins
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN subject_key VARCHAR(160)
    CHECK (subject_key = BTRIM(subject_key) AND subject_key <> '');
ALTER TABLE platform_checkins
  DROP CONSTRAINT platform_checkins_user_id_fkey;
ALTER TABLE platform_checkins
  ADD CONSTRAINT platform_checkins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE platform_checkins
  ADD CONSTRAINT platform_checkins_subject_check
  CHECK ((user_id IS NOT NULL)::integer + (subject_key IS NOT NULL)::integer = 1);
CREATE UNIQUE INDEX uq_platform_checkins_subject_date
  ON platform_checkins(subject_key, local_date) WHERE subject_key IS NOT NULL;

ALTER TABLE platform_point_ledger
  ADD COLUMN subject_key VARCHAR(160)
    CHECK (subject_key = BTRIM(subject_key) AND subject_key <> ''),
  ADD COLUMN actor_key VARCHAR(160)
    CHECK (actor_key = BTRIM(actor_key) AND actor_key <> '');
-- 0167 already allowed a user's historical point rows to survive an account
-- deletion with user_id set to NULL. Give those pre-0168 rows a stable,
-- non-identifying subject before enforcing the live-or-tombstone invariant.
ALTER TABLE platform_point_ledger DISABLE TRIGGER platform_point_ledger_append_only;
UPDATE platform_point_ledger
SET subject_key = 'legacy-deleted:' || id::TEXT
WHERE user_id IS NULL;
ALTER TABLE platform_point_ledger ENABLE TRIGGER platform_point_ledger_append_only;
ALTER TABLE platform_point_ledger
  ADD CONSTRAINT platform_point_ledger_subject_check
  CHECK ((user_id IS NOT NULL)::integer + (subject_key IS NOT NULL)::integer = 1);

ALTER TABLE platform_entitlement_ledger
  ADD COLUMN actor_key VARCHAR(160)
  CHECK (actor_key = BTRIM(actor_key) AND actor_key <> '');

ALTER TABLE platform_instructor_revenue_ledger
  ADD COLUMN actor_key VARCHAR(160)
  CHECK (actor_key = BTRIM(actor_key) AND actor_key <> '');

ALTER TABLE platform_instructor_payouts
  ALTER COLUMN payout_profile_snapshot_encrypted DROP NOT NULL,
  ALTER COLUMN payout_key_version DROP NOT NULL;
ALTER TABLE platform_instructor_payouts
  ADD CONSTRAINT platform_instructor_payouts_profile_pair_check
  CHECK ((payout_profile_snapshot_encrypted IS NULL) = (payout_key_version IS NULL));

-- The original payout guard used <> for nullable privacy fields, so changing
-- either value to NULL could pass SQL's three-valued comparison. This guard
-- closes that gap and permits the one nested account-deletion scrub only.
CREATE OR REPLACE FUNCTION trg_guard_platform_payout_privacy() RETURNS TRIGGER AS $$
DECLARE
  delete_user_id BIGINT := NULLIF(current_setting('cuberoot.account_delete_user_id', true), '')::BIGINT;
  delete_tombstone TEXT := NULLIF(current_setting('cuberoot.account_delete_tombstone', true), '');
BEGIN
  IF NEW.payout_profile_snapshot_encrypted IS NOT DISTINCT FROM OLD.payout_profile_snapshot_encrypted
     AND NEW.payout_key_version IS NOT DISTINCT FROM OLD.payout_key_version THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() < 2
     OR delete_user_id IS NULL
     OR delete_tombstone <> 'deleted:' || delete_user_id::TEXT
     OR NEW.payout_profile_snapshot_encrypted IS NOT NULL
     OR NEW.payout_key_version IS NOT NULL
     OR NOT EXISTS (
       SELECT 1 FROM platform_instructors
       WHERE id = OLD.instructor_id AND user_id = delete_user_id
     ) THEN
    RAISE EXCEPTION 'platform payout profile snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_instructor_payouts_account_delete_guard
  BEFORE UPDATE ON platform_instructor_payouts
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_payout_privacy();

-- Reconciliation evidence remains immutable after resolution. The only
-- exception is the nested account-deletion trigger replacing the resolver's
-- live identity with its stable tombstone; source evidence, note, and time do
-- not change. A caller forging the transaction-local settings still enters at
-- trigger depth one and is rejected.
CREATE OR REPLACE FUNCTION trg_guard_platform_reconciliation_record() RETURNS TRIGGER AS $$
DECLARE
  delete_user_id BIGINT := NULLIF(current_setting('cuberoot.account_delete_user_id', true), '')::BIGINT;
  delete_owner_key TEXT := NULLIF(current_setting('cuberoot.account_delete_owner_key', true), '');
  delete_tombstone TEXT := NULLIF(current_setting('cuberoot.account_delete_tombstone', true), '');
  identity_only_delete BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'platform reconciliation evidence cannot be deleted';
  END IF;
  IF ROW(NEW.provider, NEW.merchant_account, NEW.statement_date, NEW.provider_transaction_id,
         NEW.payment_attempt_id, NEW.refund_id, NEW.amount_minor, NEW.currency, NEW.status,
         NEW.evidence_hash, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.provider, OLD.merchant_account, OLD.statement_date, OLD.provider_transaction_id,
         OLD.payment_attempt_id, OLD.refund_id, OLD.amount_minor, OLD.currency, OLD.status,
         OLD.evidence_hash, OLD.created_at) THEN
    RAISE EXCEPTION 'platform reconciliation source evidence is immutable';
  END IF;
  IF OLD.resolved_at IS NOT NULL AND ROW(NEW.resolved_by_user_id, NEW.resolved_by_actor_key, NEW.resolution_note, NEW.resolved_at)
     IS DISTINCT FROM ROW(OLD.resolved_by_user_id, OLD.resolved_by_actor_key, OLD.resolution_note, OLD.resolved_at) THEN
    identity_only_delete := pg_trigger_depth() >= 2
      AND delete_user_id IS NOT NULL
      AND delete_owner_key IS NOT NULL
      AND delete_tombstone = 'deleted:' || delete_user_id::TEXT
      AND NEW.resolved_by_user_id IS NOT DISTINCT FROM
            CASE WHEN OLD.resolved_by_user_id = delete_user_id THEN NULL ELSE OLD.resolved_by_user_id END
      AND NEW.resolved_by_actor_key IS NOT DISTINCT FROM
            CASE
              WHEN OLD.resolved_by_user_id = delete_user_id OR OLD.resolved_by_actor_key = delete_owner_key
                THEN delete_tombstone
              ELSE OLD.resolved_by_actor_key
            END
      AND NEW.resolution_note IS NOT DISTINCT FROM OLD.resolution_note
      AND NEW.resolved_at IS NOT DISTINCT FROM OLD.resolved_at;
    IF NOT identity_only_delete THEN
      RAISE EXCEPTION 'resolved platform reconciliation evidence is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE platform_privacy_consents
  DROP CONSTRAINT platform_privacy_consents_user_id_fkey;
ALTER TABLE platform_privacy_consents
  ADD CONSTRAINT platform_privacy_consents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL;

-- Replace the 0167 checks that required a live actor with checks that also
-- accept the stable deletion tombstone introduced above.
DO $$
DECLARE
  target RECORD;
  constraint_name TEXT;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('platform_media_assets', '%owner_user_id IS NOT NULL%owner_instructor_id IS NOT NULL%'),
      ('platform_point_ledger', '%actor_user_id IS NOT NULL%'),
      ('platform_entitlement_ledger', '%actor_user_id IS NOT NULL%'),
      ('platform_instructor_revenue_ledger', '%actor_user_id IS NOT NULL%')
    ) AS checks(table_name, definition_pattern)
  LOOP
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = target.table_name::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE target.definition_pattern;
    IF constraint_name IS NULL THEN
      RAISE EXCEPTION 'required Platform check not found on %', target.table_name;
    END IF;
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target.table_name, constraint_name);
    constraint_name := NULL;
  END LOOP;
END;
$$;

ALTER TABLE platform_media_assets
  ADD CONSTRAINT platform_media_assets_owner_check
  CHECK (
    owner_user_id IS NOT NULL
    OR owner_instructor_id IS NOT NULL
    OR owner_tombstone_key IS NOT NULL
  );
ALTER TABLE platform_point_ledger
  ADD CONSTRAINT platform_point_ledger_adjustment_actor_check
  CHECK (entry_type <> 'adjustment' OR (reason <> '' AND (actor_user_id IS NOT NULL OR actor_key IS NOT NULL)));
ALTER TABLE platform_entitlement_ledger
  ADD CONSTRAINT platform_entitlement_ledger_decision_actor_check
  CHECK (entry_type NOT IN ('grant', 'revocation') OR (reason <> '' AND (actor_user_id IS NOT NULL OR actor_key IS NOT NULL)));
ALTER TABLE platform_instructor_revenue_ledger
  ADD CONSTRAINT platform_instructor_revenue_ledger_adjustment_actor_check
  CHECK (entry_type <> 'adjustment' OR (reason <> '' AND (actor_user_id IS NOT NULL OR actor_key IS NOT NULL)));

-- An account deletion runs as a BEFORE DELETE trigger on app_users. The GUCs
-- identify that exact transaction, while pg_trigger_depth() prevents a caller
-- from forging them for a direct UPDATE. DELETE remains forbidden everywhere.
CREATE OR REPLACE FUNCTION trg_platform_reject_update_delete() RETURNS TRIGGER AS $$
DECLARE
  delete_user_id BIGINT := NULLIF(current_setting('cuberoot.account_delete_user_id', true), '')::BIGINT;
  delete_owner_key TEXT := NULLIF(current_setting('cuberoot.account_delete_owner_key', true), '');
  delete_tombstone TEXT := NULLIF(current_setting('cuberoot.account_delete_tombstone', true), '');
  delete_subject_hash BYTEA := decode(NULLIF(current_setting('cuberoot.account_delete_subject_hash', true), ''), 'hex');
  allowed BOOLEAN := FALSE;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR pg_trigger_depth() < 2
     OR delete_user_id IS NULL
     OR delete_owner_key IS NULL
     OR delete_tombstone <> 'deleted:' || delete_user_id::TEXT
     OR octet_length(delete_subject_hash) IS DISTINCT FROM 32 THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'platform_course_revisions' THEN
    allowed := NEW.created_by_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.created_by_user_id = delete_user_id THEN NULL ELSE OLD.created_by_user_id END
      AND NEW.published_by_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.published_by_user_id = delete_user_id THEN NULL ELSE OLD.published_by_user_id END
      AND (to_jsonb(NEW) - ARRAY['created_by_user_id', 'published_by_user_id'])
          = (to_jsonb(OLD) - ARRAY['created_by_user_id', 'published_by_user_id']);
  ELSIF TG_TABLE_NAME = 'platform_lesson_revisions' THEN
    allowed := NEW.created_by_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.created_by_user_id = delete_user_id THEN NULL ELSE OLD.created_by_user_id END
      AND NEW.published_by_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.published_by_user_id = delete_user_id THEN NULL ELSE OLD.published_by_user_id END
      AND (to_jsonb(NEW) - ARRAY['created_by_user_id', 'published_by_user_id'])
          = (to_jsonb(OLD) - ARRAY['created_by_user_id', 'published_by_user_id']);
  ELSIF TG_TABLE_NAME = 'platform_quiz_revisions' THEN
    allowed := NEW.created_by_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.created_by_user_id = delete_user_id THEN NULL ELSE OLD.created_by_user_id END
      AND (to_jsonb(NEW) - 'created_by_user_id') = (to_jsonb(OLD) - 'created_by_user_id');
  ELSIF TG_TABLE_NAME = 'platform_inventory_ledger' THEN
    allowed := NEW.actor_user_id IS NULL AND NEW.actor_key = delete_tombstone
      AND (OLD.actor_user_id = delete_user_id OR OLD.actor_key = delete_owner_key)
      AND (to_jsonb(NEW) - ARRAY['actor_user_id', 'actor_key'])
          = (to_jsonb(OLD) - ARRAY['actor_user_id', 'actor_key']);
  ELSIF TG_TABLE_NAME = 'platform_fulfillment_ledger' THEN
    allowed := NEW.actor_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.actor_user_id = delete_user_id THEN NULL ELSE OLD.actor_user_id END
      AND (to_jsonb(NEW) - 'actor_user_id') = (to_jsonb(OLD) - 'actor_user_id');
  ELSIF TG_TABLE_NAME = 'platform_entitlement_ledger' THEN
    allowed := NEW.actor_user_id IS NULL AND NEW.actor_key = delete_tombstone
      AND (OLD.actor_user_id = delete_user_id OR OLD.actor_key = delete_owner_key)
      AND (to_jsonb(NEW) - ARRAY['actor_user_id', 'actor_key'])
          = (to_jsonb(OLD) - ARRAY['actor_user_id', 'actor_key']);
  ELSIF TG_TABLE_NAME = 'platform_membership_ledger' THEN
    allowed := NEW.actor_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.actor_user_id = delete_user_id THEN NULL ELSE OLD.actor_user_id END
      AND (to_jsonb(NEW) - 'actor_user_id') = (to_jsonb(OLD) - 'actor_user_id');
  ELSIF TG_TABLE_NAME = 'platform_point_ledger' THEN
    allowed := NEW.user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.user_id = delete_user_id THEN NULL ELSE OLD.user_id END
      AND NEW.subject_key IS NOT DISTINCT FROM
                 CASE WHEN OLD.user_id = delete_user_id THEN delete_tombstone ELSE OLD.subject_key END
      AND NEW.actor_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.actor_user_id = delete_user_id THEN NULL ELSE OLD.actor_user_id END
      AND NEW.actor_key IS NOT DISTINCT FROM
                 CASE WHEN OLD.actor_user_id = delete_user_id OR OLD.actor_key = delete_owner_key THEN delete_tombstone ELSE OLD.actor_key END
      AND (to_jsonb(NEW) - ARRAY['user_id', 'subject_key', 'actor_user_id', 'actor_key'])
          = (to_jsonb(OLD) - ARRAY['user_id', 'subject_key', 'actor_user_id', 'actor_key']);
  ELSIF TG_TABLE_NAME = 'platform_instructor_revenue_ledger' THEN
    allowed := NEW.actor_user_id IS NULL AND NEW.actor_key = delete_tombstone
      AND (OLD.actor_user_id = delete_user_id OR OLD.actor_key = delete_owner_key)
      AND (to_jsonb(NEW) - ARRAY['actor_user_id', 'actor_key'])
          = (to_jsonb(OLD) - ARRAY['actor_user_id', 'actor_key']);
  ELSIF TG_TABLE_NAME = 'platform_qr_revisions' THEN
    allowed := NEW.approved_by_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.approved_by_user_id = delete_user_id THEN NULL ELSE OLD.approved_by_user_id END
      AND NEW.approved_by_actor_key IS NOT DISTINCT FROM
                 CASE WHEN OLD.approved_by_user_id = delete_user_id OR OLD.approved_by_actor_key = delete_owner_key THEN delete_tombstone ELSE OLD.approved_by_actor_key END
      AND NEW.created_by_user_id IS NOT DISTINCT FROM
                 CASE WHEN OLD.created_by_user_id = delete_user_id THEN NULL ELSE OLD.created_by_user_id END
      AND (to_jsonb(NEW) - ARRAY['approved_by_user_id', 'approved_by_actor_key', 'created_by_user_id'])
          = (to_jsonb(OLD) - ARRAY['approved_by_user_id', 'approved_by_actor_key', 'created_by_user_id']);
  ELSIF TG_TABLE_NAME = 'platform_privacy_consents' THEN
    allowed := OLD.user_id = delete_user_id
      AND NEW.user_id IS NULL
      AND NEW.anonymous_subject_hash = delete_subject_hash
      AND (to_jsonb(NEW) - ARRAY['user_id', 'anonymous_subject_hash'])
          = (to_jsonb(OLD) - ARRAY['user_id', 'anonymous_subject_hash']);
  ELSIF TG_TABLE_NAME = 'platform_audit_events' THEN
    allowed := NEW.actor_user_id IS NULL AND NEW.actor_key = delete_tombstone
      AND (OLD.actor_user_id = delete_user_id OR OLD.actor_key = delete_owner_key)
      AND (to_jsonb(NEW) - ARRAY['actor_user_id', 'actor_key'])
          = (to_jsonb(OLD) - ARRAY['actor_user_id', 'actor_key']);
  END IF;

  IF allowed THEN RETURN NEW; END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Keep point reversals bound to the same anonymized subject. Comparing NULL
-- user ids alone would merge every deleted account into one identity.
CREATE OR REPLACE FUNCTION trg_validate_platform_exact_reversal() RETURNS TRIGGER AS $$
DECLARE
  source_id UUID;
  source_parent UUID;
  source_delta BIGINT;
  source_currency VARCHAR(3);
  source_is_reversal BOOLEAN;
BEGIN
  IF NEW.reversal_of_ledger_id IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'platform_fulfillment_ledger' THEN
    SELECT id, order_item_id, delta_quantity::bigint, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_fulfillment_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.order_item_id OR source_is_reversal OR NEW.delta_quantity::bigint <> -source_delta THEN
      RAISE EXCEPTION 'platform fulfillment reversal must exactly reverse one entry for the same order item';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_entitlement_ledger' THEN
    SELECT id, entitlement_id, delta_access::bigint, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_entitlement_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.entitlement_id OR source_is_reversal OR NEW.delta_access::bigint <> -source_delta THEN
      RAISE EXCEPTION 'platform entitlement reversal must exactly reverse one entry for the same entitlement';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_membership_ledger' THEN
    SELECT id, membership_id, delta_access::bigint, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_membership_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.membership_id OR source_is_reversal OR NEW.delta_access::bigint <> -source_delta THEN
      RAISE EXCEPTION 'platform membership reversal must exactly reverse one entry for the same membership';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_point_ledger' THEN
    SELECT id, NULL::uuid, delta_points, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_point_ledger
      WHERE id = NEW.reversal_of_ledger_id
        AND user_id IS NOT DISTINCT FROM NEW.user_id
        AND subject_key IS NOT DISTINCT FROM NEW.subject_key
      FOR UPDATE;
    IF source_id IS NULL OR source_is_reversal OR NEW.delta_points <> -source_delta THEN
      RAISE EXCEPTION 'platform point reversal must exactly reverse one entry for the same user';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_instructor_revenue_ledger' THEN
    SELECT id, instructor_id, delta_amount_minor, currency, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_instructor_revenue_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.instructor_id OR source_is_reversal
       OR NEW.delta_amount_minor <> -source_delta OR NEW.currency <> source_currency THEN
      RAISE EXCEPTION 'platform instructor revenue reversal must exactly reverse one entry in the same currency';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- This is the sole nested caller permitted to relink append-only identity
-- columns. Direct GUC forgery still enters those row triggers at depth one.
CREATE OR REPLACE FUNCTION trg_platform_prepare_account_delete() RETURNS TRIGGER AS $$
DECLARE
  owner_key TEXT := COALESCE(NULLIF(OLD.wca_id, ''), 'u' || OLD.id::TEXT);
  tombstone TEXT := 'deleted:' || OLD.id::TEXT;
  subject_hash BYTEA := decode(
    replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', ''),
    'hex'
  );
BEGIN
  PERFORM set_config('cuberoot.account_delete_user_id', OLD.id::TEXT, true);
  PERFORM set_config('cuberoot.account_delete_owner_key', owner_key, true);
  PERFORM set_config('cuberoot.account_delete_tombstone', tombstone, true);
  PERFORM set_config('cuberoot.account_delete_subject_hash', encode(subject_hash, 'hex'), true);

  -- Private, short-lived, or account-only rows do not survive deletion.
  DELETE FROM platform_outbox_events
  WHERE payload ->> 'userId' = OLD.id::TEXT
     OR LEFT(dedupe_key, LENGTH('learning.progress:' || OLD.id::TEXT || ':'))
        = 'learning.progress:' || OLD.id::TEXT || ':';
  DELETE FROM platform_idempotency_requests
    WHERE actor_user_id = OLD.id OR actor_key = owner_key;
  DELETE FROM platform_analytics_events WHERE user_id = OLD.id;
  DELETE FROM platform_qr_scans WHERE user_id = OLD.id;
  DELETE FROM platform_quiz_attempts WHERE user_id = OLD.id;
  DELETE FROM platform_user_achievements WHERE user_id = OLD.id;
  DELETE FROM platform_invite_redemptions WHERE user_id = OLD.id;
  DELETE FROM platform_shipping_addresses WHERE user_id = OLD.id;
  DELETE FROM platform_lesson_progress WHERE user_id = OLD.id;
  DELETE FROM platform_lesson_notes WHERE user_id = OLD.id;
  DELETE FROM platform_favorites WHERE user_id = OLD.id;

  -- Retained business rows lose names, encrypted personal snapshots, and live
  -- ownership. Stable tombstones keep separate deleted actors distinguishable.
  UPDATE platform_instructor_applications
  SET applicant_user_id = CASE WHEN applicant_user_id = OLD.id THEN NULL ELSE applicant_user_id END,
      applicant_display_name_snapshot = CASE WHEN applicant_user_id = OLD.id THEN 'Deleted applicant' ELSE applicant_display_name_snapshot END,
      application_snapshot = CASE WHEN applicant_user_id = OLD.id THEN '{}'::jsonb ELSE application_snapshot END,
      decided_by_user_id = CASE WHEN decided_by_user_id = OLD.id THEN NULL ELSE decided_by_user_id END,
      decided_by_actor_key = CASE
        WHEN decided_by_user_id = OLD.id AND status = 'pending' THEN NULL
        WHEN decided_by_user_id = OLD.id OR decided_by_actor_key = owner_key THEN tombstone
        ELSE decided_by_actor_key
      END
  WHERE applicant_user_id = OLD.id OR decided_by_user_id = OLD.id OR decided_by_actor_key = owner_key;

  UPDATE platform_media_assets
  SET owner_user_id = NULL,
      owner_tombstone_key = tombstone,
      access_scope = 'admin',
      status = 'archived',
      metadata = '{}'::jsonb
  WHERE owner_user_id = OLD.id;

  UPDATE platform_orders
  SET buyer_user_id = NULL,
      buyer_display_name_snapshot = '',
      shipping_snapshot_encrypted = NULL,
      shipping_key_version = NULL
  WHERE buyer_user_id = OLD.id;

  UPDATE platform_event_registrations
  SET user_id = NULL,
      attendee_snapshot_encrypted = NULL,
      attendee_key_version = NULL
  WHERE user_id = OLD.id;

  UPDATE platform_course_reviews SET user_id = NULL WHERE user_id = OLD.id;
  UPDATE platform_certificates
  SET user_id = CASE WHEN user_id = OLD.id THEN NULL ELSE user_id END,
      recipient_name_snapshot = CASE WHEN user_id = OLD.id THEN 'Deleted recipient' ELSE recipient_name_snapshot END,
      image_media_id = CASE WHEN user_id = OLD.id THEN NULL ELSE image_media_id END,
      issued_by_user_id = CASE WHEN issued_by_user_id = OLD.id THEN NULL ELSE issued_by_user_id END
  WHERE user_id = OLD.id OR issued_by_user_id = OLD.id;

  UPDATE platform_checkins
  SET user_id = NULL, subject_key = tombstone
  WHERE user_id = OLD.id;

  UPDATE platform_instructor_payouts p
  SET payout_profile_snapshot_encrypted = NULL,
      payout_key_version = NULL,
      approved_by_user_id = CASE WHEN p.approved_by_user_id = OLD.id THEN NULL ELSE p.approved_by_user_id END,
      approved_by_actor_key = CASE WHEN p.approved_by_user_id = OLD.id OR p.approved_by_actor_key = owner_key THEN tombstone ELSE p.approved_by_actor_key END,
      paid_by_user_id = CASE WHEN p.paid_by_user_id = OLD.id THEN NULL ELSE p.paid_by_user_id END,
      paid_by_actor_key = CASE WHEN p.paid_by_user_id = OLD.id OR p.paid_by_actor_key = owner_key THEN tombstone ELSE p.paid_by_actor_key END
  FROM platform_instructors i
  WHERE p.instructor_id = i.id
    AND i.user_id = OLD.id;

  UPDATE platform_instructor_payouts p
  SET approved_by_user_id = CASE WHEN p.approved_by_user_id = OLD.id THEN NULL ELSE p.approved_by_user_id END,
      approved_by_actor_key = CASE WHEN p.approved_by_user_id = OLD.id OR p.approved_by_actor_key = owner_key THEN tombstone ELSE p.approved_by_actor_key END,
      paid_by_user_id = CASE WHEN p.paid_by_user_id = OLD.id THEN NULL ELSE p.paid_by_user_id END,
      paid_by_actor_key = CASE WHEN p.paid_by_user_id = OLD.id OR p.paid_by_actor_key = owner_key THEN tombstone ELSE p.paid_by_actor_key END
  FROM platform_instructors i
  WHERE p.instructor_id = i.id
    AND i.user_id IS DISTINCT FROM OLD.id
    AND (p.approved_by_user_id = OLD.id OR p.paid_by_user_id = OLD.id
         OR p.approved_by_actor_key = owner_key OR p.paid_by_actor_key = owner_key);

  UPDATE platform_refunds
  SET requested_by_user_id = CASE WHEN requested_by_user_id = OLD.id THEN NULL ELSE requested_by_user_id END,
      decided_by_user_id = CASE WHEN decided_by_user_id = OLD.id THEN NULL ELSE decided_by_user_id END,
      decided_by_actor_key = CASE WHEN decided_by_user_id = OLD.id OR decided_by_actor_key = owner_key THEN tombstone ELSE decided_by_actor_key END
  WHERE requested_by_user_id = OLD.id OR decided_by_user_id = OLD.id OR decided_by_actor_key = owner_key;

  UPDATE platform_reconciliation_records
  SET resolved_by_user_id = NULL, resolved_by_actor_key = tombstone
  WHERE resolved_by_user_id = OLD.id OR resolved_by_actor_key = owner_key;

  UPDATE platform_qr_codes
  SET owner_user_id = CASE WHEN owner_user_id = OLD.id THEN NULL ELSE owner_user_id END,
      created_by_user_id = CASE WHEN created_by_user_id = OLD.id THEN NULL ELSE created_by_user_id END,
      status = CASE WHEN owner_user_id = OLD.id THEN 'archived' ELSE status END,
      archived_at = CASE WHEN owner_user_id = OLD.id THEN COALESCE(archived_at, NOW()) ELSE archived_at END
  WHERE owner_user_id = OLD.id OR created_by_user_id = OLD.id;

  UPDATE platform_instructors
  SET user_id = NULL,
      teacher_entry_id = NULL,
      status = 'archived',
      display_name_snapshot = 'Deleted instructor',
      bio_zh = '',
      bio_en = '',
      payout_profile_encrypted = NULL,
      payout_key_version = NULL
  WHERE user_id = OLD.id;

  -- Immutable evidence is relinked through the depth-gated trigger above.
  UPDATE platform_course_revisions
  SET created_by_user_id = CASE WHEN created_by_user_id = OLD.id THEN NULL ELSE created_by_user_id END,
      published_by_user_id = CASE WHEN published_by_user_id = OLD.id THEN NULL ELSE published_by_user_id END
  WHERE created_by_user_id = OLD.id OR published_by_user_id = OLD.id;
  UPDATE platform_lesson_revisions
  SET created_by_user_id = CASE WHEN created_by_user_id = OLD.id THEN NULL ELSE created_by_user_id END,
      published_by_user_id = CASE WHEN published_by_user_id = OLD.id THEN NULL ELSE published_by_user_id END
  WHERE created_by_user_id = OLD.id OR published_by_user_id = OLD.id;
  UPDATE platform_quiz_revisions SET created_by_user_id = NULL WHERE created_by_user_id = OLD.id;
  UPDATE platform_inventory_ledger SET actor_user_id = NULL, actor_key = tombstone
    WHERE actor_user_id = OLD.id OR actor_key = owner_key;
  UPDATE platform_fulfillment_ledger SET actor_user_id = NULL WHERE actor_user_id = OLD.id;
  UPDATE platform_entitlement_ledger SET actor_user_id = NULL, actor_key = tombstone
    WHERE actor_user_id = OLD.id OR actor_key = owner_key;
  UPDATE platform_membership_ledger SET actor_user_id = NULL WHERE actor_user_id = OLD.id;
  UPDATE platform_point_ledger
  SET user_id = CASE WHEN user_id = OLD.id THEN NULL ELSE user_id END,
      subject_key = CASE WHEN user_id = OLD.id THEN tombstone ELSE subject_key END,
      actor_user_id = CASE WHEN actor_user_id = OLD.id THEN NULL ELSE actor_user_id END,
      actor_key = CASE WHEN actor_user_id = OLD.id OR actor_key = owner_key THEN tombstone ELSE actor_key END
  WHERE user_id = OLD.id OR actor_user_id = OLD.id OR actor_key = owner_key;
  UPDATE platform_instructor_revenue_ledger SET actor_user_id = NULL, actor_key = tombstone
    WHERE actor_user_id = OLD.id OR actor_key = owner_key;
  UPDATE platform_qr_revisions
  SET approved_by_user_id = CASE WHEN approved_by_user_id = OLD.id THEN NULL ELSE approved_by_user_id END,
      approved_by_actor_key = CASE WHEN approved_by_user_id = OLD.id OR approved_by_actor_key = owner_key THEN tombstone ELSE approved_by_actor_key END,
      created_by_user_id = CASE WHEN created_by_user_id = OLD.id THEN NULL ELSE created_by_user_id END
  WHERE approved_by_user_id = OLD.id OR approved_by_actor_key = owner_key OR created_by_user_id = OLD.id;
  UPDATE platform_privacy_consents
  SET user_id = NULL, anonymous_subject_hash = subject_hash
  WHERE user_id = OLD.id;
  UPDATE platform_audit_events SET actor_user_id = NULL, actor_key = tombstone
    WHERE actor_user_id = OLD.id OR actor_key = owner_key;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_prepare_account_delete ON app_users;
CREATE TRIGGER platform_prepare_account_delete
  BEFORE DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION trg_platform_prepare_account_delete();
