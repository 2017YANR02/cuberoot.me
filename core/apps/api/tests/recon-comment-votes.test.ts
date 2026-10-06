import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAuth: vi.fn(), optionalAuth: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', async (original) => ({
  ...await original<typeof import('../src/utils/recon_helpers.js')>(),
  requireAuth: mocks.requireAuth,
  optionalAuth: mocks.optionalAuth,
  checkRateLimit: vi.fn(),
}));
import { reconRoutes } from '../src/routes/recon.js';

const app = new Hono().route('/v1', reconRoutes);
const request = (vote: unknown, id = '10') => app.request(`/v1/recon/comments/${id}/vote`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote }),
});

describe('reconstruction comment votes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ uid: 7, wcaId: 'u7', isAdmin: false });
    mocks.optionalAuth.mockResolvedValue({ uid: 7, wcaId: 'u7', isAdmin: false });
  });
  it('rejects invalid states and comment ids before reading or writing votes', async () => {
    for (const value of ['heart', 1, undefined]) expect((await request(value)).status).toBe(400);
    expect((await request('like', '-1')).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('requires a resolved account and an existing comment', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: 'legacy' });
    expect((await request('like')).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.query.mockResolvedValueOnce([]);
    expect((await request('like')).status).toBe(404);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('does not allow voting on another user’s private reconstruction', async () => {
    mocks.query.mockResolvedValueOnce([{ recon_id: 1 }])
      .mockResolvedValueOnce([{ visibility: 'private', added_by_id: 'u8' }]);
    expect((await request('like')).status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it.each(['like', 'dislike', null])('sets %s for the authenticated account and returns authoritative counts', async (vote) => {
    mocks.query.mockResolvedValueOnce([{ recon_id: 1 }])
      .mockResolvedValueOnce([{ visibility: 'public' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ like_count: '12', my_vote: vote }]);
    const response = await request(vote);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ likeCount: 12, myVote: vote });
    const [sql, params] = mocks.query.mock.calls[2];
    expect(sql).toContain(vote === null ? 'DELETE FROM recon_comment_votes' : 'ON CONFLICT (comment_id, user_id)');
    expect(params).toEqual(vote === null ? [10, 7] : [10, 7, vote]);
  });
});
