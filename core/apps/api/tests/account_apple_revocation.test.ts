import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ begin: vi.fn(), tx: vi.fn(), unsafe: vi.fn(), revoke: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn(), sql: { begin: mocks.begin } }));
vi.mock('../src/utils/apple_login.js', () => ({ revokeAppleIdentities: mocks.revoke }));
vi.mock('../src/utils/drive_storage.js', () => ({ removeDriveAccountFiles: vi.fn() }));
import { removeIdentity } from '../src/utils/account.js';
import { deleteAccount } from '../src/utils/account_delete.js';
const apple = { provider: 'apple', provider_uid: 'sub', apple_refresh_token_encrypted: Buffer.from('encrypted'), apple_token_key_version: 1 };
let identities: unknown[];
beforeEach(() => {
  vi.clearAllMocks();
  identities = [apple, { provider: 'email', provider_uid: 'tester@example.test' }];
  mocks.revoke.mockResolvedValue(undefined);
  Object.assign(mocks.tx, { unsafe: mocks.unsafe });
  mocks.begin.mockImplementation((run) => run(mocks.tx));
  mocks.tx.mockImplementation(async (parts: TemplateStringsArray) => {
    const sql = parts.join('?');
    if (sql.includes('SELECT id FROM app_users')) return [{ id: 42 }];
    if (sql.includes('FROM auth_identities')) return identities;
    return [];
  });
});
describe('Apple revocation inside existing account lifecycle', () => {
  it('revokes before unlinking but never revokes the last login identity', async () => {
    identities = [apple];
    expect(await removeIdentity(42, 'apple')).toBe('last');
    expect(mocks.revoke).not.toHaveBeenCalled();
    identities.push({ provider: 'email', provider_uid: 'tester@example.test' });
    expect(await removeIdentity(42, 'apple')).toBe('ok');
    expect(mocks.revoke).toHaveBeenCalledWith([apple]);
    const deleteIndex = mocks.tx.mock.calls.findIndex(([parts]) => parts.join('?').startsWith('DELETE FROM auth_identities'));
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.mock.invocationCallOrder[deleteIndex]);
  });
  it.each(['unlink', 'delete'])('retains identity and local account data if Apple is unavailable during %s', async (action) => {
    mocks.revoke.mockRejectedValue(new Error('Apple unavailable'));
    await expect(action === 'unlink' ? removeIdentity(42, 'apple') : deleteAccount(42, 'u42')).rejects.toThrow('Apple unavailable');
    const statements = mocks.tx.mock.calls.map(([parts]) => parts.join('?'));
    expect(statements.some((sql) => /DELETE|UPDATE/.test(sql.replace(/FOR UPDATE/g, '')))).toBe(false);
    expect(mocks.unsafe).not.toHaveBeenCalled();
  });
});
