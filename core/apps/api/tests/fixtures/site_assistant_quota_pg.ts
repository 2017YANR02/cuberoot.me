/** Run only against a dedicated local fixture database; never the application DB. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import type { QueryRunner } from '../../src/db/connection.js';
import { reserveAssistantQuestion } from '../../src/utils/site_assistant_quota.js';

if (process.env.DB_NAME !== 'site_assistant_quota_test' || process.env.DB_HOST !== '127.0.0.1') {
  throw new Error('A dedicated local site_assistant_quota_test database is required');
}
const options = { host: '127.0.0.1', port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USER ?? 'postgres', password: process.env.DB_PASS ?? 'dev',
  database: 'site_assistant_quota_test', max: 8 };
let db = postgres(options);
let time = '2026-09-28T15:59:59Z';
const run: QueryRunner = async <T>(statement: string) => {
  // Replace only the database clock in this fixture to test a real midnight boundary.
  const rows = await db.unsafe(statement.replaceAll('statement_timestamp()', `'${time}'::timestamptz`));
  return rows as unknown as T[];
};
try {
  await db.unsafe(await readFile(new URL('../../migrations/0251_site_assistant_daily_usage.sql', import.meta.url), 'utf8'));
  const attempts = await Promise.all(Array.from({ length: 130 }, () => reserveAssistantQuestion(run)));
  assert.equal(attempts.filter(row => row.allowed).length, 100);
  assert.equal(attempts.filter(row => !row.allowed).length, 30);
  assert.ok(attempts.every(row => row.retryAfter === 1));
  await db.end();
  db = postgres(options);
  assert.equal((await reserveAssistantQuestion(run)).allowed, false, 'quota persists after reconnect');
  assert.equal((await db`SELECT questions FROM site_assistant_daily_usage`)[0].questions, 100);
  time = '2026-09-28T16:00:00Z';
  assert.deepEqual(await reserveAssistantQuestion(run), { allowed: true, retryAfter: 86400 });
  const days = await db`SELECT day::text, questions FROM site_assistant_daily_usage ORDER BY day`;
  assert.deepEqual([...days], [{ day: '2026-09-28', questions: 100 }, { day: '2026-09-29', questions: 1 }]);
  console.log('PASS: 130 concurrent attempts admit exactly 100; reconnect retains cap; Beijing midnight resets.');
} finally { await db.end(); }
