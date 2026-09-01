import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, requireAdminOrApiKeyMock, notifyMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  requireAdminOrApiKeyMock: vi.fn(),
  notifyMock: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: queryMock }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: vi.fn(),
  requireAdminOrApiKey: requireAdminOrApiKeyMock,
  authenticateUser: vi.fn(),
  checkRateLimit: vi.fn(),
  ADMIN_WCA_IDS: ['2017TEST01'],
}));
vi.mock('../src/utils/notify.js', () => ({
  notify: notifyMock,
  adminRecipients: vi.fn(() => []),
}));

import { forumRoutes } from '../src/routes/forum.js';

describe('forum API reply', () => {
  beforeEach(() => {
    queryMock.mockReset();
    requireAdminOrApiKeyMock.mockReset();
    notifyMock.mockReset();
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
