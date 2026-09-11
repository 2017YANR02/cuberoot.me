import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, requireAdminOrApiKeyMock, notifyMock, requireAuthMock, profileMock, findUserMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  requireAuthMock: vi.fn(),
  profileMock: vi.fn(),
  findUserMock: vi.fn(),
  requireAdminOrApiKeyMock: vi.fn(),
  notifyMock: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: queryMock }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: requireAuthMock,
  requireAdminOrApiKey: requireAdminOrApiKeyMock,
  authenticateUser: vi.fn(),
  checkRateLimit: vi.fn(),
  ADMIN_WCA_IDS: ['2017TEST01'],
}));
vi.mock('../src/utils/notify.js', () => ({
  notify: notifyMock,
  adminRecipients: vi.fn(() => []),
}));

vi.mock('../src/utils/account.js', () => ({
  publicUserIdsForOwnerKeys: vi.fn(),
  getAccountBasicProfile: profileMock,
  findUserByWcaId: findUserMock,
}));

const completeProfile = { fullName: 'Test User', birthDate: '2000-01-01', gender: 'male', countryIso2: 'CN', regionCode: 'GD', cityName: 'Shenzhen', countrySource: 'self' };

import { forumRoutes } from '../src/routes/forum.js';
forumRoutes.onError((error, c) => c.json({ error: error.message }, error.message === 'Admin access required' ? 403 : 500));

describe('forum API reply', () => {
  beforeEach(() => {
    queryMock.mockReset();
    requireAdminOrApiKeyMock.mockReset();
    notifyMock.mockReset();
    requireAuthMock.mockReset().mockResolvedValue({ uid: 7, wcaId: 'u7', name: 'Test User', isAdmin: false });
    profileMock.mockReset().mockResolvedValue(completeProfile);
    findUserMock.mockReset().mockResolvedValue({ id: 7 });
  });

  it.each(['fullName', 'birthDate', 'gender', 'countryIso2', 'regionCode', 'cityName'])('rejects a reply missing %s before any forum write', async (field) => {
    profileMock.mockResolvedValue({ ...completeProfile, [field]: null });
    const response = await forumRoutes.request('/forum/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 43, content: 'Reply', profile: completeProfile, forumProfileExempt: true }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'FORUM_PROFILE_INCOMPLETE', code: 'FORUM_PROFILE_INCOMPLETE' });
    expect(queryMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(profileMock).toHaveBeenCalledWith(7);
  });

  it('does not exempt administrators or trust a stale session profile', async () => {
    requireAuthMock.mockResolvedValue({ uid: 7, wcaId: 'u7', name: 'Admin', isAdmin: true, profile: completeProfile });
    profileMock.mockResolvedValue(null);
    const response = await forumRoutes.request('/forum/posts', { method: 'POST' });
    expect(response.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('blocks incomplete API-key authors', async () => {
    requireAdminOrApiKeyMock.mockResolvedValue({ wcaId: '__api_key__' });
    queryMock.mockResolvedValueOnce([{ display_name: 'Admin' }]);
    profileMock.mockResolvedValue({ ...completeProfile, fullName: null });
    const response = await forumRoutes.request('/forum/posts', { method: 'POST', headers: { 'X-Admin-Key': 'secret' } });
    expect(response.status).toBe(403);
    expect(findUserMock).toHaveBeenCalledWith('2017TEST01');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['POST', '/forum/threads'], ['POST', '/forum/posts'], ['PATCH', '/forum/posts/44'],
    ['PATCH', '/forum/threads/43'], ['POST', '/forum/video'], ['POST', '/forum/posts/44/react'],
  ])('blocks banned accounts through %s %s, including earlier contributors', async (method, path) => {
    profileMock.mockResolvedValue({ ...completeProfile, forumBanned: true, forumProfileExempt: true });
    const response = await forumRoutes.request(path, { method });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'FORUM_BANNED' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('requires administrator authorization before changing bans', async () => {
    requireAdminOrApiKeyMock.mockRejectedValue(new Error('Admin access required'));
    const response = await forumRoutes.request('/forum/users/7/ban', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banned: true }),
    });
    expect(response.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it.each([true, false])('sets the ban to %s without deleting forum content', async (banned) => {
    queryMock.mockResolvedValue([{ id: '7', forum_banned: banned }]);
    const response = await forumRoutes.request('/forum/users/7/ban', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banned }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, banned });
    expect(queryMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls[0][1]).toEqual([banned, 7, '2017TEST01']);
    expect(queryMock.mock.calls[0][0]).toContain('AND NOT is_admin');
    expect(queryMock.mock.calls[0][0]).toContain('merged_into_user_id IS NULL');
  });

  it('does not report success when the account is protected or missing', async () => {
    queryMock.mockResolvedValue([]);
    const response = await forumRoutes.request('/forum/users/7/ban', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banned: true }),
    });
    expect(response.status).toBe(404);
  });

  it('allows an earlier contributor with an incomplete profile', async () => {
    profileMock.mockResolvedValue({ ...completeProfile, fullName: null, birthDate: null, forumProfileExempt: true });
    queryMock.mockResolvedValueOnce([{ is_locked: false, is_deleted: false, title: 'Thread', author_id: 'u8', status: 'approved' }])
      .mockResolvedValueOnce([{ id: '44' }]).mockResolvedValueOnce([{ n: 2 }]);
    const response = await forumRoutes.request('/forum/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 43, content: 'Reply' }),
    });
    expect(response.status).toBe(200);
  });

  it('allows a complete ordinary account and rechecks the next request', async () => {
    queryMock.mockResolvedValueOnce([{ is_locked: false, is_deleted: false, title: 'Thread', author_id: 'u8', status: 'approved' }])
      .mockResolvedValueOnce([{ id: '44' }]).mockResolvedValueOnce([{ n: 2 }]);
    const request = () => forumRoutes.request('/forum/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 43, content: 'Reply' }),
    });
    expect((await request()).status).toBe(200);
    profileMock.mockResolvedValue({ ...completeProfile, fullName: null });
    expect((await request()).status).toBe(403);
    expect(profileMock).toHaveBeenCalledTimes(2);
  });

  it('publishes an API-key reply as the real administrator account', async () => {
    requireAdminOrApiKeyMock.mockResolvedValue({ wcaId: '__api_key__', name: 'API Key' });
    queryMock
      .mockResolvedValueOnce([{ display_name: 'Test Admin' }])
      .mockResolvedValueOnce([{
        is_locked: false,
        is_deleted: false,
        title: 'Bug report',
        author_id: '2020USER01',
        status: 'approved',
      }])
      .mockResolvedValueOnce([{ id: '44' }])
      .mockResolvedValueOnce([{ n: 2 }]);

    const response = await forumRoutes.request('/forum/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'secret' },
      body: JSON.stringify({ threadId: 43, content: 'Fixed and deployed.' }),
    });

    expect(response.status).toBe(200);
    expect(requireAdminOrApiKeyMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls[2][1]).toEqual([
      43, '2017TEST01', 'Test Admin', 'Fixed and deployed.',
      '2017TEST01', 'Test Admin', 43,
    ]);
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'forum_reply',
      actorKey: '2017TEST01',
      recipients: ['2020USER01'],
    }));
    expect(await response.json()).toEqual({ ok: true, id: 44, postNo: 2, status: 'approved' });
  });
});
