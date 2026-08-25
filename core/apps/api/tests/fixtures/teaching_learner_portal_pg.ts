import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? 5433);
const user = process.env.DB_USER ?? 'postgres';
const password = process.env.DB_PASS ?? 'dev';
const adminDatabase = process.env.DB_NAME ?? 'cuberoot_db';
const fixtureDatabase = `cuberoot_learner_portal_fixture_${process.pid}`;

const admin = postgres({ host, port, user, password, database: adminDatabase, max: 1 });
let fixture: ReturnType<typeof postgres> | null = null;

function pre0156Schema(schema: string): string {
  const inviteStart = schema.indexOf('CREATE TABLE guardian_account_binding_invites');
  const inviteEnd = schema.indexOf('CREATE FUNCTION teaching_is_iana_timezone', inviteStart);
  if (inviteStart < 0 || inviteEnd < 0) throw new Error('0156 schema section not found');
  const withoutInvite = `${schema.slice(0, inviteStart)}${schema.slice(inviteEnd)}`;
  const withoutLinkTimestamp = withoutInvite.replace(
    '  account_linked_at  TIMESTAMPTZ,\n  relationship       VARCHAR(32)',
    '  relationship       VARCHAR(32)',
  ).replace(
    '  CONSTRAINT guardian_links_account_link_state\n'
      + '    CHECK ((guardian_user_id IS NULL) = (account_linked_at IS NULL)),\n',
    '',
  );
  if (withoutLinkTimestamp.includes('CREATE TABLE guardian_account_binding_invites')
      || withoutLinkTimestamp.includes('guardian_links_account_link_state')) {
    throw new Error('failed to derive the pre-0156 schema');
  }
  return withoutLinkTimestamp;
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function rejectedStatus(result: PromiseSettledResult<unknown>): number | null {
  if (result.status !== 'rejected') return null;
  const reason = result.reason as { status?: unknown };
  return typeof reason?.status === 'number' ? reason.status : null;
}

async function expectPgCode(operation: () => Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if ((error as { code?: string }).code === expectedCode) return;
    throw error;
  }
  throw new Error(`expected PostgreSQL error ${expectedCode}`);
}

async function main(): Promise<void> {
  await admin.unsafe(`CREATE DATABASE "${fixtureDatabase}"`);
  fixture = postgres({ host, port, user, password, database: fixtureDatabase, max: 8 });
  const [schema, migration] = await Promise.all([
    readFile(new URL('../../src/db/schema.pg.sql', import.meta.url), 'utf8'),
    readFile(new URL('../../migrations/0156_teaching_learner_portal.sql', import.meta.url), 'utf8'),
  ]);
  await fixture.unsafe(pre0156Schema(schema));
  await fixture.unsafe(migration);

  await fixture.unsafe(`
    INSERT INTO app_users (id, display_name) VALUES
      (101, 'Staff'), (202, 'Guardian A'), (303, 'Guardian B'), (404, 'Guardian C');
    INSERT INTO organizations (id, slug, name, timezone, status, created_by_user_id)
    VALUES (
      '11111111-1111-4111-8111-111111111111', 'fixture', 'Fixture',
      'America/Los_Angeles', 'active', 101
    );
    INSERT INTO organization_members (
      organization_id, user_id, role, status, joined_at
    ) VALUES (
      '11111111-1111-4111-8111-111111111111', 101, 'owner', 'active', NOW()
    );
    INSERT INTO student_profiles (
      id, organization_id, display_name, status, created_by_user_id
    ) VALUES
      ('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Student 1', 'active', 101),
      ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Student 2', 'active', 101),
      ('23333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Student 3', 'active', 101);
    INSERT INTO guardian_links (
      id, organization_id, student_id, relationship, status, created_by_user_id
    ) VALUES
      ('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 'parent', 'active', 101),
      ('32222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'parent', 'active', 101),
      ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '23333333-3333-4333-8333-333333333333', 'guardian', 'active', 101);
  `);

  const tokenA = 'A'.repeat(43);
  const tokenB = 'B'.repeat(43);
  const tokenC = 'C'.repeat(43);
  await fixture.unsafe(`
    INSERT INTO guardian_account_binding_invites (
      id, organization_id, guardian_link_id, token_hash, expires_at, created_by_user_id
    ) VALUES
      ('41111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', '${hash(tokenA)}', NOW() + INTERVAL '1 hour', 101),
      ('42222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '32222222-2222-4222-8222-222222222222', '${hash(tokenB)}', NOW() + INTERVAL '1 hour', 101),
      ('43333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', '${hash(tokenC)}', NOW() + INTERVAL '1 hour', 101);
  `);
  await expectPgCode(
    () => fixture!.unsafe(`
      INSERT INTO guardian_account_binding_invites (
        organization_id, guardian_link_id, token_hash, expires_at, created_by_user_id
      ) VALUES (
        '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111',
        '${'d'.repeat(64)}', NOW() + INTERVAL '1 hour', 101
      )
    `),
    '23505',
  );

  const tokenColumns = await fixture`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'guardian_account_binding_invites' ORDER BY ordinal_position`;
  if (tokenColumns.some((row) => row.column_name === 'token')) {
    throw new Error('guardian invite schema persisted a raw token column');
  }

  process.env.DB_HOST = host;
  process.env.DB_PORT = String(port);
  process.env.DB_USER = user;
  process.env.DB_PASS = password;
  process.env.DB_NAME = fixtureDatabase;
  const [
    { teachingSaasRepository },
    { deleteAccount, PURGE_TABLES, ANONYMIZE_TABLES },
    { sql },
  ] = await Promise.all([
    import('../../src/routes/teaching_saas.js'),
    import('../../src/utils/account_delete.js'),
    import('../../src/db/connection.js'),
  ]);
  const accountDeleteColumns = new Map<string, Set<string>>();
  for (const [table, column] of PURGE_TABLES) {
    if (!accountDeleteColumns.has(table)) accountDeleteColumns.set(table, new Set());
    accountDeleteColumns.get(table)!.add(column);
  }
  for (const { table, idCol, nameCol } of ANONYMIZE_TABLES) {
    if (!accountDeleteColumns.has(table)) accountDeleteColumns.set(table, new Set());
    accountDeleteColumns.get(table)!.add(idCol);
    if (nameCol) accountDeleteColumns.get(table)!.add(nameCol);
  }
  for (const [table, columns] of accountDeleteColumns) {
    const exists = await fixture`
      SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS exists`;
    if (exists[0]?.exists !== true) {
      await fixture.unsafe(
        `CREATE TABLE ${table} (${[...columns].map((column) => `${column} TEXT`).join(', ')})`,
      );
    }
  }
  const actorA = { userId: 202, displayName: 'Guardian A', source: 'session' as const };
  const actorB = { userId: 303, displayName: 'Guardian B', source: 'session' as const };
  const actorC = { userId: 404, displayName: 'Guardian C', source: 'session' as const };
  const staff = { userId: 101, displayName: 'Staff', source: 'session' as const };

  const sameActor = await Promise.all([
    teachingSaasRepository.consumeGuardianAccountBindingInvite(
      actorA, { tokenHash: hash(tokenA) }, 'same-a',
    ),
    teachingSaasRepository.consumeGuardianAccountBindingInvite(
      actorA, { tokenHash: hash(tokenA) }, 'same-b',
    ),
  ]);
  if (sameActor.some((result) => result.status !== 200)) {
    throw new Error(`same-actor replay failed: ${JSON.stringify(sameActor)}`);
  }
  const sameActorState = await sql`
    SELECT invite.consumed_by_user_id_snapshot, guardian.guardian_user_id,
           COUNT(audit.id)::int AS audit_count
    FROM guardian_account_binding_invites invite
    JOIN guardian_links guardian
      ON guardian.organization_id = invite.organization_id
     AND guardian.id = invite.guardian_link_id
    LEFT JOIN teaching_audit_events audit
      ON audit.entity_id = invite.id::text AND audit.action = 'guardian.account-binding.consume'
    WHERE invite.id = '41111111-1111-4111-8111-111111111111'
    GROUP BY invite.consumed_by_user_id_snapshot, guardian.guardian_user_id`;
  if (Number(sameActorState[0]?.consumed_by_user_id_snapshot) !== 202
      || Number(sameActorState[0]?.guardian_user_id) !== 202
      || Number(sameActorState[0]?.audit_count) !== 1) {
    throw new Error(`same-actor state was not idempotent: ${JSON.stringify(sameActorState)}`);
  }

  const distinctActors = await Promise.allSettled([
    teachingSaasRepository.consumeGuardianAccountBindingInvite(
      actorB, { tokenHash: hash(tokenB) }, 'distinct-b',
    ),
    teachingSaasRepository.consumeGuardianAccountBindingInvite(
      actorC, { tokenHash: hash(tokenB) }, 'distinct-c',
    ),
  ]);
  const distinctSuccesses = distinctActors.filter((result) => result.status === 'fulfilled');
  const distinctFailures = distinctActors.filter((result) => result.status === 'rejected');
  if (distinctSuccesses.length !== 1 || distinctFailures.length !== 1
      || ![404, 409].includes(rejectedStatus(distinctFailures[0]) ?? 0)) {
    throw new Error(`distinct-actor race was not single-winner: ${JSON.stringify(distinctActors)}`);
  }
  const distinctState = await sql`
    SELECT invite.consumed_by_user_id_snapshot, guardian.guardian_user_id
    FROM guardian_account_binding_invites invite
    JOIN guardian_links guardian
      ON guardian.organization_id = invite.organization_id
     AND guardian.id = invite.guardian_link_id
    WHERE invite.id = '42222222-2222-4222-8222-222222222222'`;
  if (Number(distinctState[0]?.consumed_by_user_id_snapshot)
      !== Number(distinctState[0]?.guardian_user_id)) {
    throw new Error(`distinct-actor winner mismatch: ${JSON.stringify(distinctState)}`);
  }

  const consumeVersusRevoke = await Promise.allSettled([
    teachingSaasRepository.consumeGuardianAccountBindingInvite(
      actorB, { tokenHash: hash(tokenC) }, 'consume-race',
    ),
    teachingSaasRepository.revokeGuardianAccountBindingInvite(
      staff,
      'fixture',
      '23333333-3333-4333-8333-333333333333',
      '33333333-3333-4333-8333-333333333333',
      '43333333-3333-4333-8333-333333333333',
      'revoke-race',
      'e'.repeat(64),
      'revoke-race',
    ),
  ]);
  if (consumeVersusRevoke.filter((result) => result.status === 'fulfilled').length !== 1
      || consumeVersusRevoke.filter((result) => result.status === 'rejected').length !== 1) {
    throw new Error(`consume/revoke race was not single-winner: ${JSON.stringify(consumeVersusRevoke)}`);
  }
  const terminal = await sql`
    SELECT num_nonnulls(expired_at, consumed_at, revoked_at)::int AS terminal_count
    FROM guardian_account_binding_invites
    WHERE id = '43333333-3333-4333-8333-333333333333'`;
  if (Number(terminal[0]?.terminal_count) !== 1) {
    throw new Error(`consume/revoke race did not freeze one terminal: ${JSON.stringify(terminal)}`);
  }

  await expectPgCode(
    () => sql`UPDATE guardian_account_binding_invites
              SET expires_at = expires_at + INTERVAL '1 hour'
              WHERE id = '41111111-1111-4111-8111-111111111111'`,
    '55000',
  );
  await expectPgCode(
    () => sql`DELETE FROM guardian_account_binding_invites
              WHERE id = '41111111-1111-4111-8111-111111111111'`,
    '55000',
  );

  await sql`
    UPDATE student_profiles
    SET account_user_id = 202, account_linked_at = NOW()
    WHERE organization_id = '11111111-1111-4111-8111-111111111111'
      AND id = '21111111-1111-4111-8111-111111111111'`;
  await deleteAccount(202, 'u202');
  const deletedAccount = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM app_users WHERE id = 202) AS user_count,
      student.account_user_id, student.account_linked_at,
      guardian.guardian_user_id, guardian.account_linked_at AS guardian_linked_at,
      invite.consumed_by_user_id, invite.consumed_by_user_id_snapshot
    FROM student_profiles student
    JOIN guardian_links guardian
      ON guardian.organization_id = student.organization_id
     AND guardian.student_id = student.id
    JOIN guardian_account_binding_invites invite
      ON invite.organization_id = guardian.organization_id
     AND invite.guardian_link_id = guardian.id
    WHERE student.id = '21111111-1111-4111-8111-111111111111'`;
  const afterDelete = deletedAccount[0];
  if (Number(afterDelete?.user_count) !== 0
      || afterDelete?.account_user_id !== null || afterDelete?.account_linked_at !== null
      || afterDelete?.guardian_user_id !== null || afterDelete?.guardian_linked_at !== null
      || afterDelete?.consumed_by_user_id !== null
      || Number(afterDelete?.consumed_by_user_id_snapshot) !== 202) {
    throw new Error(`account deletion did not preserve the intended history: ${JSON.stringify(deletedAccount)}`);
  }

  console.log(JSON.stringify({
    migration: '0156 applied',
    rawTokenColumn: false,
    sameActorReplay: sameActor.map((result) => result.status),
    distinctActorRace: distinctActors.map((result) => result.status),
    consumeRevokeRace: consumeVersusRevoke.map((result) => result.status),
    terminalImmutable: true,
    accountDelete: 'paired links cleared; consumer snapshot retained',
  }));
  await sql.end();
}

try {
  await main();
} finally {
  if (fixture) await fixture.end().catch(() => undefined);
  await admin.unsafe(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${fixtureDatabase}' AND pid <> pg_backend_pid();
  `).catch(() => undefined);
  await admin.unsafe(`DROP DATABASE IF EXISTS "${fixtureDatabase}"`).catch(() => undefined);
  await admin.end();
}
