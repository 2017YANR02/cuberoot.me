import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import { registrationReport, membershipSummaryReport } from '../src/utils/admin_reports.js';
import type { QueryRunner } from '../src/db/connection.js';

describe.skipIf(process.env.MCP_TEST_PG !== '1')('MCP PostgreSQL contracts', () => {
  it('applies the migration, reports zero days and active plans, consumes codes once and cascades deletion inside a rolled-back fixture', async () => {
    const sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 1 });
    const rollback = new Error('fixture rollback');
    try {
      await expect(sql.begin(async tx => {
        const schema = `mcp_test_${randomUUID().replaceAll('-', '')}`;
        await tx.unsafe(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}"`);
        await tx.unsafe('CREATE TABLE app_users(id BIGINT PRIMARY KEY, created_at TIMESTAMPTZ, merged_into_user_id BIGINT); CREATE TABLE memberships(plan_slug TEXT, expires_at TIMESTAMPTZ)');
        await tx.unsafe(await readFile(new URL('../migrations/0240_mcp_oauth.sql', import.meta.url), 'utf8'));
        await tx.unsafe("INSERT INTO app_users VALUES(1,'2026-01-01T23:59:59Z',NULL),(2,'2026-01-02T00:00:00Z',NULL),(3,'2026-01-01T12:00:00Z',1)");
        await tx.unsafe("INSERT INTO memberships VALUES('personal_month',NULL),('enterprise_year',NOW()+INTERVAL '1 day'),('personal_month',NOW()-INTERVAL '1 day')");
        const run: QueryRunner = async <T>(query: string, values: unknown[] = []) => {
          let n = 0;
          return await tx.unsafe(query.replace(/\?/g, () => `$${++n}`), values as never[]) as unknown as T[];
        };
        const rows = await registrationReport(run, { from: '2026-01-01', to: '2026-01-03', days: 3 });
        expect(rows.map(row => Number(row.count))).toEqual([1, 1, 0]);
        expect(await membershipSummaryReport(run)).toEqual([{ active_personal: '1', active_enterprise: '1' }]);
        const id = randomUUID();
        await tx`INSERT INTO mcp_oauth_grants(id,user_id,redirect_uri,code_hash,code_challenge,code_expires_at)
          VALUES(${id},1,'https://chatgpt.com/connector_platform_oauth_redirect',${'a'.repeat(64)},${'b'.repeat(43)},NOW()+INTERVAL '5 minutes')`;
        const consume = () => tx`UPDATE mcp_oauth_grants SET code_hash=NULL WHERE code_hash=${'a'.repeat(64)} AND code_expires_at>NOW() RETURNING id`;
        expect(await consume()).toHaveLength(1);
        expect(await consume()).toHaveLength(0);
        await tx`DELETE FROM app_users WHERE id=1`;
        expect(await tx`SELECT id FROM mcp_oauth_grants`).toHaveLength(0);
        throw rollback;
      })).rejects.toBe(rollback);
    } finally { await sql.end(); }
  });
  it('PostgreSQL enforces the production pool read-only and timeout settings', async () => {
    const sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 1,
      connection: { default_transaction_read_only: true, statement_timeout: 2000, lock_timeout: 500 } });
    try {
      expect((await sql`SHOW transaction_read_only`)[0].transaction_read_only).toBe('on');
      await expect(sql`CREATE TABLE mcp_forbidden_write(id INT)`).rejects.toMatchObject({ code: '25006' });
      await expect(sql`SELECT pg_sleep(4)`).rejects.toMatchObject({ code: '57014' });
    } finally { await sql.end(); }
  });
});
