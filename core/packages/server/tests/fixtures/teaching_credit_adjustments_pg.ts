import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? 5433);
const user = process.env.DB_USER ?? 'postgres';
const password = process.env.DB_PASS ?? 'dev';
const adminDatabase = process.env.DB_NAME ?? 'cuberoot_db';
const fixtureDatabase = `cuberoot_credit_adjustments_fixture_${process.pid}`;
const snapshotDatabase = `cuberoot_credit_adjustments_snapshot_${process.pid}`;

const organizationId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const packageAId = '44444444-4444-4444-8444-444444444444';
const packageBId = '55555555-5555-4555-8555-555555555555';
const packageCId = '66666666-6666-4666-8666-666666666666';

const admin = postgres({ host, port, user, password, database: adminDatabase, max: 1 });
let fixture: ReturnType<typeof postgres> | null = null;
let snapshot: ReturnType<typeof postgres> | null = null;
let repositoryConnection: { end: () => Promise<void> } | null = null;
const extraClients: Array<ReturnType<typeof postgres>> = [];

const foundation = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE app_users (
  id BIGINT PRIMARY KEY,
  display_name VARCHAR(200) NOT NULL
);
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE student_profiles (
  id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  display_name VARCHAR(200) NOT NULL,
  external_ref VARCHAR(160),
  status VARCHAR(16) NOT NULL,
  PRIMARY KEY (organization_id, id)
);
CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL,
  role VARCHAR(16) NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);
CREATE TABLE teaching_mutation_rate_limits (
  actor_user_id BIGINT NOT NULL,
  operation VARCHAR(120) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (actor_user_id, operation)
);
CREATE TABLE teaching_idempotency_requests (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID,
  actor_user_id BIGINT NOT NULL,
  scope_key VARCHAR(200) NOT NULL,
  operation VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'in_progress',
  response_status INTEGER,
  response_body JSONB,
  resource_type VARCHAR(100),
  resource_id VARCHAR(200),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (actor_user_id, scope_key, operation, idempotency_key)
);
CREATE TABLE teaching_audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  actor_user_id BIGINT,
  actor_role VARCHAR(16),
  actor_display_name VARCHAR(200) NOT NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(120) NOT NULL,
  entity_id VARCHAR(200),
  outcome VARCHAR(16) NOT NULL DEFAULT 'succeeded',
  request_id VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL
);
`;

function sqlState(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

async function expectSqlState(
  operation: () => Promise<unknown>,
  expected: string | readonly string[],
): Promise<string> {
  const states = typeof expected === 'string' ? [expected] : expected;
  try {
    await operation();
  } catch (error) {
    const code = sqlState(error);
    assert.ok(code && states.includes(code), `expected SQLSTATE ${states.join('/')} but received ${code}`);
    return code;
  }
  assert.fail(`expected SQLSTATE ${states.join('/')}`);
}

function resultBody(result: { body: Record<string, unknown> }): Record<string, unknown> {
  return result.body;
}

async function main(): Promise<void> {
  await admin.unsafe(`CREATE DATABASE "${fixtureDatabase}"`);
  await admin.unsafe(`CREATE DATABASE "${snapshotDatabase}"`);
  fixture = postgres({ host, port, user, password, database: fixtureDatabase, max: 10 });
  snapshot = postgres({ host, port, user, password, database: snapshotDatabase, max: 1 });
  const migration0147 = await readFile(
    new URL('../../migrations/0147_teaching_packages_and_sessions.sql', import.meta.url),
    'utf8',
  );
  const migration0164 = await readFile(
    new URL('../../migrations/0164_teaching_credit_adjustments.sql', import.meta.url),
    'utf8',
  );
  const schemaSnapshot = await readFile(new URL('../../src/db/schema.pg.sql', import.meta.url), 'utf8');

  // A new database must be able to reach the same final ledger contract from
  // the canonical snapshot, independently of the migration upgrade path.
  await snapshot.unsafe(schemaSnapshot);
  const snapshotCatalog = await snapshot.unsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'student_packages'
          AND column_name = 'credit_ledger_revision' AND data_type = 'bigint'
          AND is_nullable = 'NO'
      ) AS has_revision,
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lesson_credit_ledger_entry_shape'
      ) AS has_entry_shape,
      EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'lesson_credit_ledger_validate_insert' AND NOT tgisinternal
      ) AS has_insert_trigger,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'uq_lesson_credit_ledger_refund_source'
      ) AS has_refund_source,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_lesson_credit_ledger_credit_adjustments'
      ) AS has_feed_index
  `);
  assert.deepEqual(snapshotCatalog[0], {
    has_revision: true,
    has_entry_shape: true,
    has_insert_trigger: true,
    has_refund_source: true,
    has_feed_index: true,
  });

  await fixture.unsafe(foundation);
  await fixture.unsafe(migration0147);
  await fixture.unsafe(`
    INSERT INTO app_users (id, display_name) VALUES (101, 'Finance Owner');
    INSERT INTO organizations (id, slug, name, timezone, status)
    VALUES ('${organizationId}', 'fixture', 'Fixture', 'America/Los_Angeles', 'active');
    INSERT INTO student_profiles (id, organization_id, display_name, external_ref, status)
    VALUES ('${studentId}', '${organizationId}', 'Student', 'S-1', 'active');
    INSERT INTO organization_members (organization_id, user_id, status, role)
    VALUES ('${organizationId}', 101, 'active', 'owner');
    INSERT INTO lesson_package_products (
      id, organization_id, code, name, credit_unit, credit_type, total_credits,
      price_amount_minor, currency, created_by_user_id
    ) VALUES (
      '${productId}', '${organizationId}', 'fixture', 'Fixture package', 'lesson',
      'standard', 10, 1000, 'USD', 101
    );
    INSERT INTO student_packages (
      id, organization_id, student_id, product_id, product_code_snapshot,
      product_name_snapshot, credit_unit, credit_type, entitled_credits,
      price_amount_minor, currency, acquisition_type, valid_from, created_by_user_id
    ) VALUES
      ('${packageAId}', '${organizationId}', '${studentId}', '${productId}', 'fixture',
       'Fixture package', 'lesson', 'standard', 10, 1000, 'USD', 'purchase', NOW(), 101),
      ('${packageBId}', '${organizationId}', '${studentId}', '${productId}', 'fixture',
       'Fixture package', 'lesson', 'standard', 1, 100, 'USD', 'purchase', NOW(), 101),
      ('${packageCId}', '${organizationId}', '${studentId}', '${productId}', 'fixture',
       'Fixture package', 'lesson', 'standard', 1, 100, 'USD', 'purchase', NOW(), 101);
    INSERT INTO lesson_credit_ledger (
      organization_id, student_package_id, student_id, entry_type, delta,
      idempotency_key, reason, actor_user_id, actor_role, actor_display_name
    ) VALUES
      ('${organizationId}', '${packageAId}', '${studentId}', 'purchase', 10,
       'legacy-purchase-a', 'Initial entitlement', 101, 'owner', 'Finance Owner'),
      ('${organizationId}', '${packageBId}', '${studentId}', 'purchase', 1,
       'legacy-purchase-b', 'Initial entitlement', 101, 'owner', 'Finance Owner'),
      ('${organizationId}', '${packageCId}', '${studentId}', 'purchase', 1,
       'legacy-purchase-c', 'Initial entitlement', 101, 'owner', 'Finance Owner');
  `);
  const initialRows = await fixture.unsafe(
    `SELECT id::text, student_package_id::text FROM lesson_credit_ledger ORDER BY id`,
  );
  const initialPackageALedgerId = String(initialRows[0].id);

  // Exercise the supported upgrade path against the real 0147 baseline.
  await fixture.unsafe(migration0164);
  const catalog = await fixture.unsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'student_packages'
          AND column_name = 'credit_ledger_revision' AND data_type = 'bigint'
          AND is_nullable = 'NO'
      ) AS has_revision,
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lesson_credit_ledger_entry_shape'
      ) AS has_entry_shape,
      EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'lesson_credit_ledger_validate_insert' AND NOT tgisinternal
      ) AS has_insert_trigger,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'uq_lesson_credit_ledger_refund_source'
      ) AS has_refund_source,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_lesson_credit_ledger_credit_adjustments'
      ) AS has_feed_index
  `);
  assert.deepEqual(catalog[0], {
    has_revision: true,
    has_entry_shape: true,
    has_insert_trigger: true,
    has_refund_source: true,
    has_feed_index: true,
  });
  for (const marker of [
    'credit_ledger_revision BIGINT NOT NULL DEFAULT 0',
    'CONSTRAINT lesson_credit_ledger_entry_shape CHECK',
    'CREATE TRIGGER lesson_credit_ledger_validate_insert',
    'CREATE UNIQUE INDEX uq_lesson_credit_ledger_refund_source',
    'CREATE INDEX idx_lesson_credit_ledger_credit_adjustments',
  ]) {
    assert.ok(schemaSnapshot.includes(marker), `canonical schema snapshot is missing ${marker}`);
  }

  process.env.DB_HOST = host;
  process.env.DB_PORT = String(port);
  process.env.DB_USER = user;
  process.env.DB_PASS = password;
  process.env.DB_NAME = fixtureDatabase;
  const [{ teachingSaasRepository }, { sql }] = await Promise.all([
    import('../../src/routes/teaching_saas.js'),
    import('../../src/db/connection.js'),
  ]);
  repositoryConnection = sql;
  const actor = { userId: 101, displayName: 'Finance Owner', source: 'session' as const };

  await sql.unsafe(
    'ALTER TABLE lesson_credit_ledger ALTER COLUMN id RESTART WITH 9007199254740993',
  );
  const refundInput = {
    credits: 2,
    reason: 'Duplicate charge',
    sourceSystem: 'fixture',
    sourceRef: 'refund-api',
    sourceLineRef: null,
  };
  const refundKey = 'refund-replay-key';
  const refundHash = 'a'.repeat(64);
  const refundFirst = await teachingSaasRepository.refundStudentPackageCredits(
    actor, 'fixture', packageAId, refundInput, refundKey, refundHash, 'refund-first',
  );
  const refundReplay = await teachingSaasRepository.refundStudentPackageCredits(
    actor, 'fixture', packageAId, refundInput, refundKey, refundHash, 'refund-replay',
  );
  assert.equal(refundFirst.status, 201);
  assert.deepEqual(refundReplay, refundFirst);
  const refundBody = resultBody(refundFirst);
  const refundLedger = refundBody.ledgerEntry as Record<string, unknown>;
  const refundPackage = refundBody.studentPackage as Record<string, unknown>;
  assert.equal(refundLedger.id, '9007199254740993');
  assert.equal(refundPackage.remainingCredits, 8);
  const refundRows = await sql`
    SELECT id::text, idempotency_key
    FROM lesson_credit_ledger
    WHERE organization_id = ${organizationId} AND entry_type = 'refund'`;
  assert.equal(refundRows.length, 1);
  assert.match(String(refundRows[0].idempotency_key), /^refund:v1:[0-9a-f]{64}$/);
  assert.ok(!String(refundRows[0].idempotency_key).includes(refundKey));

  const reversalInput = { reason: 'Restore duplicate charge' };
  const reversalKey = 'reversal-replay-key';
  const reversalHash = 'b'.repeat(64);
  const reversalFirst = await teachingSaasRepository.reverseStudentPackageLedgerEntry(
    actor,
    'fixture',
    packageAId,
    String(refundLedger.id),
    reversalInput,
    reversalKey,
    reversalHash,
    'reversal-first',
  );
  const reversalReplay = await teachingSaasRepository.reverseStudentPackageLedgerEntry(
    actor,
    'fixture',
    packageAId,
    String(refundLedger.id),
    reversalInput,
    reversalKey,
    reversalHash,
    'reversal-replay',
  );
  assert.equal(reversalFirst.status, 201);
  assert.deepEqual(reversalReplay, reversalFirst);
  const reversalBody = resultBody(reversalFirst);
  const reversalLedger = reversalBody.ledgerEntry as Record<string, unknown>;
  const reversalPackage = reversalBody.studentPackage as Record<string, unknown>;
  assert.match(String(reversalLedger.id), /^\d+$/);
  assert.equal(reversalLedger.reversalOfLedgerId, refundLedger.id);
  assert.equal(reversalPackage.remainingCredits, 10);
  const reversalRows = await sql`
    SELECT id::text, idempotency_key
    FROM lesson_credit_ledger
    WHERE reversal_of_ledger_id = ${String(refundLedger.id)}`;
  assert.equal(reversalRows.length, 1);
  assert.match(
    String(reversalRows[0].idempotency_key),
    new RegExp(`^reversal:v1:${String(refundLedger.id)}:[0-9a-f]{64}$`),
  );

  const packageLedger = await teachingSaasRepository.listStudentPackageLedger(
    actor, 'fixture', packageAId, { page: 1, pageSize: 50, offset: 0 }, 'ledger-list',
  );
  const originalRefund = packageLedger.items.find(
    (entry) => (entry as Record<string, unknown>).id === refundLedger.id,
  ) as Record<string, unknown>;
  assert.equal(originalRefund.reversedByLedgerId, reversalLedger.id);
  assert.equal(typeof originalRefund.reversedByLedgerId, 'string');

  // Direct SQL must be held to the same shape, uniqueness, balance, and append-only rules.
  await expectSqlState(
    () => sql`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, source_system, source_ref, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageAId}, ${studentId}, 'refund', 1,
        'invalid-positive-refund', 'fixture', 'invalid-positive', 'Invalid', 'owner', 'Fixture'
      )`,
    '23514',
  );
  await expectSqlState(
    () => sql`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageAId}, ${studentId}, 'refund', -1,
        'invalid-missing-source', 'Missing source', 'owner', 'Fixture'
      )`,
    '23514',
  );
  await expectSqlState(
    () => sql`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageAId}, ${studentId}, 'adjustment', -1000000,
        'invalid-negative-balance', 'Invalid negative balance', 'owner', 'Fixture'
      )`,
    '23514',
  );
  await expectSqlState(
    () => sql`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, reversal_of_ledger_id, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageAId}, ${studentId}, 'reversal', -9,
        'invalid-inexact-reversal', ${initialPackageALedgerId}, 'Invalid reversal', 'owner', 'Fixture'
      )`,
    '23514',
  );
  await expectSqlState(
    () => sql`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, reversal_of_ledger_id, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageAId}, ${studentId}, 'reversal', 2,
        'duplicate-reversal', ${String(refundLedger.id)}, 'Duplicate reversal', 'owner', 'Fixture'
      )`,
    '23505',
  );
  await expectSqlState(
    () => sql`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, source_system, source_ref, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageAId}, ${studentId}, 'refund', -1,
        'duplicate-source', 'fixture', 'refund-api', 'Duplicate source', 'owner', 'Fixture'
      )`,
    '23505',
  );
  await expectSqlState(
    () => sql`
      UPDATE lesson_credit_ledger SET reason = 'Mutation'
      WHERE organization_id = ${organizationId} AND id = ${String(refundLedger.id)}`,
    '55000',
  );
  await expectSqlState(
    () => sql`
      DELETE FROM lesson_credit_ledger
      WHERE organization_id = ${organizationId} AND id = ${String(refundLedger.id)}`,
    '55000',
  );

  // Under READ COMMITTED, the parent-row write serializes two competing debits.
  const rcOne = postgres({ host, port, user, password, database: fixtureDatabase, max: 1 });
  const rcTwo = postgres({ host, port, user, password, database: fixtureDatabase, max: 1 });
  extraClients.push(rcOne, rcTwo);
  const rcResults = await Promise.allSettled([
    rcOne`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, source_system, source_ref, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageBId}, ${studentId}, 'refund', -1,
        'rc-one', 'fixture', 'rc-one', 'RC debit one', 'owner', 'Fixture'
      )`,
    rcTwo`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        idempotency_key, source_system, source_ref, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${packageBId}, ${studentId}, 'refund', -1,
        'rc-two', 'fixture', 'rc-two', 'RC debit two', 'owner', 'Fixture'
      )`,
  ]);
  assert.equal(rcResults.filter((result) => result.status === 'fulfilled').length, 1);
  const rcRejected = rcResults.find((result) => result.status === 'rejected');
  assert.equal(rcRejected?.status, 'rejected');
  if (rcRejected?.status === 'rejected') assert.equal(sqlState(rcRejected.reason), '23514');
  const rcBalance = await sql`
    SELECT SUM(delta)::int AS balance, COUNT(*) FILTER (WHERE entry_type = 'refund')::int AS refunds
    FROM lesson_credit_ledger WHERE student_package_id = ${packageBId}`;
  assert.deepEqual(rcBalance[0], { balance: 0, refunds: 1 });

  // Under REPEATABLE READ, both transactions start from the same snapshot;
  // the loser must abort instead of committing an overspend.
  const rrOne = postgres({ host, port, user, password, database: fixtureDatabase, max: 1 });
  const rrTwo = postgres({ host, port, user, password, database: fixtureDatabase, max: 1 });
  extraClients.push(rrOne, rrTwo);
  let barrierCount = 0;
  let releaseBarrier: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => {
    releaseBarrier = resolve;
  });
  const arriveAtBarrier = async (): Promise<void> => {
    barrierCount += 1;
    if (barrierCount === 2) releaseBarrier?.();
    await barrier;
  };
  const rrDebit = (client: ReturnType<typeof postgres>, suffix: string) => client.begin(
    'isolation level repeatable read',
    async (tx) => {
      await tx`SELECT credit_ledger_revision FROM student_packages WHERE id = ${packageCId}`;
      await arriveAtBarrier();
      await tx`
        INSERT INTO lesson_credit_ledger (
          organization_id, student_package_id, student_id, entry_type, delta,
          idempotency_key, source_system, source_ref, reason, actor_role, actor_display_name
        ) VALUES (
          ${organizationId}, ${packageCId}, ${studentId}, 'refund', -1,
          ${`rr-${suffix}`}, 'fixture', ${`rr-${suffix}`}, ${`RR debit ${suffix}`}, 'owner', 'Fixture'
        )`;
    },
  );
  const rrResults = await Promise.allSettled([rrDebit(rrOne, 'one'), rrDebit(rrTwo, 'two')]);
  assert.equal(rrResults.filter((result) => result.status === 'fulfilled').length, 1);
  const rrRejected = rrResults.find((result) => result.status === 'rejected');
  assert.equal(rrRejected?.status, 'rejected');
  if (rrRejected?.status === 'rejected') {
    assert.ok(['40001', '23514'].includes(sqlState(rrRejected.reason) ?? ''));
  }
  const rrBalance = await sql`
    SELECT SUM(delta)::int AS balance, COUNT(*) FILTER (WHERE entry_type = 'refund')::int AS refunds
    FROM lesson_credit_ledger WHERE student_package_id = ${packageCId}`;
  assert.deepEqual(rrBalance[0], { balance: 0, refunds: 1 });

  // Same-timestamp rows must use bigint id as the stable newest-first tie-breaker.
  const tieRows = await sql`
    INSERT INTO lesson_credit_ledger (
      organization_id, student_package_id, student_id, entry_type, delta,
      idempotency_key, reason, actor_role, actor_display_name, created_at
    ) VALUES
      (${organizationId}, ${packageAId}, ${studentId}, 'adjustment', 1,
       'tie-one', 'Tie one', 'owner', 'Fixture', '2099-01-01T00:00:00Z'),
      (${organizationId}, ${packageAId}, ${studentId}, 'adjustment', -1,
       'tie-two', 'Tie two', 'owner', 'Fixture', '2099-01-01T00:00:00Z')
    RETURNING id::text`;
  const expectedTieIds = tieRows.map((row) => String(row.id)).sort((left, right) => (
    BigInt(left) > BigInt(right) ? -1 : 1
  ));
  const orderedLedger = await teachingSaasRepository.listStudentPackageLedger(
    actor, 'fixture', packageAId, { page: 1, pageSize: 2, offset: 0 }, 'tie-list',
  );
  assert.deepEqual(
    orderedLedger.items.map((entry) => String((entry as Record<string, unknown>).id)),
    expectedTieIds,
  );
  assert.ok(expectedTieIds.every((id) => BigInt(id) > BigInt(Number.MAX_SAFE_INTEGER)));

  const feed = await teachingSaasRepository.listCreditAdjustments(
    actor, 'fixture', { page: 1, pageSize: 50, offset: 0 }, 'feed-list',
  );
  assert.equal(feed.total, 6);
  assert.ok(feed.items.every((entry) => {
    const adjustment = entry as Record<string, unknown>;
    const ledgerEntry = adjustment.ledgerEntry as Record<string, unknown>;
    return typeof ledgerEntry.id === 'string';
  }));

  await sql`DELETE FROM app_users WHERE id = 101`;
  const actorSnapshot = await sql`
    SELECT COUNT(*)::int AS rows,
           COUNT(*) FILTER (WHERE actor_user_id IS NULL)::int AS null_actor_rows,
           COUNT(*) FILTER (WHERE actor_display_name = 'Finance Owner')::int AS named_rows
    FROM lesson_credit_ledger
    WHERE organization_id = ${organizationId}`;
  assert.equal(actorSnapshot[0].rows, actorSnapshot[0].null_actor_rows);
  assert.ok(Number(actorSnapshot[0].named_rows) >= 5);

  console.log(JSON.stringify({
    upgrade: '0147-to-0164-ok',
    canonicalSnapshot: 'ok',
    refundReplay: 'ok',
    reversalReplay: 'ok',
    directSql: 'ok',
    readCommitted: rcResults.map((result) => result.status),
    repeatableRead: rrResults.map((result) => result.status),
    bigintNewestFirst: expectedTieIds,
    accountDeleteSnapshot: 'ok',
  }));
}

try {
  await main();
} finally {
  await repositoryConnection?.end().catch(() => undefined);
  await Promise.all(extraClients.map((client) => client.end().catch(() => undefined)));
  if (fixture) await fixture.end().catch(() => undefined);
  if (snapshot) await snapshot.end().catch(() => undefined);
  await admin.unsafe(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${fixtureDatabase}' AND pid <> pg_backend_pid();
  `).catch(() => undefined);
  await admin.unsafe(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${snapshotDatabase}' AND pid <> pg_backend_pid();
  `).catch(() => undefined);
  await admin.unsafe(`DROP DATABASE IF EXISTS "${fixtureDatabase}"`).catch(() => undefined);
  await admin.unsafe(`DROP DATABASE IF EXISTS "${snapshotDatabase}"`).catch(() => undefined);
  await admin.end();
}
