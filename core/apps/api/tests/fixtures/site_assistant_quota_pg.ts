/** Run only against a dedicated local fixture database; never the application DB. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import type { QueryRunner } from '../../src/db/connection.js';
import { reserveAssistantQuestion } from '../../src/utils/site_assistant_quota.js';

if (process.env.DB_NAME !== 'site_assistant_quota_test' || process.env.DB_HOST !== '127.0.0.1') {
  throw new Error('A dedicated local site_assistant_quota_test database is required');
}
const schema = `quota_${randomUUID().replaceAll('-', '')}`;
const options = { host: '127.0.0.1', port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USER ?? 'postgres', password: process.env.DB_PASS ?? 'dev',
  database: 'site_assistant_quota_test', max: 8 };
const admin = postgres({ ...options, max: 1 });
await admin.unsafe(`CREATE SCHEMA ${schema}`);
const scopedOptions = { ...options, connection: { search_path: schema } };
let db = postgres(scopedOptions);
let time = '2026-09-28T15:59:59Z';
const run: QueryRunner = async <T>(statement: string, params: unknown[] = []) => {
  // Replace only the database clock in this fixture to test a real midnight boundary.
  const rows = await db.unsafe(statement.replaceAll('statement_timestamp()', `'${time}'::timestamptz`).replace('?', '$1'), params as never[]);
  return rows as unknown as T[];
};
try {
  await db.unsafe(await readFile(new URL('../../migrations/0251_site_assistant_daily_usage.sql', import.meta.url), 'utf8'));
  await db`INSERT INTO site_assistant_daily_usage VALUES ('2026-09-27', 100)`;
  await db.unsafe(await readFile(new URL('../../migrations/0253_site_assistant_quota_1000.sql', import.meta.url), 'utf8'));
  assert.equal((await db`SELECT questions FROM site_assistant_daily_usage WHERE day='2026-09-27'`)[0].questions, 100);
  const attempts = await Promise.all(Array.from({ length: 1030 }, () => reserveAssistantQuestion(run)));
  assert.equal(attempts.filter(row => row.allowed).length, 1000);
  assert.equal(attempts.filter(row => !row.allowed).length, 30);
  assert.ok(attempts.every(row => row.retryAfter === 1));
  await db.end();
  db = postgres(scopedOptions);
  assert.equal((await reserveAssistantQuestion(run)).allowed, false, 'quota persists after reconnect');
  assert.equal((await db`SELECT questions FROM site_assistant_daily_usage WHERE day='2026-09-28'`)[0].questions, 1000);
  time = '2026-09-28T16:00:00Z';
  assert.deepEqual(await reserveAssistantQuestion(run), { allowed: true, retryAfter: 86400 });
  const days = await db`SELECT day::text, questions FROM site_assistant_daily_usage ORDER BY day`;
  assert.deepEqual([...days], [{ day: '2026-09-27', questions: 100 }, { day: '2026-09-28', questions: 1000 }, { day: '2026-09-29', questions: 1 }]);
  console.log('PASS: migration preserves usage; 1030 concurrent attempts admit exactly 1000; reconnect retains cap; Beijing midnight resets.');
} finally {
  await db.end();
  await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
