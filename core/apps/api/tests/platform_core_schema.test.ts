import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

const PLATFORM_TABLES = [
  'platform_instructors',
  'platform_instructor_applications',
  'platform_media_assets',
  'platform_courses',
  'platform_course_owners',
  'platform_course_revisions',
  'platform_lessons',
  'platform_lesson_revisions',
  'platform_learning_paths',
  'platform_learning_path_items',
  'platform_quizzes',
  'platform_quiz_revisions',
  'platform_quiz_questions',
  'platform_products',
  'platform_product_variants',
  'platform_events',
  'platform_event_ticket_types',
  'platform_news_articles',
  'platform_membership_plans',
  'platform_coupons',
  'platform_shipping_addresses',
  'platform_orders',
  'platform_order_items',
  'platform_coupon_redemptions',
  'platform_payment_attempts',
  'platform_provider_events',
  'platform_refunds',
  'platform_inventory_ledger',
  'platform_fulfillment_ledger',
  'platform_event_registrations',
  'platform_course_entitlements',
  'platform_entitlement_ledger',
  'platform_memberships',
  'platform_membership_ledger',
  'platform_lesson_progress',
  'platform_lesson_notes',
  'platform_favorites',
  'platform_quiz_attempts',
  'platform_course_reviews',
  'platform_certificates',
  'platform_checkins',
  'platform_point_ledger',
  'platform_achievements',
  'platform_user_achievements',
  'platform_instructor_revenue_ledger',
  'platform_instructor_payouts',
  'platform_instructor_payout_items',
  'platform_invite_codes',
  'platform_invite_redemptions',
  'platform_qr_codes',
  'platform_qr_revisions',
  'platform_qr_scans',
  'platform_qr_templates',
  'platform_qr_card_jobs',
  'platform_privacy_consents',
  'platform_analytics_events',
  'platform_analytics_daily_aggregates',
  'platform_retention_jobs',
  'platform_reconciliation_records',
  'platform_audit_events',
  'platform_outbox_events',
  'platform_idempotency_requests',
] as const;

const PLATFORM_ACCOUNT_DELETE_EVIDENCE_TABLES = [
  'platform_course_revisions',
  'platform_lesson_revisions',
  'platform_quiz_revisions',
  'platform_inventory_ledger',
  'platform_fulfillment_ledger',
  'platform_entitlement_ledger',
  'platform_membership_ledger',
  'platform_point_ledger',
  'platform_instructor_revenue_ledger',
  'platform_qr_revisions',
  'platform_privacy_consents',
  'platform_audit_events',
] as const;

describe('main-site Platform PostgreSQL schema', () => {
  it('keeps Platform account deletion compatible with immutable evidence', async () => {
    const [migration, schema, readme, devSchema, accountDelete, learning, fixture] = await Promise.all([
      read('../migrations/0168_platform_account_deletion.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/schema/page.tsx'), 'utf8'),
      read('../src/utils/account_delete.ts'),
      read('../src/routes/platform_learning.ts'),
      read('./fixtures/platform_account_deletion_pg.sql'),
    ]);

    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    expect(schema).toContain('-- Platform account-deletion safeguards (final schema state from migration 0168).');
    expect(schema).not.toContain('-- 0168_platform_account_deletion.sql');
    expect(schema).not.toMatch(/ALTER TABLE platform_instructors\s+ALTER COLUMN user_id DROP NOT NULL/);
    expect(schema).toContain('user_id BIGINT UNIQUE REFERENCES app_users(id) ON DELETE SET NULL');
    expect(schema).toContain('owner_tombstone_key VARCHAR(160)');
    expect(schema).toContain('CREATE UNIQUE INDEX uq_platform_checkins_subject_date');
    expect(schema).toContain('CHECK ((user_id IS NOT NULL)::integer + (subject_key IS NOT NULL)::integer = 1)');
    expect(schema).toContain('CREATE TRIGGER platform_prepare_account_delete');
    expect(schema.match(/CREATE OR REPLACE FUNCTION trg_platform_reject_update_delete/g)).toHaveLength(1);
    expect(schema.match(/CREATE OR REPLACE FUNCTION trg_validate_platform_exact_reversal/g)).toHaveLength(1);
    expect(schema.match(/CREATE OR REPLACE FUNCTION trg_guard_platform_reconciliation_record/g)).toHaveLength(1);
    expect(readme).toContain('0168_platform_account_deletion.sql');
    expect(devSchema).toContain("{ n: 168, slug: 'platform_account_deletion'");
    expect(migration).toContain('ALTER COLUMN user_id DROP NOT NULL');
    expect(migration).toContain('REFERENCES app_users(id) ON DELETE SET NULL');
    expect(migration).toContain('CREATE TRIGGER platform_prepare_account_delete');
    expect(migration).toContain('pg_trigger_depth() < 2');
    expect(migration).toContain("delete_tombstone <> 'deleted:' || delete_user_id::TEXT");
    expect(migration).toContain("to_jsonb(NEW) - ARRAY['actor_user_id', 'actor_key']");
    expect(migration).toContain('CREATE TRIGGER platform_instructor_payouts_account_delete_guard');
    expect(migration).toContain('UPDATE platform_privacy_consents');
    expect(migration).toContain('DELETE FROM platform_outbox_events');
    expect(fixture).toContain('IS DISTINCT FROM ROW(57, 48, 53, 4, 0)');
    expect(fixture).toContain('direct append-only update unexpectedly succeeded');
    expect(fixture).toContain('legacy outbox account identifiers survived deletion');
    expect(accountDelete).toContain("['platform_idempotency_requests', 'actor_key']");
    expect(accountDelete).toContain('PLATFORM_ACCOUNT_DELETE_TABLES');
    expect(accountDelete).not.toContain("set_config('cuberoot.account_delete_tombstone'");
    expect(learning).toContain('randomUUID()');
    const outboxCalls = [...learning.matchAll(/enqueuePlatformEvent\([\s\S]*?\);/g)]
      .map((match) => match[0]);
    expect(outboxCalls).toHaveLength(4);
    expect(outboxCalls.map((call) => call.match(/'learning\.[a-z_]+'/)?.[0])).toEqual([
      "'learning.progress_updated'",
      "'learning.course_enrolled'",
      "'learning.quiz_graded'",
      "'learning.certificate_issued'",
    ]);
    for (const call of outboxCalls) {
      expect(call).not.toMatch(/\buserId\b/);
    }
    for (const table of PLATFORM_ACCOUNT_DELETE_EVIDENCE_TABLES) {
      expect(migration).toContain(`TG_TABLE_NAME = '${table}'`);
      expect(fixture).toContain(`-- account-delete-evidence: ${table}`);
    }
  });

  it('keeps migration 0167, the canonical snapshot, the ledger, and /dev/schema in sync', async () => {
    const [migration, schema, readme, devSchema] = await Promise.all([
      read('../migrations/0167_platform_core.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/schema/page.tsx'), 'utf8'),
    ]);

    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    expect(schema).toContain('-- Canonical schema additions from migration 0167.');
    expect(readme).toContain('0167_platform_core.sql');
    expect(devSchema).toContain("{ n: 167, slug: 'platform_core'");

    const migrationTables = [...migration.matchAll(/^CREATE TABLE (platform_[a-z0-9_]+) \(/gm)]
      .map((match) => match[1]);
    const schemaTables = [...schema.matchAll(/^CREATE TABLE (platform_[a-z0-9_]+) \(/gm)]
      .map((match) => match[1]);
    expect(migrationTables).toEqual(PLATFORM_TABLES);
    expect(schemaTables).toEqual(PLATFORM_TABLES);
    expect(new Set(migrationTables).size).toBe(62);
    expect(new Set(schemaTables).size).toBe(62);
    expect(schema.indexOf('CREATE TABLE app_users')).toBeLessThan(schema.indexOf('CREATE TABLE platform_instructors'));
    expect(schema.indexOf('CREATE TABLE teacher_directory_entries')).toBeLessThan(schema.indexOf('CREATE TABLE platform_instructors'));
    for (const table of PLATFORM_TABLES) {
      expect(devSchema).toContain(`'${table}'`);
    }
  });

  it('uses canonical accounts while preserving API-key and deleted-account decision attribution', async () => {
    const migration = await read('../migrations/0167_platform_core.sql');

    expect(migration).toContain('REFERENCES app_users(id)');
    expect(migration).toContain('REFERENCES teacher_directory_entries(id) ON DELETE SET NULL');
    for (const actorColumn of [
      'decided_by_actor_key',
      'approved_by_actor_key',
      'paid_by_actor_key',
      'resolved_by_actor_key',
    ]) {
      expect(migration).toContain(actorColumn);
    }
    expect(migration).toContain("status = 'approved' AND decided_at IS NOT NULL AND decided_by_actor_key IS NOT NULL");
    expect(migration).toContain("status = 'rejected' AND decided_at IS NOT NULL AND decided_by_actor_key IS NOT NULL");
    expect(migration).toContain("target_kind = 'external_url' AND target_value ~ '^https?://[^[:space:]]+$' AND approved_by_actor_key IS NOT NULL");
    expect(migration).toContain("status NOT IN ('approved', 'processing', 'paid') OR (approved_at IS NOT NULL AND approved_by_actor_key IS NOT NULL)");
    expect(migration).toContain('resolved_at IS NULL OR resolved_by_actor_key IS NOT NULL');
  });

  it('binds payment evidence, amounts, currencies, sellables, refunds, and entitlements in the database', async () => {
    const migration = await read('../migrations/0167_platform_core.sql');

    expect(migration).toContain('subtotal_amount_minor - discount_amount_minor + shipping_amount_minor = total_amount_minor');
    expect(migration).toContain('CHECK ((course_id IS NOT NULL)::integer + (product_variant_id IS NOT NULL)::integer + (event_ticket_type_id IS NOT NULL)::integer + (membership_plan_id IS NOT NULL)::integer = 1)');
    expect(migration).toContain('CONSTRAINT platform_order_items_currency_fk FOREIGN KEY (order_id, currency)');
    expect(migration).toContain('CONSTRAINT platform_payment_attempts_order_amount_fk FOREIGN KEY (order_id, amount_minor, currency)');
    expect(migration).toContain('CONSTRAINT platform_provider_events_attempt_fk FOREIGN KEY (payment_attempt_id, order_id, amount_minor, currency)');
    expect(migration).toContain("OLD.status IN ('failed', 'cancelled')");
    expect(migration).toContain("OLD.failure_code IN ('provider_not_succeeded', 'attempt_expired', 'reservation_expired', 'order_cancelled')");
    expect(migration).toContain("NEW.status = 'succeeded'");
    expect(migration).toContain('NEW.provider_transaction_id IS NOT NULL');
    expect(migration).toContain('NEW.succeeded_at IS NOT NULL');
    expect(migration).toContain('CHECK (signature_verified)');
    expect(migration).toContain('CHECK (merchant_verified)');
    expect(migration).toContain('CHECK (order_verified)');
    expect(migration).toContain('CHECK (amount_currency_verified)');
    expect(migration).toContain('CONSTRAINT platform_refunds_attempt_fk FOREIGN KEY (payment_attempt_id, order_id, currency, provider)');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION trg_validate_platform_refund_total()');
    expect(migration).toContain('platform refunds cannot exceed the captured payment amount');
    expect(migration).not.toMatch(/CREATE UNIQUE INDEX[^;]+\(\s*SELECT/is);
    expect(migration).toContain('CONSTRAINT platform_event_registrations_ticket_fk FOREIGN KEY (event_id, ticket_type_id)');
    expect(migration).toContain('CONSTRAINT platform_course_reviews_entitlement_fk FOREIGN KEY (entitlement_id, user_id, course_id)');
    expect(migration).toContain('answers_snapshot_encrypted BYTEA NOT NULL');
    expect(migration).toContain('answers_key_version SMALLINT NOT NULL');
    expect(migration).not.toContain('answers_snapshot JSONB');
  });

  it('makes economic ledgers append-only with exact reversals and serializes inventory and refunds', async () => {
    const migration = await read('../migrations/0167_platform_core.sql');

    for (const ledger of [
      'platform_inventory_ledger',
      'platform_fulfillment_ledger',
      'platform_entitlement_ledger',
      'platform_membership_ledger',
      'platform_point_ledger',
      'platform_instructor_revenue_ledger',
    ]) {
      expect(migration).toContain(`CREATE TRIGGER ${ledger}_append_only`);
    }
    expect(migration).toContain('CREATE OR REPLACE FUNCTION trg_validate_platform_exact_reversal()');
    expect(migration).toContain('platform inventory reversal must exactly reverse one entry for the same variant');
    expect(migration).toContain('platform instructor revenue reversal must exactly reverse one entry in the same currency');
    expect(migration).toContain('amount_minor <> 0 AND amount_minor BETWEEN -9007199254740991 AND 9007199254740991');
    expect(migration).toContain('CREATE UNIQUE INDEX uq_platform_instructor_payout_items_active_revenue');
    expect(migration).toContain('WHERE released_at IS NULL;');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION trg_guard_platform_instructor_payout()');
    expect(migration).toContain("OLD.status = 'failed' AND OLD.failure_code = 'refund_after_processing' AND NEW.status = 'paid'");
    expect(migration).toContain('platform payout amount must equal its positive active signed item total');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION trg_guard_platform_instructor_payout_item()');
    expect(migration).toContain('platform payout item must exactly match its instructor revenue ledger and payout currency');
    expect(migration).toContain('platform payout items may only be released from cancelled or failed payouts');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION trg_validate_platform_inventory_ledger_insert()');
    expect(migration).toContain('FOR UPDATE;');
    expect(migration).toContain('platform inventory balance cannot be negative or oversold');
    expect(migration).toContain('actor_key VARCHAR(160)');
    expect(migration).toContain("actor_user_id IS NOT NULL OR NULLIF(BTRIM(actor_key), '') IS NOT NULL");
  });

  it('locks QR, privacy, audit, outbox, and idempotency safety boundaries into schema constraints', async () => {
    const migration = await read('../migrations/0167_platform_core.sql');

    expect(migration).toContain("target_value ~ '^/[A-Za-z0-9/_?&=.#%+~-]*$' AND LEFT(target_value, 2) <> '//'");
    expect(migration).toContain("ARRAY['ip', 'ip_address', 'ua', 'user_agent', 'email', 'phone', 'url', 'referrer']");
    expect(migration).toContain("ARRAY['authorization', 'cookie', 'password', 'secret', 'token', 'body', 'email', 'phone']");
    expect(migration).toContain('CREATE TRIGGER platform_audit_events_append_only');
    expect(migration).toContain('dedupe_key VARCHAR(240) NOT NULL UNIQUE');
    expect(migration).toContain("OLD.status = 'pending' AND NEW.status = 'processing'");
    expect(migration).toContain('UNIQUE (actor_key, scope, idempotency_key)');
    expect(migration).toContain('platform idempotency identity and request hash are immutable');
    expect(migration).toContain("OLD.state = 'failed' AND NEW.state = 'processing'");
    expect(migration).toContain('retention boundary may only be extended while finalizing or safely reclaiming');
  });
});
