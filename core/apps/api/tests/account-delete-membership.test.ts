import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  begin: vi.fn(), tx: vi.fn(), unsafe: vi.fn(), removeFiles: vi.fn(),
}));
vi.mock('../src/db/connection.js', () => ({ sql: { begin: mocks.begin } }));
vi.mock('../src/utils/drive_storage.js', () => ({ removeDriveAccountFiles: mocks.removeFiles }));

import { AccountHasMembershipContractError, deleteAccount } from '../src/utils/account_delete.js';

describe('account deletion renewal guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.tx, { unsafe: mocks.unsafe });
    mocks.begin.mockImplementation(async (run) => run(mocks.tx));
    mocks.tx.mockImplementation(async (parts: TemplateStringsArray) =>
      parts.join('?').includes('SELECT id FROM app_users') ? [{ id: 42 }] : []);
  });

  it.each(['pending', 'active'])('rejects %s contracts before any mutation', async (state) => {
    mocks.tx.mockImplementation(async (parts: TemplateStringsArray) => {
      const query = parts.join('?');
      if (query.includes('SELECT id FROM app_users')) return [{ id: 42 }];
      if (query.includes('FROM membership_contracts')) return [{ id: 'contract', state }];
      return [];
    });
    await expect(deleteAccount(42, '2020TEST01')).rejects.toThrow(AccountHasMembershipContractError);
    expect(mocks.tx).toHaveBeenCalledTimes(2);
    expect(mocks.tx.mock.calls[1].slice(1)).toEqual(['2020TEST01', 'u42']);
    expect(mocks.unsafe).not.toHaveBeenCalled();
    expect(mocks.removeFiles).not.toHaveBeenCalled();
  });

  it('allows deletion when no pending or active contract exists, retaining audit rows', async () => {
    await deleteAccount(42, 'u42');
    const statements = mocks.tx.mock.calls.map(([parts]) => parts.join('?'));
    expect(statements[1]).toContain("state IN ('pending', 'active')");
    expect(statements).toContain('DELETE FROM app_users WHERE id = ?');
    expect(mocks.unsafe.mock.calls.some(([query]) => query.includes('membership_contracts'))).toBe(false);
    expect(mocks.removeFiles).toHaveBeenCalledOnce();
  });
});
