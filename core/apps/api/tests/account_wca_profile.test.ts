import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, sql: {} }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'fixture-only' }));
vi.mock('../src/utils/apple_login.js', () => ({ revokeAppleIdentities: vi.fn() }));
import { getAccountBasicProfile, normalizeWcaBasicProfile } from '../src/utils/account.js';
beforeEach(() => vi.clearAllMocks());

describe('WCA basic profile import', () => {
  it('maps every public WCA gender', () => {
    expect(['m', 'f', 'o'].map(gender => normalizeWcaBasicProfile({ gender }).gender)).toEqual(['male', 'female', 'other']);
  });
  it('ignores birthday data even if an older token returns it', () => {
    const me = { gender: 'm', dob: '2000-02-29' };
    expect(normalizeWcaBasicProfile(me)).toEqual({ gender: 'male' });
    expect(normalizeWcaBasicProfile({ gender: 'unknown' })).toEqual({ gender: null });
  });
  it('fills missing gender for an existing WCA account without replacing manually saved data', async () => {
    const base = { wcaId: '2017TEST01', birthDate: '2000-01-01', gender: null, wcaGender: 'f' };
    mocks.query.mockResolvedValueOnce([base]);
    expect(await getAccountBasicProfile(42)).toMatchObject({ birthDate: '2000-01-01', gender: 'female', genderSource: 'wca' });
    mocks.query.mockResolvedValueOnce([{ ...base, gender: 'undisclosed' }]);
    expect(await getAccountBasicProfile(42)).toMatchObject({ gender: 'undisclosed', genderSource: 'self' });
    mocks.query.mockResolvedValueOnce([{ ...base, wcaId: null, wcaGender: null }]);
    expect(await getAccountBasicProfile(42)).toMatchObject({ gender: null, genderSource: 'self' });
  });
});
