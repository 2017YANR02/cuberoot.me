import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/connection.js', () => ({ query: queryMock }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: vi.fn(),
  authenticateUser: vi.fn(),
  checkRateLimit: vi.fn(),
  ADMIN_WCA_IDS: ['2017TEST01'],
}));
vi.mock('../src/utils/notify.js', () => ({ notify: vi.fn(), adminRecipients: vi.fn() }));

import { forumRoutes } from '../src/routes/forum.js';

const threadRow = {
  id: '12',
  title: 'Feed test',
  author_id: '2017TEST01',
  author_name: 'Test User',
  created_at: new Date('2026-08-20T00:00:00.000Z'),
  reply_count: 2,
  view_count: 9,
  last_post_at: new Date('2026-08-20T01:00:00.000Z'),
  last_post_author_id: '2018TEST02',
  last_post_author_name: 'Reply User',
  is_pinned: false,
  is_locked: false,
  status: 'approved',
  post_total: 3,
  forum_slug: 'general',
  forum_name_en: 'General',
  forum_name_zh: '综合讨论',
  first_post_id: '21',
  first_post_content: '# Hello\n\nA **useful** [discussion](https://example.com).\n\n![turn](https://img.example/turn.webp)',
};

describe('forum activity feed', () => {
  beforeEach(() => queryMock.mockReset());

  it('returns first-post excerpts, reactions, and canonical author profiles', async () => {
    queryMock
      .mockResolvedValueOnce([{ n: 1 }])
      .mockResolvedValueOnce([threadRow])
      .mockResolvedValueOnce([
        { post_id: '21', kind: 'like', author_name: 'A' },
        { post_id: '21', kind: 'like', author_name: 'B' },
      ])
      .mockResolvedValueOnce([{
        id: '31', post_id: '21', public_token: '11111111-1111-4111-8111-111111111111',
        storage_key: 'clip.mp4', mime: 'video/mp4', size_bytes: '1234', duration_ms: '19000',
      }])
      .mockResolvedValueOnce([{ author_id: '2017TEST01', n: 7 }])
      .mockResolvedValueOnce([{
        id: '66',
        wca_id: '2017TEST01',
        avatar_url: 'https://example.com/avatar.png',
        created_at: new Date('2020-01-02T00:00:00.000Z'),
        display_name: 'Canonical User',
      }])
      .mockResolvedValueOnce([
        { id: '66', wca_id: '2017TEST01' },
        { id: '77', wca_id: '2018TEST02' },
      ]);

    const response = await forumRoutes.request('/forum/feed?sort=active&page=2&size=10');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');
    expect(queryMock.mock.calls[0][0]).toContain('AND EXISTS');
    expect(queryMock.mock.calls[1][0]).toContain('ORDER BY t.last_post_at DESC, t.id DESC');
    expect(queryMock.mock.calls[1][1]).toEqual([10, 10]);
    expect(body).toMatchObject({
      total: 1,
      page: 2,
      size: 10,
      sort: 'active',
      threads: [{
        id: 12,
        authorUserId: 66,
        lastPostAuthorUserId: 77,
        firstPostId: 21,
        forumSlug: 'general',
        excerpt: 'Hello A useful discussion.',
        imageUrls: ['https://img.example/turn.webp'],
        videos: [{
          id: 31,
          token: '11111111-1111-4111-8111-111111111111',
          mime: 'video/mp4',
          sizeBytes: 1234,
          durationMs: 19000,
        }],
        reactions: [{ kind: 'like', count: 2, names: ['A', 'B'] }],
        author: {
          name: 'Canonical User',
          avatarUrl: 'https://example.com/avatar.png',
          postCount: 7,
          wcaId: '2017TEST01',
          userId: 66,
          isAdmin: true,
        },
      }],
    });
  });

  it('orders the latest view by thread creation time', async () => {
    queryMock.mockResolvedValueOnce([{ n: 0 }]).mockResolvedValueOnce([]);

    const response = await forumRoutes.request('/forum/feed?sort=latest');

    expect(response.status).toBe(200);
    expect(queryMock.mock.calls[1][0]).toContain('ORDER BY t.created_at DESC, t.id DESC');
    expect(await response.json()).toMatchObject({ threads: [], total: 0, sort: 'latest' });
  });

  it('rejects unsupported sort modes before querying', async () => {
    const response = await forumRoutes.request('/forum/feed?sort=popular');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'sort must be active or latest' });
    expect(queryMock).not.toHaveBeenCalled();
  });
});
