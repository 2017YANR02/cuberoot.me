import { beforeEach, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

const mocks = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), profile: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: mocks.auth, ADMIN_WCA_IDS: [] }));
vi.mock('../src/utils/notify.js', () => ({ notify: vi.fn(), adminRecipients: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({
  publicUserIdsForOwnerKeys: async () => new Map(), getAccountBasicProfile: mocks.profile,
}));
import { forumRoutes } from '../src/routes/forum.js';

const row = {
  id: '12', title: 'My pending thread', author_id: 'u7', author_name: 'Me',
  created_at: new Date('2026-10-01'), last_post_at: new Date('2026-11-01'),
  last_post_author_id: 'u7', last_post_author_name: 'Me',
  reply_count: 1, view_count: 0, is_pinned: false, is_locked: false, status: 'pending', post_total: 3,
  forum_slug: 'general', forum_name_en: 'General', forum_name_zh: '综合讨论',
  first_post_id: '21', first_post_content: 'My private draft',
  own_post_id: '21', own_post_status: 'pending', own_post_no: 1,
};

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ uid: 7, wcaId: 'u7', name: 'Me', isAdmin: false });
  mocks.profile.mockReset().mockResolvedValue({ forumBanned: false });
  mocks.query.mockReset().mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT COUNT(*)::int AS n FROM forum_threads')) return [{ n: 1 }];
    if (sql.includes('AS own_post_id')) return [row];
    return [];
  });
});

it('requires authentication before querying personal content', async () => {
  mocks.auth.mockRejectedValue(new HTTPException(401));
  const response = await forumRoutes.request('/forum/mine');
  expect(response.status).toBe(401);
  expect(mocks.query).not.toHaveBeenCalled();
});

it('binds the authenticated owner, includes private states and applies stable pagination', async () => {
  const response = await forumRoutes.request('/forum/mine?authorId=u99&page=2&size=10');
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  const [count, list] = mocks.query.mock.calls;
  expect(count[1]).toEqual(['u7']);
  expect(list[1]).toEqual(['u7', 10, 10]);
  expect(list[0]).toContain('WHERE NOT t.is_deleted AND NOT fp.is_deleted AND t.author_id = ?');
  expect(list[0]).toContain('ORDER BY t.created_at DESC, t.id DESC');
  expect(await response.json()).toMatchObject({ kind: 'threads', total: 1, page: 2,
    threads: [{ excerpt: 'My private draft', status: 'pending', personalPost: { id: 21, postNo: 1, status: 'pending', canManage: true } }],
  });
});

it('groups replies by thread without exposing other owners’ private threads, even for admins', async () => {
  mocks.auth.mockResolvedValue({ uid: 7, wcaId: 'u7', isAdmin: true });
  await forumRoutes.request('/forum/mine?kind=replies&authorId=u99');
  const [count, list] = mocks.query.mock.calls;
  expect(count[1]).toEqual(['u7', 'u7', 'u7']);
  expect(list[1]).toEqual(['u7', 'u7', 'u7', 20, 0]);
  expect(list[0]).toContain('p.author_id = ? AND p.id <> fp.id AND NOT p.is_deleted');
  expect(list[0]).toContain('ORDER BY p.created_at DESC, p.id DESC LIMIT 1');
  expect(list[0]).toContain("(t.status = 'approved' OR t.author_id = ?)");
  expect(list[0]).toContain("(fp.status = 'approved' OR t.author_id = ?)");
  expect(list[0]).toContain('p.id <= mp.id');
});

it('disables management for banned owners and ordinary owners of locked threads', async () => {
  mocks.profile.mockResolvedValue({ forumBanned: true });
  expect((await (await forumRoutes.request('/forum/mine')).json()).threads[0].personalPost.canManage).toBe(false);
  mocks.profile.mockResolvedValue({ forumBanned: false });
  mocks.query.mockImplementation(async (sql: string) => sql.includes('AS own_post_id') ? [{ ...row, is_locked: true }]
    : sql.startsWith('SELECT COUNT(*)::int AS n FROM forum_threads') ? [{ n: 1 }] : []);
  expect((await (await forumRoutes.request('/forum/mine')).json()).threads[0].personalPost.canManage).toBe(false);
});

it('rejects invalid filters and caps page size', async () => {
  expect((await forumRoutes.request('/forum/mine?kind=all')).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
  await forumRoutes.request('/forum/mine?size=999');
  expect(mocks.query.mock.calls[1][1]).toEqual(['u7', 50, 0]);
});
