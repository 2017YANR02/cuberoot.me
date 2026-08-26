import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeWebSessionError,
  decodeWebSession,
  decodeWebSessionUserEnvelope,
} from '@cuberoot/shared/auth/web-session';

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
const publicAccount = {
  uid: 66,
  wcaId: '2017YANR02',
  name: '颜瑞民',
  avatar: '',
  avatarSource: 'auto' as const,
  avatarPreset: null,
};

describe('auth public user ID', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.findUserByWcaId.mockResolvedValue(account);
    mocks.getUserById.mockResolvedValue(account);
    mocks.publicUser.mockReturnValue(publicAccount);
    mocks.signSession.mockReturnValue('u'.repeat(20));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a legacy WCA-only /auth/me session to its numeric account ID', async () => {
    mocks.verifySession.mockReturnValue({ wcaId: '2017YANR02', name: '颜瑞民' });

    const response = await authRoutes.request('/auth/me', {
      headers: { Authorization: 'Bearer legacy-token' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ user: publicAccount });
    expect(decodeWebSessionUserEnvelope(body)).toEqual(body);
    expect(mocks.findUserByWcaId).toHaveBeenCalledWith('2017YANR02');
  });

  it('returns the canonical user together with a refreshed legacy token', async () => {
    mocks.verifySession.mockReturnValue({ wcaId: '2017YANR02', name: '颜瑞民' });

    const response = await authRoutes.request('/auth/refresh', {
      method: 'POST',
      headers: { Authorization: 'Bearer legacy-token' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ token: 'u'.repeat(20), user: publicAccount });
    expect(decodeWebSession(body)).toEqual(body);
    expect(mocks.getUserById).toHaveBeenCalledWith(66);
    expect(mocks.signSession).toHaveBeenCalledWith({
      uid: 66, wcaId: '2017YANR02', name: '颜瑞民',
    });
  });

  it('executes /auth/exchange and returns the canonical account session for a valid WCA token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      me: {
        id: 123,
        wca_id: '2017YANR02',
        name: 'Provisional WCA Name',
        avatar: { url: 'wca-avatar.png' },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    mocks.loginWithIdentity.mockResolvedValue({ user: account, isNew: false });

    const response = await authRoutes.request('/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'valid-wca-token' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ token: 'u'.repeat(20), user: publicAccount });
    expect(decodeWebSession(body)).toEqual(body);
    expect(mocks.loginWithIdentity).toHaveBeenCalledWith('wca', '2017YANR02', {
      name: 'Provisional WCA Name',
      avatar: 'wca-avatar.png',
      wcaId: '2017YANR02',
    });
    expect(mocks.signSession).toHaveBeenCalledWith({
      uid: 66,
      wcaId: '2017YANR02',
      name: '颜瑞民',
    });
  });

  it('rejects an invalid WCA token through the real /auth/exchange route', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await authRoutes.request('/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'expired-wca-token' }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      code: 'INVALID_WCA_TOKEN',
      message: 'Invalid or expired WCA token',
      error: 'Invalid or expired WCA token',
    });
    expect(decodeWebSessionError(body)).toEqual(body);
    expect(mocks.loginWithIdentity).not.toHaveBeenCalled();
    expect(mocks.signSession).not.toHaveBeenCalled();
  });

  it('rejects a missing WCA token without calling the upstream API', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const response = await authRoutes.request('/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      code: 'INVALID_REQUEST',
      message: 'accessToken is required',
      error: 'accessToken is required',
    });
    expect(decodeWebSessionError(body)).toEqual(body);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{'],
    ['null JSON', 'null'],
    ['a non-string access token', JSON.stringify({ accessToken: 123 })],
  ])('rejects %s through the stable invalid-request contract', async (_label, requestBody) => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const response = await authRoutes.request('/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: 'accessToken is required',
      error: 'accessToken is required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns stable compatible errors for missing /auth/me and /auth/refresh sessions', async () => {
    const meResponse = await authRoutes.request('/auth/me');
    const refreshResponse = await authRoutes.request('/auth/refresh', { method: 'POST' });

    expect(meResponse.status).toBe(401);
    expect(await meResponse.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'No token provided',
      error: 'No token provided',
    });
    expect(refreshResponse.status).toBe(401);
    expect(await refreshResponse.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'unauthorized',
      error: 'unauthorized',
    });
  });
});
