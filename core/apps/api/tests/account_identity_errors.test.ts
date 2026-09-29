import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), begin: vi.fn(), tx: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, sql: { begin: mocks.begin } }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'fixture-only' }));
vi.mock('../src/utils/apple_login.js', () => ({ revokeAppleIdentities: vi.fn() }));

import { addIdentity, replaceCredentialIdentity } from '../src/utils/account.js';

let writeError: Error;
function uniqueError(constraintName: string) {
  return Object.assign(new Error(`synthetic uniqueness: ${constraintName}`), {
    code: '23505', constraint_name: constraintName,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  writeError = new Error('synthetic storage failure');
  mocks.query.mockResolvedValue([]);
  mocks.begin.mockImplementation(async (action) => action(mocks.tx));
  mocks.tx.mockImplementation(async (parts: TemplateStringsArray) => {
    const statement = parts.join('?');
    if (statement.includes('SELECT 1 FROM auth_identities')) return [];
    if (statement.includes('SELECT id, provider_uid FROM auth_identities')) return [{ id: 7, provider_uid: 'old@example.invalid' }];
    if (statement.includes('UPDATE app_users SET')) throw writeError;
    if (statement.includes('INSERT INTO auth_identities') || statement.includes('UPDATE auth_identities')) throw writeError;
    throw new Error(`unexpected account statement: ${statement}`);
  });
});

describe('account identity storage error classification', () => {
  it('keeps owner conflicts and same-owner additions distinct', async () => {
    const owner = { id: 99, display_name: '', avatar_url: null, avatar_source: 'auto', avatar_preset: null,
      wca_id: null, is_admin: false };
    mocks.query.mockResolvedValueOnce([owner]);
    expect(await addIdentity(42, 'email', 'new@example.invalid')).toBe('conflict');
    expect(mocks.begin).not.toHaveBeenCalled();

    mocks.query.mockResolvedValueOnce([{ ...owner, id: 42 }]);
    expect(await addIdentity(42, 'email', 'new@example.invalid')).toBe('ok');
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it('distinguishes an occupied email slot from another account owning the candidate', async () => {
    mocks.tx.mockImplementation(async (parts: TemplateStringsArray) => {
      const statement = parts.join('?');
      if (statement.includes('SELECT 1 FROM auth_identities')) {
        return Object.assign([{ present: 1 }], { count: 1 });
      }
      throw new Error(`unexpected account statement: ${statement}`);
    });
    expect(await addIdentity(42, 'email', 'new@example.invalid')).toBe('has-email');
    expect(mocks.tx.mock.calls.some(([parts]) => parts.join('?').includes('INSERT INTO auth_identities'))).toBe(false);
  });

  it('treats a raced same-account replacement as idempotent and refreshes verification', async () => {
    mocks.tx.mockImplementation(async (parts: TemplateStringsArray) => {
      const statement = parts.join('?');
      if (statement.includes('SELECT id, provider_uid FROM auth_identities')) {
        return Object.assign([{ id: 7, provider_uid: 'new@example.invalid' }], { count: 1 });
      }
      if (statement.includes('UPDATE auth_identities')) return [];
      throw new Error(`unexpected account statement: ${statement}`);
    });
    expect(await replaceCredentialIdentity(42, 'email', 'new@example.invalid')).toBe('ok');
    expect(mocks.tx.mock.calls.some(([parts]) => parts.join('?').includes('UPDATE auth_identities'))).toBe(true);
  });

  it.each([
    ['email', 'uq_auth_identity_one_email', 'has-email'],
    ['phone', 'uq_auth_identity_one_phone', 'has-phone'],
    ['email', 'uq_auth_identity', 'conflict'],
    ['wca', 'uq_app_users_wca', 'conflict'],
  ] as const)('classifies the known %s / %s uniqueness race as %s', async (provider, constraint, status) => {
    writeError = uniqueError(constraint);
    expect(await addIdentity(42, provider, 'new@example.invalid')).toBe(status);
  });

  it('propagates binding storage failures and unknown uniqueness constraints', async () => {
    await expect(addIdentity(42, 'email', 'new@example.invalid')).rejects.toBe(writeError);
    writeError = uniqueError('unrelated_unique_constraint');
    await expect(addIdentity(42, 'email', 'new@example.invalid')).rejects.toBe(writeError);
    writeError = new Error('uq_auth_identity_one_email appears in a non-unique storage error');
    await expect(addIdentity(42, 'email', 'new@example.invalid')).rejects.toBe(writeError);
  });

  it('classifies only the provider/UID uniqueness race on replacement', async () => {
    writeError = uniqueError('uq_auth_identity');
    expect(await replaceCredentialIdentity(42, 'email', 'new@example.invalid')).toBe('conflict');

    writeError = new Error('synthetic storage failure');
    await expect(replaceCredentialIdentity(42, 'email', 'new@example.invalid')).rejects.toBe(writeError);
    writeError = uniqueError('unrelated_unique_constraint');
    await expect(replaceCredentialIdentity(42, 'email', 'new@example.invalid')).rejects.toBe(writeError);
  });
});
