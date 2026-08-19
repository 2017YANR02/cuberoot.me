import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? 5433);
const user = process.env.DB_USER ?? 'postgres';
const password = process.env.DB_PASS ?? 'dev';
const adminDatabase = process.env.DB_NAME ?? 'cuberoot_db';
const fixtureDatabase = `cuberoot_teaching_conversations_fixture_${process.pid}`;

const admin = postgres({ host, port, user, password, database: adminDatabase, max: 1 });
let fixture: ReturnType<typeof postgres> | null = null;

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';

function pre0158Schema(schema: string): string {
  const conversationStart = schema.indexOf('-- 家校沟通会话、独立已读游标与不可变消息(0158)。');
  if (conversationStart < 0) throw new Error('0158 conversation schema section not found');
  const beforeConversations = schema.slice(0, conversationStart);
  const withoutDedupeColumn = beforeConversations.replace(
    '  dedupe_key  VARCHAR(200),\n',
    '',
  );
  const withoutDedupeCheck = withoutDedupeColumn.replace(
    '  read_at     TIMESTAMPTZ,\n'
      + '  CONSTRAINT notifications_dedupe_key_check CHECK (\n'
      + '    dedupe_key IS NULL OR (\n'
      + '      dedupe_key = btrim(dedupe_key)\n'
      + '      AND length(dedupe_key) BETWEEN 1 AND 200\n'
      + '    )\n'
      + '  )\n',
    '  read_at     TIMESTAMPTZ\n',
  ).replace(
    'CREATE UNIQUE INDEX uq_notifications_user_kind_dedupe\n'
      + '  ON notifications (user_key, kind, dedupe_key)\n'
      + '  WHERE dedupe_key IS NOT NULL;\n',
    '',
  );
  if (withoutDedupeCheck.includes('dedupe_key')
      || withoutDedupeCheck.includes('CREATE TABLE teaching_conversations')) {
    throw new Error('failed to derive the pre-0158 schema');
  }
  return withoutDedupeCheck;
}

function statusOf(result: PromiseSettledResult<unknown>): number | null {
  if (result.status !== 'rejected') return null;
  const reason = result.reason as { status?: unknown };
  return typeof reason?.status === 'number' ? reason.status : null;
}

async function expectStatus(operation: () => Promise<unknown>, expected: number): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if ((error as { status?: unknown }).status === expected) return;
    throw error;
  }
  throw new Error(`expected API status ${expected}`);
}

async function expectPgCode(operation: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if ((error as { code?: unknown }).code === expected) return;
    throw error;
  }
  throw new Error(`expected PostgreSQL error ${expected}`);
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out, possible lock cycle`)), 15_000);
    }),
  ]);
}

async function main(): Promise<void> {
  await admin.unsafe(`CREATE DATABASE "${fixtureDatabase}"`);
  fixture = postgres({ host, port, user, password, database: fixtureDatabase, max: 20 });
  const [schema, migration] = await Promise.all([
    readFile(new URL('../../src/db/schema.pg.sql', import.meta.url), 'utf8'),
    readFile(new URL('../../migrations/0158_teaching_conversations.sql', import.meta.url), 'utf8'),
  ]);
  await fixture.unsafe(pre0158Schema(schema));
  await fixture.unsafe(migration);

  const longOwnerName = `Owner ${'X'.repeat(114)}`;
  await fixture.unsafe(`
    INSERT INTO app_users (id, display_name) VALUES
      (101, '${longOwnerName}'),
      (202, 'Learner'),
      (303, 'Guardian Reader'),
      (404, 'Guardian Read Delete'),
      (505, 'Guardian Author Delete'),
      (707, 'Guardian Revoke'),
      (808, 'Finance'),
      (909, 'Viewer');
    INSERT INTO organizations (id, slug, name, timezone, status, created_by_user_id)
    VALUES (
      '${ORGANIZATION_ID}', 'fixture', 'Fixture', 'America/Los_Angeles', 'active', 101
    );
    INSERT INTO organization_members (
      organization_id, user_id, role, status, joined_at
    ) VALUES
      ('${ORGANIZATION_ID}', 101, 'owner', 'active', NOW()),
      ('${ORGANIZATION_ID}', 808, 'finance', 'active', NOW()),
      ('${ORGANIZATION_ID}', 909, 'viewer', 'active', NOW());
    INSERT INTO student_profiles (
      id, organization_id, account_user_id, account_linked_at,
      display_name, status, created_by_user_id
    ) VALUES (
      '${STUDENT_ID}', '${ORGANIZATION_ID}', 202, NOW(), 'Learner', 'active', 101
    );
    INSERT INTO guardian_links (
      id, organization_id, student_id, guardian_user_id, account_linked_at,
      relationship, status, created_by_user_id
    ) VALUES
      ('33333333-3333-4333-8333-333333333303', '${ORGANIZATION_ID}', '${STUDENT_ID}', 303, NOW(), 'parent', 'active', 101),
      ('33333333-3333-4333-8333-333333333404', '${ORGANIZATION_ID}', '${STUDENT_ID}', 404, NOW(), 'parent', 'active', 101),
      ('33333333-3333-4333-8333-333333333505', '${ORGANIZATION_ID}', '${STUDENT_ID}', 505, NOW(), 'parent', 'active', 101),
      ('33333333-3333-4333-8333-333333333707', '${ORGANIZATION_ID}', '${STUDENT_ID}', 707, NOW(), 'parent', 'active', 101);
  `);

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

  const owner = { userId: 101, displayName: longOwnerName, source: 'session' as const };
  const learner = { userId: 202, displayName: 'Learner', source: 'session' as const };
  const guardian = { userId: 303, displayName: 'Guardian Reader', source: 'session' as const };
  const readDeleteGuardian = {
    userId: 404, displayName: 'Guardian Read Delete', source: 'session' as const,
  };
  const authorDeleteGuardian = {
    userId: 505, displayName: 'Guardian Author Delete', source: 'session' as const,
  };
  const revokeGuardian = { userId: 707, displayName: 'Guardian Revoke', source: 'session' as const };
  const finance = { userId: 808, displayName: 'Finance', source: 'session' as const };
  const viewer = { userId: 909, displayName: 'Viewer', source: 'session' as const };

  const created = await teachingSaasRepository.createConversation(
    owner,
    'fixture',
    STUDENT_ID,
    { subject: 'Training update', body: 'Initial message' },
    'create-once',
    'a'.repeat(64),
    'create-request',
  );
  const conversationId = String((created.body.conversation as Record<string, unknown>).id);

  const sameKey = await withTimeout(Promise.all([
    teachingSaasRepository.replyConversation(
      owner, 'fixture', STUDENT_ID, conversationId,
      { body: 'Same idempotent reply' }, 'same-reply', 'b'.repeat(64), 'same-reply-a',
    ),
    teachingSaasRepository.replyConversation(
      owner, 'fixture', STUDENT_ID, conversationId,
      { body: 'Same idempotent reply' }, 'same-reply', 'b'.repeat(64), 'same-reply-b',
    ),
  ]), 'same-key replies');
  const sameIds = sameKey.map((result) => String(
    (result.body.message as Record<string, unknown>).id,
  ));
  if (new Set(sameIds).size !== 1) {
    throw new Error(`same idempotency key appended twice: ${JSON.stringify(sameIds)}`);
  }
  await expectStatus(
    () => teachingSaasRepository.replyConversation(
      owner, 'fixture', STUDENT_ID, conversationId,
      { body: 'Conflicting body' }, 'same-reply', 'c'.repeat(64), 'same-reply-conflict',
    ),
    409,
  );

  const burst = await withTimeout(Promise.all(
    Array.from({ length: 20 }, (_, index) => teachingSaasRepository.replyConversation(
      owner,
      'fixture',
      STUDENT_ID,
      conversationId,
      { body: `Concurrent reply ${index + 1}` },
      `burst-${index + 1}`,
      (index + 10).toString(16).padStart(64, '0'),
      `burst-request-${index + 1}`,
    )),
  ), '20 concurrent replies');
  if (burst.some((result) => result.status !== 201)) {
    throw new Error(`concurrent replies returned non-201: ${JSON.stringify(burst)}`);
  }
  const afterBurst = await sql`
    SELECT sequence FROM teaching_conversation_messages
    WHERE organization_id = ${ORGANIZATION_ID} AND conversation_id = ${conversationId}
    ORDER BY sequence`;
  const burstSequences = afterBurst.map((row) => Number(row.sequence));
  const expectedBurstSequences = Array.from({ length: 22 }, (_, index) => index + 1);
  if (JSON.stringify(burstSequences) !== JSON.stringify(expectedBurstSequences)) {
    throw new Error(`20-way sequence allocation was not continuous: ${JSON.stringify(burstSequences)}`);
  }

  const readFiveNine = await withTimeout(Promise.all([
    teachingSaasRepository.markConversationRead(
      guardian, 'fixture', STUDENT_ID, conversationId,
      { lastReadSequence: 5 }, 'read-five', 'd'.repeat(64), 'read-five',
    ),
    teachingSaasRepository.markConversationRead(
      guardian, 'fixture', STUDENT_ID, conversationId,
      { lastReadSequence: 9 }, 'read-nine', 'e'.repeat(64), 'read-nine',
    ),
  ]), 'read cursor 5/9 race');
  if (readFiveNine.some((result) => Number(
    ((result.body.read as Record<string, unknown>).lastReadSequence),
  ) > 9)) {
    throw new Error(`read race returned invalid cursor: ${JSON.stringify(readFiveNine)}`);
  }
  const readState = await sql`
    SELECT last_read_sequence FROM teaching_conversation_participants
    WHERE organization_id = ${ORGANIZATION_ID}
      AND conversation_id = ${conversationId}
      AND participant_user_id = 303`;
  if (Number(readState[0]?.last_read_sequence) !== 9) {
    throw new Error(`read cursor regressed: ${JSON.stringify(readState)}`);
  }
  await expectStatus(
    () => teachingSaasRepository.markConversationRead(
      guardian, 'fixture', STUDENT_ID, conversationId,
      { lastReadSequence: 23 }, 'read-future', 'f'.repeat(64), 'read-future',
    ),
    400,
  );
  await expectPgCode(
    () => sql`
      UPDATE teaching_conversation_participants SET last_read_sequence = 8
      WHERE organization_id = ${ORGANIZATION_ID}
        AND conversation_id = ${conversationId}
        AND participant_user_id = 303`,
    '55000',
  );

  const beforeReplayNotification = await sql`
    SELECT id, read_at FROM notifications
    WHERE user_key = 'u303' AND kind = 'teaching_message'
      AND dedupe_key = ${`teaching-message:${conversationId}:2`}`;
  if (beforeReplayNotification.length !== 1 || beforeReplayNotification[0].read_at == null) {
    throw new Error('mark-read did not retain one read notification for the replay check');
  }
  await teachingSaasRepository.replyConversation(
    owner, 'fixture', STUDENT_ID, conversationId,
    { body: 'Same idempotent reply' }, 'same-reply', 'b'.repeat(64), 'same-reply-replay',
  );
  const afterReplayNotification = await sql`
    SELECT id, read_at FROM notifications
    WHERE user_key = 'u303' AND kind = 'teaching_message'
      AND dedupe_key = ${`teaching-message:${conversationId}:2`}`;
  if (afterReplayNotification.length !== 1
      || String(afterReplayNotification[0].id) !== String(beforeReplayNotification[0].id)
      || String(afterReplayNotification[0].read_at) !== String(beforeReplayNotification[0].read_at)) {
    throw new Error('idempotent notification replay duplicated or revived read state');
  }

  const currentBeforeReplyRead = Number((await sql`
    SELECT last_message_sequence FROM teaching_conversations
    WHERE organization_id = ${ORGANIZATION_ID} AND id = ${conversationId}`)[0].last_message_sequence);
  const replyReadRace = await withTimeout(Promise.allSettled([
    teachingSaasRepository.replyConversation(
      owner, 'fixture', STUDENT_ID, conversationId,
      { body: 'Reply versus read' }, 'reply-read-race', '1'.repeat(64), 'reply-read-reply',
    ),
    teachingSaasRepository.markConversationRead(
      learner, 'fixture', STUDENT_ID, conversationId,
      { lastReadSequence: currentBeforeReplyRead }, 'reply-read-race', '2'.repeat(64), 'reply-read-read',
    ),
  ]), 'reply versus read');
  if (replyReadRace.some((result) => result.status === 'rejected')) {
    throw new Error(`reply/read race failed: ${JSON.stringify(replyReadRace)}`);
  }

  await teachingSaasRepository.replyConversation(
    authorDeleteGuardian, 'fixture', STUDENT_ID, conversationId,
    { body: 'Authored before account deletion' }, 'author-before-delete',
    '3'.repeat(64), 'author-before-delete',
  );
  const deleteReplyRace = await withTimeout(Promise.allSettled([
    deleteAccount(505, 'u505'),
    teachingSaasRepository.replyConversation(
      owner, 'fixture', STUDENT_ID, conversationId,
      { body: 'Reply versus account deletion' }, 'reply-delete-race',
      '4'.repeat(64), 'reply-delete-race',
    ),
  ]), 'reply versus account deletion');
  if (deleteReplyRace.some((result) => result.status === 'rejected')) {
    throw new Error(`reply/delete race failed: ${JSON.stringify(deleteReplyRace)}`);
  }
  const deletedAuthor = await sql`
    SELECT author_user_id, author_display_name_snapshot
    FROM teaching_conversation_messages
    WHERE conversation_id = ${conversationId} AND body = 'Authored before account deletion'`;
  const deletedParticipant = await sql`
    SELECT participant_user_id, participant_display_name_snapshot
    FROM teaching_conversation_participants
    WHERE conversation_id = ${conversationId}
      AND participant_display_name_snapshot = 'Guardian Author Delete'`;
  if (deletedAuthor[0]?.author_user_id !== null
      || deletedAuthor[0]?.author_display_name_snapshot !== 'Guardian Author Delete'
      || deletedParticipant[0]?.participant_user_id !== null) {
    throw new Error('account deletion did not null live conversation refs and retain snapshots');
  }

  const deleteReadRace = await withTimeout(Promise.allSettled([
    deleteAccount(404, 'u404'),
    teachingSaasRepository.markConversationRead(
      readDeleteGuardian, 'fixture', STUDENT_ID, conversationId,
      { lastReadSequence: 1 }, 'read-delete-race', '5'.repeat(64), 'read-delete-race',
    ),
  ]), 'read versus account deletion');
  const deleteReadFailures = deleteReadRace.filter((result) => result.status === 'rejected');
  if (deleteReadFailures.some((result) => statusOf(result) !== 404)) {
    throw new Error(`read/delete race had an unexpected failure: ${JSON.stringify(deleteReadRace)}`);
  }

  const revokeRace = await withTimeout(Promise.allSettled([
    sql`
      UPDATE guardian_links SET status = 'revoked'
      WHERE organization_id = ${ORGANIZATION_ID} AND guardian_user_id = 707`,
    teachingSaasRepository.replyConversation(
      revokeGuardian, 'fixture', STUDENT_ID, conversationId,
      { body: 'Revoke race reply' }, 'scope-revoke-reply', '6'.repeat(64), 'scope-revoke-reply',
    ),
    teachingSaasRepository.getConversation(
      revokeGuardian, 'fixture', STUDENT_ID, conversationId, 'scope-revoke-read',
    ),
  ]), 'scope revoke versus read/write');
  const revokeFailures = revokeRace.filter((result) => result.status === 'rejected');
  if (revokeFailures.some((result) => statusOf(result) !== 404)) {
    throw new Error(`scope revoke race had an unexpected failure: ${JSON.stringify(revokeRace)}`);
  }
  await expectStatus(
    () => teachingSaasRepository.getConversation(
      revokeGuardian, 'fixture', STUDENT_ID, conversationId, 'scope-revoked-read',
    ),
    404,
  );
  await expectStatus(
    () => teachingSaasRepository.replyConversation(
      revokeGuardian, 'fixture', STUDENT_ID, conversationId,
      { body: 'Denied after revoke' }, 'scope-revoked-write', '7'.repeat(64), 'scope-revoked-write',
    ),
    404,
  );

  await expectStatus(
    () => teachingSaasRepository.getConversation(finance, 'fixture', STUDENT_ID, conversationId, 'finance'),
    404,
  );
  await expectStatus(
    () => teachingSaasRepository.getConversation(viewer, 'fixture', STUDENT_ID, conversationId, 'viewer'),
    404,
  );

  await sql`UPDATE organizations SET status = 'suspended' WHERE id = ${ORGANIZATION_ID}`;
  await teachingSaasRepository.getConversation(owner, 'fixture', STUDENT_ID, conversationId, 'suspended-read');
  const suspendedLastSequence = Number((await sql`
    SELECT last_message_sequence FROM teaching_conversations WHERE id = ${conversationId}`)[0].last_message_sequence);
  await teachingSaasRepository.markConversationRead(
    owner, 'fixture', STUDENT_ID, conversationId,
    { lastReadSequence: suspendedLastSequence }, 'suspended-mark-read',
    '8'.repeat(64), 'suspended-mark-read',
  );
  await expectStatus(
    () => teachingSaasRepository.getConversation(
      guardian, 'fixture', STUDENT_ID, conversationId, 'suspended-guardian-read',
    ),
    404,
  );
  await expectStatus(
    () => teachingSaasRepository.replyConversation(
      owner, 'fixture', STUDENT_ID, conversationId,
      { body: 'Denied while suspended' }, 'suspended-write', '9'.repeat(64), 'suspended-write',
    ),
    409,
  );
  await sql`UPDATE organizations SET status = 'active' WHERE id = ${ORGANIZATION_ID}`;

  await expectPgCode(
    () => sql.begin(async (tx) => {
      await tx`
        UPDATE teaching_conversations
        SET last_message_sequence = last_message_sequence + 1,
            last_message_at = clock_timestamp()
        WHERE organization_id = ${ORGANIZATION_ID} AND id = ${conversationId}`;
    }),
    '23514',
  );
  const lastSequence = Number((await sql`
    SELECT last_message_sequence FROM teaching_conversations WHERE id = ${conversationId}`)[0].last_message_sequence);
  await expectPgCode(
    () => sql`
      INSERT INTO teaching_conversation_messages (
        organization_id, conversation_id, student_id, sequence, body,
        author_user_id, author_display_name_snapshot, author_role_snapshot
      ) VALUES (
        ${ORGANIZATION_ID}, ${conversationId}, ${STUDENT_ID}, ${lastSequence + 2}, 'Gap',
        101, ${longOwnerName}, 'owner'
      )`,
    '23514',
  );

  const finalRows = await sql`
    SELECT COUNT(*)::int AS message_count, MIN(sequence)::int AS min_sequence,
           MAX(sequence)::int AS max_sequence, COUNT(DISTINCT sequence)::int AS distinct_sequences
    FROM teaching_conversation_messages
    WHERE organization_id = ${ORGANIZATION_ID} AND conversation_id = ${conversationId}`;
  const final = finalRows[0];
  if (Number(final.message_count) !== Number(final.max_sequence)
      || Number(final.min_sequence) !== 1
      || Number(final.distinct_sequences) !== Number(final.max_sequence)) {
    throw new Error(`final sequence range is not continuous: ${JSON.stringify(finalRows)}`);
  }

  console.log(JSON.stringify({
    migration: '0158 applied over pre-0158 snapshot',
    sameKeyReplay: sameIds,
    twentyWaySequence: `${burstSequences[0]}..${burstSequences.at(-1)}`,
    readCursorRace: 9,
    replyReadRace: replyReadRace.map((result) => result.status),
    replyDeleteRace: deleteReplyRace.map((result) => result.status),
    readDeleteRace: deleteReadRace.map((result) => result.status),
    revokeRace: revokeRace.map((result) => result.status),
    suspendedStaffReadAndMark: 'ok',
    immutableAccountSnapshots: 'ok',
    notificationDedupePreservedReadAt: true,
    finalSequence: Number(final.max_sequence),
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
