import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAuthMock, findUserByWcaIdMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findUserByWcaIdMock: vi.fn(),
}));

vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: requireAuthMock }));
vi.mock('../src/utils/account.js', () => ({ findUserByWcaId: findUserByWcaIdMock }));

import { requireAppUserId } from '../src/utils/app_user_auth.js';

describe('canonical app user authentication', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    findUserByWcaIdMock.mockReset();
  });

  it('uses the internal uid embedded in current sessions', async () => {
    requireAuthMock.mockResolvedValue({ uid: 42, realWcaId: '2020TEST01' });

    await expect(requireAppUserId({} as never)).resolves.toBe(42);
    expect(findUserByWcaIdMock).not.toHaveBeenCalled();
  });

  it('resolves legacy WCA-only sessions to app_users.id', async () => {
    requireAuthMock.mockResolvedValue({ realWcaId: '2020TEST01' });
    findUserByWcaIdMock.mockResolvedValue({ id: 73 });

    await expect(requireAppUserId({} as never)).resolves.toBe(73);
    expect(findUserByWcaIdMock).toHaveBeenCalledWith('2020TEST01');
  });

  it('rejects sessions that cannot resolve to a canonical account', async () => {
    requireAuthMock.mockResolvedValue({ realWcaId: '2020TEST01' });
    findUserByWcaIdMock.mockResolvedValue(null);

    await expect(requireAppUserId({} as never)).rejects.toThrow('Authentication required');
  });
});
