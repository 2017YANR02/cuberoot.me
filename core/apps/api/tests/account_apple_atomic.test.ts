import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), begin: vi.fn(), tx: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, sql: { begin: mocks.begin } }));
vi.mock('../src/utils/apple_login.js', () => ({ revokeAppleIdentities: vi.fn() }));
import { addIdentity, loginWithIdentity, type AppleIdentityCredential, type AppUser } from '../src/utils/account.js';

type Identity = { userId: number; provider: string; sub: string; token: Buffer | null; keyVersion: number | null };
let users: AppUser[];
let identities: Identity[];
let mergedAccounts: Set<number>;
let failWrite: boolean;
let beforeTransaction: (() => void) | null;
let transactionTail: Promise<unknown>;
const credential = (byte: number): AppleIdentityCredential => ({ encryptedToken: Buffer.alloc(48, byte), keyVersion: 1 });
const user = (id: number): AppUser => ({ id, display_name: '', avatar_url: null, avatar_source: 'auto', avatar_preset: null, wca_id: null, is_admin: false });
const link = (uid: number, token: AppleIdentityCredential) => addIdentity(uid, 'apple', 'sub', undefined, undefined, undefined, undefined, token);

beforeEach(() => {
  vi.clearAllMocks();
  users = []; identities = []; mergedAccounts = new Set(); failWrite = false; beforeTransaction = null; transactionTail = Promise.resolve();
  mocks.query.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes('FROM auth_identities i')) {
      const identity = identities.find((entry) => entry.provider === values[0] && entry.sub === values[1]);
      return users.filter((entry) => entry.id === identity?.userId);
    }
    if (sql.includes('FROM app_users requested')) return users.filter((entry) => entry.id === values[0]);
    throw new Error(`Unexpected nontransaction query: ${sql}`);
  });
  mocks.tx.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join('?');
    if (sql.includes('SELECT id FROM app_users')) return users.filter((entry) => entry.id === values[0]
      && (!sql.includes('merged_into_user_id IS NULL') || !mergedAccounts.has(entry.id)));
    if (sql.includes('INSERT INTO app_users')) {
      const added = user(users.length + 1);
      users.push(added); return [added];
    }
    if (sql.includes('INSERT INTO auth_identities')) {
      if (failWrite) throw new Error('simulated credential storage failure');
      if (identities.some((entry) => entry.provider === values[1] && entry.sub === values[2])) {
        throw Object.assign(new Error('duplicate identity'), { code: '23505' });
      }
      identities.push({ userId: Number(values[0]), provider: String(values[1]), sub: String(values[2]),
        token: values[3] as Buffer | null, keyVersion: values[4] as number | null });
      return [];
    }
    if (sql.includes('UPDATE auth_identities')) {
      if (failWrite) throw new Error('simulated credential storage failure');
      const index = identities.findIndex((entry) => entry.userId === values[2] && entry.provider === 'apple' && entry.sub === values[3]);
      if (index === -1) return [];
      identities[index] = { ...identities[index], token: values[0] as Buffer, keyVersion: values[1] as number };
      return [{ id: index + 1 }];
    }
    throw new Error(`Unexpected transaction query: ${sql}`);
  });
  // Model the DB transaction boundary and uniqueness serialization; real SQL fixture separately
  // verifies PG constraints/rollback. This test fails if a credential is written after identity commit.
  mocks.begin.mockImplementation((run) => {
    const operation = transactionTail.then(async () => {
      beforeTransaction?.(); beforeTransaction = null;
      const snapshot = { users: [...users], identities: [...identities] };
      try { return await run(mocks.tx); }
      catch (error) { users = snapshot.users; identities = snapshot.identities; throw error; }
    });
    transactionTail = operation.catch(() => undefined);
    return operation;
  });
});

describe('atomic Apple identity and revocation credential', () => {
  it('stores a new user, identity and encrypted token in one transaction', async () => {
    const token = credential(1);
    const result = await loginWithIdentity('apple', 'sub', { name: '' }, token);
    expect(result.isNew).toBe(true);
    expect(mocks.begin).toHaveBeenCalledOnce();
    expect(identities).toEqual([{ userId: 1, provider: 'apple', sub: 'sub', token: token.encryptedToken, keyVersion: 1 }]);
  });
  it('rolls back both new user and identity when the token write fails', async () => {
    failWrite = true;
    await expect(loginWithIdentity('apple', 'sub', { name: '' }, credential(1))).rejects.toThrow();
    expect(users).toEqual([]);
    expect(identities).toEqual([]);
  });
  it('rolls back a new binding if its credential write fails', async () => {
    users = [user(42)]; failWrite = true;
    await expect(link(42, credential(1))).rejects.toThrow('storage failure');
    expect(users).toEqual([user(42)]);
    expect(identities).toEqual([]);
  });
  it('resolves concurrent first logins to one identity with a persisted credential', async () => {
    const [first, second] = await Promise.all([
      loginWithIdentity('apple', 'sub', { name: '' }, credential(1)),
      loginWithIdentity('apple', 'sub', { name: '' }, credential(2)),
    ]);
    expect(first.user.id).toBe(second.user.id);
    expect([first.isNew, second.isNew]).toEqual([true, false]);
    expect(users).toHaveLength(1); expect(identities).toHaveLength(1);
    expect(identities[0].token).toEqual(credential(2).encryptedToken);
  });
  it('resolves concurrent bindings without exposing an intermediate credential-less identity', async () => {
    users = [user(42)];
    expect(await Promise.all([link(42, credential(1)), link(42, credential(2))])).toEqual(['ok', 'ok']);
    expect(identities).toHaveLength(1);
    expect(identities[0].token).toEqual(credential(2).encryptedToken);
    const statements = mocks.tx.mock.calls.map(([parts]) => parts.join('?'));
    expect(statements[0]).toContain('SELECT id FROM app_users');
  });
  it('rejects a refresh when merge/unlink changed identity ownership before the account lock', async () => {
    users = [user(42), user(99)];
    identities = [{ userId: 42, provider: 'apple', sub: 'sub', token: credential(1).encryptedToken, keyVersion: 1 }];
    beforeTransaction = () => { identities[0] = { ...identities[0], userId: 99 }; };
    await expect(loginWithIdentity('apple', 'sub', { name: '' }, credential(2))).rejects.toThrow('identity changed');
    expect(identities[0].userId).toBe(99);
    expect(identities[0].token).toEqual(credential(1).encryptedToken);
  });
  it('rejects a new binding if merge committed after authentication but before the account lock', async () => {
    users = [user(42), user(99)];
    // Account 42 remains as a tombstone; it must not receive an identity or silently target 99.
    beforeTransaction = () => { mergedAccounts.add(42); };
    await expect(link(42, credential(1))).rejects.toThrow('Account changed; sign in again');
    expect(identities).toEqual([]);
    expect(users).toHaveLength(2);
    expect(mocks.tx.mock.calls.some(([parts]) => parts.join('?').includes('INSERT INTO auth_identities'))).toBe(false);
  });
  it('requires an encrypted credential for Apple and refuses cross-provider token use', async () => {
    await expect(loginWithIdentity('apple', 'sub', { name: '' })).rejects.toThrow('requires an encrypted');
    await expect(loginWithIdentity('google', 'sub', { name: '' }, credential(1))).rejects.toThrow('another provider');
    expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.begin).not.toHaveBeenCalled();
  });
});
