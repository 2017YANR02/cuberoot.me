\set ON_ERROR_STOP on

BEGIN;
CREATE SCHEMA platform_account_delete_fixture;
SET LOCAL search_path = platform_account_delete_fixture, public;

CREATE TABLE app_users (
  id BIGINT PRIMARY KEY,
  wca_id VARCHAR(20)
);
CREATE TABLE teacher_directory_entries (id BIGINT PRIMARY KEY);
CREATE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\ir ../../migrations/0167_platform_core.sql

-- Exercise a real 0167 -> 0168 upgrade: user_id was nullable on the point
-- ledger, so an already-anonymous row accepted by the old schema must be
-- backfilled before the new XOR subject constraint is validated.
INSERT INTO platform_point_ledger(
  id, entry_type, delta_points, balance_after
) VALUES (
  '00000000-0000-0000-0000-000000000100', 'achievement', 1, 1
);

\ir ../../migrations/0168_platform_account_deletion.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM platform_point_ledger
    WHERE id = '00000000-0000-0000-0000-000000000100'
      AND user_id IS NULL
      AND subject_key = 'legacy-deleted:00000000-0000-0000-0000-000000000100'
  ) THEN
    RAISE EXCEPTION 'legacy point subject was not backfilled during upgrade';
  END IF;
END;
$$;

DO $$
DECLARE
  fk_count INTEGER;
  table_count INTEGER;
  set_null_count INTEGER;
  cascade_count INTEGER;
  restrict_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT conrelid),
         COUNT(*) FILTER (WHERE confdeltype = 'n'),
         COUNT(*) FILTER (WHERE confdeltype = 'c'),
         COUNT(*) FILTER (WHERE confdeltype = 'r')
    INTO fk_count, table_count, set_null_count, cascade_count, restrict_count
  FROM pg_constraint
  WHERE contype = 'f' AND confrelid = 'app_users'::regclass
    AND conrelid::regclass::text LIKE 'platform_%';
  IF ROW(fk_count, table_count, set_null_count, cascade_count, restrict_count)
     IS DISTINCT FROM ROW(57, 48, 53, 4, 0) THEN
    RAISE EXCEPTION 'unexpected Platform app_users FK inventory: %/%/%/%/%',
      fk_count, table_count, set_null_count, cascade_count, restrict_count;
  END IF;
END;
$$;

INSERT INTO app_users(id, wca_id) VALUES (101, '2099TEST01');
INSERT INTO platform_instructors(
  id, user_id, status, display_name_snapshot, bio_zh, payout_profile_encrypted, payout_key_version
) VALUES (
  '00000000-0000-0000-0000-000000000101', 101, 'active', 'Private Teacher', 'private bio', '\x01', 1
);
INSERT INTO platform_instructor_applications(
  id, applicant_user_id, applicant_display_name_snapshot, application_snapshot
) VALUES (
  '00000000-0000-0000-0000-000000000102', 101, 'Private Applicant', '{"phone":"private"}'
);
INSERT INTO platform_media_assets(
  id, owner_user_id, storage_key, mime_type, size_bytes, sha256, access_scope, status, metadata
) VALUES (
  '00000000-0000-0000-0000-000000000103', 101, 'private/object', 'image/png', 1,
  decode(repeat('01', 32), 'hex'), 'instructor', 'ready', '{"private":"value"}'
);

INSERT INTO platform_courses(id, slug, created_by_user_id)
VALUES ('00000000-0000-0000-0000-000000000104', 'fixture-course', 101);
INSERT INTO platform_course_revisions(
  course_id, revision, title_en, content_hash, created_by_user_id, published_by_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000104', 1, 'Fixture course',
  decode(repeat('02', 32), 'hex'), 101, 101
);
-- account-delete-evidence: platform_course_revisions
INSERT INTO platform_lessons(id, course_id, slug, ordinal)
VALUES ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000104', 'lesson', 1);
INSERT INTO platform_lesson_revisions(
  lesson_id, revision, title_en, content_hash, created_by_user_id, published_by_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000105', 1, 'Fixture lesson',
  decode(repeat('03', 32), 'hex'), 101, 101
);
-- account-delete-evidence: platform_lesson_revisions
INSERT INTO platform_quizzes(id, lesson_id, slug)
VALUES ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000105', 'quiz');
INSERT INTO platform_quiz_revisions(
  quiz_id, revision, title_en, passing_score_bps, content_hash, created_by_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000106', 1, 'Fixture quiz', 8000,
  decode(repeat('04', 32), 'hex'), 101
);
-- account-delete-evidence: platform_quiz_revisions
INSERT INTO platform_quiz_attempts(
  id, user_id, quiz_id, quiz_revision, attempt_number, answers_snapshot_encrypted, answers_key_version
) VALUES (
  '00000000-0000-0000-0000-000000000107', 101,
  '00000000-0000-0000-0000-000000000106', 1, 1, '\x01', 1
);

INSERT INTO platform_products(id, slug, product_type, title_en, created_by_user_id)
VALUES ('00000000-0000-0000-0000-000000000108', 'fixture-product', 'physical', 'Fixture product', 101);
INSERT INTO platform_product_variants(
  id, product_id, sku, title_en, amount_minor, currency, inventory_on_hand
) VALUES (
  '00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000108',
  'FIXTURE-SKU', 'Fixture variant', 100, 'CNY', 0
);
INSERT INTO platform_inventory_ledger(
  id, product_variant_id, entry_type, delta_on_hand, actor_user_id, actor_key
) VALUES (
  '00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000109',
  'stock_in', 1, 101, '2099TEST01'
);
-- account-delete-evidence: platform_inventory_ledger

INSERT INTO platform_orders(
  id, order_number, buyer_user_id, buyer_display_name_snapshot, client_order_key,
  currency, subtotal_amount_minor, total_amount_minor, pricing_snapshot
) VALUES (
  '00000000-0000-0000-0000-000000000127', 'PLT-FIXTURE000001', 101, 'Private Buyer',
  'fixture-order', 'CNY', 100, 100, '{"fixture":"pricing"}'
);
INSERT INTO platform_order_items(
  id, order_id, line_number, product_variant_id, sellable_type, sellable_snapshot,
  quantity, unit_amount_minor, line_total_amount_minor, currency, fulfillment_type
) VALUES (
  '00000000-0000-0000-0000-000000000128', '00000000-0000-0000-0000-000000000127', 1,
  '00000000-0000-0000-0000-000000000109', 'product_variant', '{"fixture":"sellable"}',
  1, 100, 100, 'CNY', 'shipment'
);
INSERT INTO platform_fulfillment_ledger(
  id, order_id, order_item_id, entry_type, delta_quantity, metadata, actor_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000129', '00000000-0000-0000-0000-000000000127',
  '00000000-0000-0000-0000-000000000128', 'reserve', 1, '{"fixture":"fulfillment"}', 101
);
-- account-delete-evidence: platform_fulfillment_ledger

INSERT INTO platform_course_entitlements(id, user_id, course_id, valid_from)
VALUES ('00000000-0000-0000-0000-000000000111', 101, '00000000-0000-0000-0000-000000000104', NOW());
INSERT INTO platform_entitlement_ledger(
  id, entitlement_id, entry_type, delta_access, valid_from, reason, actor_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000111',
  'grant', 1, NOW(), 'fixture grant', 101
);
-- account-delete-evidence: platform_entitlement_ledger
INSERT INTO platform_course_reviews(id, user_id, course_id, entitlement_id, rating, body)
VALUES (
  '00000000-0000-0000-0000-000000000113', 101, '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000111', 5, 'public review'
);

INSERT INTO platform_membership_plans(
  id, slug, name_en, period_unit, period_count, amount_minor, currency
) VALUES (
  '00000000-0000-0000-0000-000000000114', 'fixture-plan', 'Fixture plan', 'month', 1, 100, 'CNY'
);
INSERT INTO platform_memberships(id, user_id, plan_id, valid_from)
VALUES ('00000000-0000-0000-0000-000000000115', 101, '00000000-0000-0000-0000-000000000114', NOW());
INSERT INTO platform_membership_ledger(
  id, membership_id, entry_type, delta_access, valid_from, reason, actor_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000116', '00000000-0000-0000-0000-000000000115',
  'grant', 1, NOW(), 'fixture grant', 101
);
-- account-delete-evidence: platform_membership_ledger

INSERT INTO platform_checkins(id, user_id, local_date, timezone, points_awarded)
VALUES ('00000000-0000-0000-0000-000000000117', 101, DATE '2099-01-01', 'UTC', 1);
INSERT INTO platform_point_ledger(
  id, user_id, entry_type, delta_points, balance_after, checkin_id, actor_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000118', 101, 'checkin', 1, 1,
  '00000000-0000-0000-0000-000000000117', 101
);
-- account-delete-evidence: platform_point_ledger
INSERT INTO platform_instructor_revenue_ledger(
  id, instructor_id, entry_type, delta_amount_minor, currency, reason, actor_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000119', '00000000-0000-0000-0000-000000000101',
  'adjustment', 100, 'CNY', 'fixture adjustment', 101
);
-- account-delete-evidence: platform_instructor_revenue_ledger
INSERT INTO platform_instructor_payouts(
  id, instructor_id, payout_number, amount_minor, currency,
  payout_profile_snapshot_encrypted, payout_key_version
) VALUES (
  '00000000-0000-0000-0000-000000000120', '00000000-0000-0000-0000-000000000101',
  'PLT-PO-ABCDEFGHIJ', 100, 'CNY', '\x01', 1
);

INSERT INTO platform_qr_codes(
  id, code, current_revision, owner_user_id, created_by_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000121', 'fixture_qr', 1, 101, 101
);
INSERT INTO platform_qr_revisions(
  qr_code_id, revision, target_kind, target_value, title_en,
  approved_by_user_id, approved_by_actor_key, approved_at, created_by_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000121', 1, 'internal_path', '/platform', 'Fixture QR',
  101, '2099TEST01', NOW(), 101
);
-- account-delete-evidence: platform_qr_revisions
INSERT INTO platform_privacy_consents(
  id, user_id, purpose, status, policy_version, source
) VALUES (
  '00000000-0000-0000-0000-000000000122', 101, 'essential', 'granted', '1', 'fixture'
);
-- account-delete-evidence: platform_privacy_consents
INSERT INTO platform_analytics_events(
  id, consent_id, user_id, event_name, surface, expires_at
) VALUES (
  '00000000-0000-0000-0000-000000000123', '00000000-0000-0000-0000-000000000122',
  101, 'fixture.event', 'platform', NOW() + INTERVAL '1 day'
);
INSERT INTO platform_audit_events(
  id, actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
) VALUES (
  '00000000-0000-0000-0000-000000000124', 101, '2099TEST01', 'fixture.action', 'fixture',
  'fixture-resource', 'allowed', '{"fixture":"audit"}'
);
-- account-delete-evidence: platform_audit_events
INSERT INTO platform_idempotency_requests(
  id, actor_key, actor_user_id, scope, idempotency_key, request_hash, lease_expires_at, expires_at
) VALUES (
  '00000000-0000-0000-0000-000000000125', 'different-key', 101, 'fixture.action', 'fixture-key',
  decode(repeat('05', 32), 'hex'), NOW() + INTERVAL '1 minute', NOW() + INTERVAL '1 hour'
);
INSERT INTO platform_reconciliation_records(
  id, provider, merchant_account, statement_date, provider_transaction_id,
  amount_minor, currency, status, evidence_hash, resolved_by_user_id,
  resolved_by_actor_key, resolution_note, resolved_at
) VALUES (
  '00000000-0000-0000-0000-000000000126', 'fixture', 'fixture-merchant', DATE '2099-01-01',
  'fixture-transaction', 100, 'CNY', 'missing_local', decode(repeat('06', 32), 'hex'),
  101, '2099TEST01', 'fixture resolution', NOW()
);

-- Legacy outbox rows may retain raw account IDs outside foreign keys. Both
-- queued and delivered rows must be purged before the canonical account goes.
INSERT INTO platform_outbox_events(
  id, event_type, aggregate_type, aggregate_id, dedupe_key, payload
) VALUES (
  '00000000-0000-0000-0000-000000000130', 'learning.progress_updated', 'lesson',
  '00000000-0000-0000-0000-000000000105', 'learning.progress:101:fixture-pending',
  '{"userId":101,"fixture":"pending"}'
);
INSERT INTO platform_outbox_events(
  id, event_type, aggregate_type, aggregate_id, dedupe_key, payload, status, delivered_at
) VALUES (
  '00000000-0000-0000-0000-000000000131', 'learning.quiz_graded', 'quiz_attempt',
  '00000000-0000-0000-0000-000000000107', 'learning.quiz:fixture-delivered',
  '{"userId":101,"fixture":"delivered"}', 'delivered', NOW()
);

-- Nullable encrypted fields must not exploit SQL's NULL comparison semantics
-- to bypass the payout snapshot immutability guard.
DO $$
BEGIN
  BEGIN
    UPDATE platform_instructor_payouts
    SET payout_profile_snapshot_encrypted = NULL, payout_key_version = NULL
    WHERE id = '00000000-0000-0000-0000-000000000120';
    RAISE EXCEPTION 'direct payout privacy update unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%payout profile snapshot is immutable%' THEN RAISE; END IF;
  END;
END;
$$;

-- Setting the old GUCs directly must not grant an append-only bypass.
DO $$
BEGIN
  PERFORM set_config('cuberoot.account_delete_user_id', '101', true);
  PERFORM set_config('cuberoot.account_delete_owner_key', '2099TEST01', true);
  PERFORM set_config('cuberoot.account_delete_tombstone', 'deleted:101', true);
  PERFORM set_config('cuberoot.account_delete_subject_hash', repeat('00', 32), true);
  BEGIN
    UPDATE platform_audit_events
    SET actor_user_id = NULL, actor_key = 'deleted:101'
    WHERE id = '00000000-0000-0000-0000-000000000124';
    RAISE EXCEPTION 'direct append-only update unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
  END;
END;
$$;

DELETE FROM app_users WHERE id = 101;
SET CONSTRAINTS ALL IMMEDIATE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_users WHERE id = 101) THEN
    RAISE EXCEPTION 'fixture app user survived deletion';
  END IF;
  IF EXISTS (SELECT 1 FROM platform_analytics_events WHERE user_id = 101)
     OR EXISTS (SELECT 1 FROM platform_quiz_attempts WHERE user_id = 101)
     OR EXISTS (SELECT 1 FROM platform_idempotency_requests WHERE actor_user_id = 101) THEN
    RAISE EXCEPTION 'private Platform rows survived deletion';
  END IF;
  IF EXISTS (
    SELECT 1 FROM platform_outbox_events
    WHERE payload ->> 'userId' = '101'
       OR LEFT(dedupe_key, LENGTH('learning.progress:101:')) = 'learning.progress:101:'
  ) THEN RAISE EXCEPTION 'legacy outbox account identifiers survived deletion'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_course_revisions
    WHERE course_id = '00000000-0000-0000-0000-000000000104' AND revision = 1
      AND created_by_user_id IS NULL AND published_by_user_id IS NULL
      AND title_en = 'Fixture course' AND content_hash = decode(repeat('02', 32), 'hex')
  ) THEN RAISE EXCEPTION 'course revision evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_lesson_revisions
    WHERE lesson_id = '00000000-0000-0000-0000-000000000105' AND revision = 1
      AND created_by_user_id IS NULL AND published_by_user_id IS NULL
      AND title_en = 'Fixture lesson' AND content_hash = decode(repeat('03', 32), 'hex')
  ) THEN RAISE EXCEPTION 'lesson revision evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_quiz_revisions
    WHERE quiz_id = '00000000-0000-0000-0000-000000000106' AND revision = 1
      AND created_by_user_id IS NULL AND title_en = 'Fixture quiz' AND passing_score_bps = 8000
      AND content_hash = decode(repeat('04', 32), 'hex')
  ) THEN RAISE EXCEPTION 'quiz revision evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_inventory_ledger
    WHERE id = '00000000-0000-0000-0000-000000000110'
      AND actor_user_id IS NULL AND actor_key = 'deleted:101'
      AND product_variant_id = '00000000-0000-0000-0000-000000000109'
      AND entry_type = 'stock_in' AND delta_on_hand = 1
  ) THEN RAISE EXCEPTION 'inventory evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_fulfillment_ledger
    WHERE id = '00000000-0000-0000-0000-000000000129' AND actor_user_id IS NULL
      AND order_id = '00000000-0000-0000-0000-000000000127'
      AND order_item_id = '00000000-0000-0000-0000-000000000128'
      AND entry_type = 'reserve' AND delta_quantity = 1
      AND metadata = '{"fixture":"fulfillment"}'::jsonb
  ) THEN RAISE EXCEPTION 'fulfillment evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_entitlement_ledger
    WHERE id = '00000000-0000-0000-0000-000000000112'
      AND actor_user_id IS NULL AND actor_key = 'deleted:101'
      AND entry_type = 'grant' AND delta_access = 1 AND reason = 'fixture grant'
  ) THEN RAISE EXCEPTION 'entitlement evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_membership_ledger
    WHERE id = '00000000-0000-0000-0000-000000000116' AND actor_user_id IS NULL
      AND entry_type = 'grant' AND delta_access = 1 AND reason = 'fixture grant'
  ) THEN RAISE EXCEPTION 'membership evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_audit_events
    WHERE id = '00000000-0000-0000-0000-000000000124'
      AND actor_user_id IS NULL AND actor_key = 'deleted:101'
      AND action = 'fixture.action' AND resource_type = 'fixture'
      AND resource_id = 'fixture-resource' AND outcome = 'allowed'
      AND metadata = '{"fixture":"audit"}'::jsonb
  ) THEN RAISE EXCEPTION 'audit evidence was not tombstoned'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_privacy_consents
    WHERE id = '00000000-0000-0000-0000-000000000122'
      AND user_id IS NULL AND octet_length(anonymous_subject_hash) = 32
      AND purpose = 'essential' AND status = 'granted'
      AND policy_version = '1' AND source = 'fixture'
  ) THEN RAISE EXCEPTION 'privacy consent was not anonymized'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_point_ledger
    WHERE id = '00000000-0000-0000-0000-000000000118'
      AND user_id IS NULL AND subject_key = 'deleted:101'
      AND actor_user_id IS NULL AND actor_key = 'deleted:101'
      AND entry_type = 'checkin' AND delta_points = 1 AND balance_after = 1
  ) THEN RAISE EXCEPTION 'point evidence was not tombstoned'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_instructor_revenue_ledger
    WHERE id = '00000000-0000-0000-0000-000000000119'
      AND actor_user_id IS NULL AND actor_key = 'deleted:101'
      AND entry_type = 'adjustment' AND delta_amount_minor = 100
      AND currency = 'CNY' AND reason = 'fixture adjustment'
  ) THEN RAISE EXCEPTION 'instructor revenue evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_qr_revisions
    WHERE qr_code_id = '00000000-0000-0000-0000-000000000121' AND revision = 1
      AND approved_by_user_id IS NULL AND approved_by_actor_key = 'deleted:101'
      AND created_by_user_id IS NULL AND approved_at IS NOT NULL
      AND target_kind = 'internal_path' AND target_value = '/platform' AND title_en = 'Fixture QR'
  ) THEN RAISE EXCEPTION 'QR revision evidence invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_instructors
    WHERE id = '00000000-0000-0000-0000-000000000101'
      AND user_id IS NULL AND status = 'archived'
      AND display_name_snapshot = 'Deleted instructor'
      AND payout_profile_encrypted IS NULL
  ) THEN RAISE EXCEPTION 'instructor profile was not scrubbed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_media_assets
    WHERE id = '00000000-0000-0000-0000-000000000103'
      AND owner_user_id IS NULL AND owner_tombstone_key = 'deleted:101'
      AND status = 'archived' AND metadata = '{}'::jsonb
  ) THEN RAISE EXCEPTION 'owned media was not archived and scrubbed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_instructor_payouts
    WHERE id = '00000000-0000-0000-0000-000000000120'
      AND payout_profile_snapshot_encrypted IS NULL AND payout_key_version IS NULL
      AND amount_minor = 100 AND currency = 'CNY'
  ) THEN RAISE EXCEPTION 'payout privacy/economic invariant failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM platform_reconciliation_records
    WHERE id = '00000000-0000-0000-0000-000000000126'
      AND resolved_by_user_id IS NULL
      AND resolved_by_actor_key = 'deleted:101'
      AND resolution_note = 'fixture resolution'
      AND resolved_at IS NOT NULL
      AND amount_minor = 100
      AND evidence_hash = decode(repeat('06', 32), 'hex')
  ) THEN RAISE EXCEPTION 'resolved reconciliation evidence was not safely tombstoned'; END IF;
END;
$$;

ROLLBACK;
