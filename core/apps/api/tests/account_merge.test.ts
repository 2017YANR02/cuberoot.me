import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const mocks = vi.hoisted(() => ({
  tx: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ withTransaction: mocks.withTransaction }));
vi.mock('../src/utils/account_delete.js', () => ({
  PURGE_TABLES: [['owned_rows', 'owner_key']],
  ANONYMIZE_TABLES: [],
}));

import { mergeAccounts, parseAccountMergeCode } from '../src/utils/account_merge.js';

describe('account merge code', () => {
  beforeEach(() => {
    mocks.tx.mockReset();
    mocks.withTransaction.mockReset();
    mocks.withTransaction.mockImplementation(async (run) => run(mocks.tx));
  });

  it('accepts only a safe target uid and six digits', () => {
    expect(parseAccountMergeCode(' 330-012345 ')).toEqual({ targetUserId: 330, code: '012345' });
    for (const value of ['0-012345', '330-12345', '330-1234567', '1e2-123456', `${Number.MAX_SAFE_INTEGER + 1}-123456`]) {
      expect(parseAccountMergeCode(value)).toBeNull();
    }
  });

  it('moves ownership and releases a source WCA ID before assigning it to the target', async () => {
    mocks.tx.mockImplementation(async (text: string) => {
      if (text.includes('SELECT id, wca_id, password_hash, merged_into_user_id')) {
        return [
          { id: 330, wca_id: null, password_hash: null, merged_into_user_id: null },
          { id: 655, wca_id: '2020TEST01', password_hash: null, merged_into_user_id: null },
        ];
      }
      if (text.includes('SELECT user_id, provider') || text.includes('FROM pg_constraint')) return [];
      return [];
    });

    await mergeAccounts(655, 330);

    const calls = mocks.tx.mock.calls as [string, unknown[]][];
    const sourceWcaClear = calls.findIndex(([text]) => text.includes('UPDATE app_users SET wca_id = NULL'));
    const targetUpdate = calls.findIndex(([text]) => text.includes('UPDATE app_users AS target'));
    expect(sourceWcaClear).toBeGreaterThanOrEqual(0);
    expect(sourceWcaClear).toBeLessThan(targetUpdate);
    expect(calls).toContainEqual([
      expect.stringContaining('UPDATE "owned_rows" SET "owner_key"'),
      ['2020TEST01', 'u330'],
    ]);
    expect(calls[targetUpdate][1]).toEqual(['2020TEST01', true, true, true, 330, 655]);
    const contractMove = calls.findIndex(([text]) => text.includes('UPDATE membership_contracts'));
    expect(contractMove).toBeGreaterThan(targetUpdate);
    expect(calls[contractMove][1]).toEqual(['2020TEST01', 'u655', '2020TEST01']);
    expect(calls).toContainEqual([
      expect.stringContaining('merged_into_user_id = ?'),
      [330, 655],
    ]);
  });

  it.skipIf(process.env.DESKPET_TEST_PG !== '1')('merges pet ownership without losing higher growth, and rolls back with the account transaction', async () => {
    const schema = `pet_merge_${randomUUID().replaceAll('-', '')}`;
    const sql = postgres({ host: '127.0.0.1', port: Number(process.env.DESKPET_TEST_PORT ?? 5433), user: 'postgres', password: 'dev', database: process.env.DESKPET_TEST_DB ?? 'cuberoot_db', max: 2, connection: { search_path: schema, timezone: 'UTC' } });
    try {
      await sql.unsafe(`CREATE SCHEMA "${schema}"`);
      await sql.unsafe('CREATE TABLE app_users (id BIGINT PRIMARY KEY)');
      await sql.unsafe(await readFile(new URL('../migrations/0236_pet_adoptions.sql', import.meta.url), 'utf8'));
      await sql`INSERT INTO app_users (id) VALUES (330), (655)`;
      const care = (bond: number, food: number) => ({ bond, food, rewarded: ['feed'], lastAction: { feed: 123 } });
      const sourceCare = care(28, 75), targetCare = care(12, 60), equalTargetCare = care(4, 99);
      await sql`INSERT INTO user_pets ${sql([
        { user_id: 655, pet_id: 'rootbeast', adopted_at: '2026-09-01', care: sourceCare },
        { user_id: 330, pet_id: 'rootbeast', adopted_at: '2026-09-05', care: targetCare },
        { user_id: 655, pet_id: 'calico', adopted_at: '2026-09-06', care: targetCare },
        { user_id: 330, pet_id: 'calico', adopted_at: '2026-09-02', care: sourceCare },
        { user_id: 655, pet_id: 'clawd', adopted_at: '2026-09-03', care: care(4, 20) },
        { user_id: 330, pet_id: 'clawd', adopted_at: '2026-09-08', care: equalTargetCare },
        { user_id: 655, pet_id: 'cloudling', adopted_at: '2026-09-04', care: targetCare },
      ])}`;
      let failAfterPets = true;
      mocks.withTransaction.mockImplementation(async run => sql.begin(async tx => run(async (statement: string, values: never[] = []) => {
        if (statement.includes('SELECT id, wca_id, password_hash, merged_into_user_id')) return [
          { id: 330, wca_id: null, password_hash: null, merged_into_user_id: null },
          { id: 655, wca_id: null, password_hash: null, merged_into_user_id: null },
        ];
        if (statement.includes('UPDATE "owned_rows"') && failAfterPets) throw new Error('later account failure');
        // Execute the real migration, FK inventory, and merge SQL; other account domains
        // are outside this isolated fixture and covered by the account unit test above.
        if (statement.includes('FROM pg_constraint') || /(?:INSERT INTO|DELETE FROM) user_pets/.test(statement)) {
          let index = 0;
          return tx.unsafe(statement.replace(/\?/g, () => `$${++index}`), values);
        }
        return [];
      })));
      await expect(mergeAccounts(655, 330)).rejects.toThrow('later account failure');
      expect((await sql`SELECT COUNT(*)::int AS n FROM user_pets WHERE user_id = 655`)[0].n).toBe(4);
      expect((await sql`SELECT care FROM user_pets WHERE user_id = 330 AND pet_id = 'rootbeast'`)[0].care).toEqual(targetCare);
      failAfterPets = false;
      await mergeAccounts(655, 330);
      const rows = await sql`SELECT pet_id, adopted_at::date::text AS day, care FROM user_pets WHERE user_id = 330 ORDER BY pet_id`;
      expect(rows.map(row => ({ ...row }))).toEqual([
        { pet_id: 'calico', day: '2026-09-02', care: sourceCare },
        { pet_id: 'clawd', day: '2026-09-03', care: equalTargetCare },
        { pet_id: 'cloudling', day: '2026-09-04', care: targetCare },
        { pet_id: 'rootbeast', day: '2026-09-01', care: sourceCare },
      ]);
      expect((await sql`SELECT COUNT(*)::int AS n FROM user_pets WHERE user_id = 655`)[0].n).toBe(0);
    } finally {
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
  });
});
