import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(calls).toContainEqual([
      expect.stringContaining('merged_into_user_id = ?'),
      [330, 655],
    ]);
  });
});
