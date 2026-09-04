import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAuthMock, findUserByWcaIdMock, getUserByIdMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findUserByWcaIdMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));

vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: requireAuthMock }));
vi.mock('../src/utils/account.js', () => ({
  findUserByWcaId: findUserByWcaIdMock,
  getUserById: getUserByIdMock,
}));

import { requireAppUserId } from '../src/utils/app_user_auth.js';

describe('canonical app user authentication', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    findUserByWcaIdMock.mockReset();
    getUserByIdMock.mockReset();
    getUserByIdMock.mockImplementation(async (id: number) => ({ id }));
  });

  it('uses the internal uid embedded in current sessions', async () => {
    requireAuthMock.mockResolvedValue({ uid: 42, realWcaId: '2020TEST01' });

    await expect(requireAppUserId({} as never)).resolves.toBe(42);
    expect(findUserByWcaIdMock).not.toHaveBeenCalled();
  });

  it('normalizes a legacy BIGINT string uid before relationship comparisons', async () => {
    requireAuthMock.mockResolvedValue({ uid: '66', realWcaId: '2017YANR02' });

    await expect(requireAppUserId({} as never)).resolves.toBe(66);
    expect(findUserByWcaIdMock).not.toHaveBeenCalled();
  });

  it('falls back to the linked WCA identity when a session uid is invalid', async () => {
    requireAuthMock.mockResolvedValue({ uid: 'not-a-user-id', realWcaId: '2020TEST01' });
    findUserByWcaIdMock.mockResolvedValue({ id: 73 });

    await expect(requireAppUserId({} as never)).resolves.toBe(73);
    expect(findUserByWcaIdMock).toHaveBeenCalledWith('2020TEST01');
  });

  it('resolves legacy WCA-only sessions to app_users.id', async () => {
    requireAuthMock.mockResolvedValue({ realWcaId: '2020TEST01' });
    findUserByWcaIdMock.mockResolvedValue({ id: 73 });

    await expect(requireAppUserId({} as never)).resolves.toBe(73);
    expect(findUserByWcaIdMock).toHaveBeenCalledWith('2020TEST01');
  });

  it('falls back to the surviving WCA account when a merged session uid was deleted', async () => {
    requireAuthMock.mockResolvedValue({ uid: 749, realWcaId: '2020TEST01' });
    getUserByIdMock.mockResolvedValue(null);
    findUserByWcaIdMock.mockResolvedValue({ id: 748 });

    await expect(requireAppUserId({} as never)).resolves.toBe(748);
    expect(findUserByWcaIdMock).toHaveBeenCalledWith('2020TEST01');
  });

  it('rejects a merged session whose deleted uid has no surviving identity in the token', async () => {
    requireAuthMock.mockResolvedValue({ uid: 749 });
    getUserByIdMock.mockResolvedValue(null);

    await expect(requireAppUserId({} as never)).rejects.toThrow('Authentication required');
  });

  it('rejects sessions that cannot resolve to a canonical account', async () => {
    requireAuthMock.mockResolvedValue({ realWcaId: '2020TEST01' });
    findUserByWcaIdMock.mockResolvedValue(null);

    await expect(requireAppUserId({} as never)).rejects.toThrow('Authentication required');
  });
});
