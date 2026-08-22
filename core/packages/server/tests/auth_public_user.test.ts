import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  verifySession: vi.fn(),
  signSession: vi.fn(),
  loginWithIdentity: vi.fn(),
  findUserByWcaId: vi.fn(),
  getUserById: vi.fn(),
  publicUser: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/session.js', () => ({
  verifySession: mocks.verifySession,
  signSession: mocks.signSession,
}));
vi.mock('../src/utils/account.js', () => ({
  loginWithIdentity: mocks.loginWithIdentity,
  findUserByWcaId: mocks.findUserByWcaId,
  getUserById: mocks.getUserById,
  publicUser: mocks.publicUser,
}));

import { authRoutes } from '../src/routes/auth.js';

const account = {
  id: 66,
  wca_id: '2017YANR02',
  display_name: '颜瑞民',
  avatar_url: null,
};
const publicAccount = { uid: 66, wcaId: '2017YANR02', name: '颜瑞民', avatar: '' };

describe('auth public user ID', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.findUserByWcaId.mockResolvedValue(account);
    mocks.getUserById.mockResolvedValue(account);
    mocks.publicUser.mockReturnValue(publicAccount);
    mocks.signSession.mockReturnValue('upgraded-token');
  });

  it('resolves a legacy WCA-only /auth/me session to its numeric account ID', async () => {
    mocks.verifySession.mockReturnValue({ wcaId: '2017YANR02', name: '颜瑞民' });

    const response = await authRoutes.request('/auth/me', {
      headers: { Authorization: 'Bearer legacy-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: publicAccount });
    expect(mocks.findUserByWcaId).toHaveBeenCalledWith('2017YANR02');
  });

  it('returns the canonical user together with a refreshed legacy token', async () => {
    mocks.verifySession.mockReturnValue({ wcaId: '2017YANR02', name: '颜瑞民' });

    const response = await authRoutes.request('/auth/refresh', {
      method: 'POST',
      headers: { Authorization: 'Bearer legacy-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: 'upgraded-token', user: publicAccount });
    expect(mocks.getUserById).toHaveBeenCalledWith(66);
    expect(mocks.signSession).toHaveBeenCalledWith({
      uid: 66, wcaId: '2017YANR02', name: '颜瑞民',
    });
  });
});
