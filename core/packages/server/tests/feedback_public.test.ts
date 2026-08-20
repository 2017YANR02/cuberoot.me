import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  optionalAuth: vi.fn(),
  sendBark: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: mocks.requireAuth,
  requireAdmin: mocks.requireAdmin,
  optionalAuth: mocks.optionalAuth,
  checkRateLimit: vi.fn(),
  ADMIN_WCA_IDS: ['2017ADMIN01'],
}));
vi.mock('../src/monitors/bark.js', () => ({ sendBark: mocks.sendBark }));

import { feedbackRoutes } from '../src/routes/feedback.js';

const publicRow = {
  id: '42',
  kind: 'bug',
  body: 'Public feedback body',
  wca_id: '2017OWNER01',
  wca_name: 'Owner Name',
  contact: 'private@example.com',
  page_url: 'https://private.example/path',
  lang: 'zh',
  theme: 'dark',
  viewport: '390x844',
  user_agent: 'private browser details',
  status: 'new',
  created_at: new Date('2026-08-20T00:00:00.000Z'),
  updated_at: new Date('2026-08-20T01:00:00.000Z'),
  last_reply_at: new Date('2026-08-20T01:00:00.000Z'),
  last_reply_role: 'user',
};

describe('public feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.optionalAuth.mockResolvedValue(null);
  });

  it('lists every feedback item without exposing private diagnostics', async () => {
    mocks.query
      .mockResolvedValueOnce([{ n: '1' }])
      .mockResolvedValueOnce([publicRow])
      .mockResolvedValueOnce([{
        id: '7', feedback_id: '42', kind: 'image', mime: 'image/webp', size_bytes: 123,
        width: 390, height: 844, duration_ms: null,
      }])
      .mockResolvedValueOnce([{ feedback_id: '42', n: '2' }]);

    const response = await feedbackRoutes.request('/feedback/public?page=2&size=10');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.query.mock.calls[1][0]).not.toContain('contact');
    expect(mocks.query.mock.calls[1][1]).toEqual([10, 10]);
    expect(body).toMatchObject({
      total: 1,
      page: 2,
      size: 10,
      items: [{
        id: 42,
        body: 'Public feedback body',
        wcaId: '2017OWNER01',
        replyCount: 2,
        media: [{ id: 7, kind: 'image' }],
      }],
    });
    expect(body.items[0]).not.toHaveProperty('contact');
    expect(body.items[0]).not.toHaveProperty('pageUrl');
    expect(body.items[0]).not.toHaveProperty('userAgent');
  });

  it('bounds public pagination before building the query', async () => {
    mocks.query
      .mockResolvedValueOnce([{ n: '0' }])
      .mockResolvedValueOnce([]);

    const response = await feedbackRoutes.request('/feedback/public?page=-9&size=999');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ items: [], total: 0, page: 1, size: 100 });
    expect(mocks.query.mock.calls[1][1]).toEqual([100, 0]);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it('lets an anonymous reader open the full public conversation safely', async () => {
    mocks.query
      .mockResolvedValueOnce([{ wca_id: '2017OWNER01', status: 'new' }])
      .mockResolvedValueOnce([publicRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: '99', role: 'user', wca_id: '2018REPLY01', wca_name: 'Reply User',
        body: 'I can reproduce this.', created_at: new Date('2026-08-20T01:00:00.000Z'),
      }]);

    const response = await feedbackRoutes.request('/feedback/42/thread');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.optionalAuth).toHaveBeenCalledOnce();
    expect(body.feedback).toMatchObject({ id: 42, wcaId: '2017OWNER01', replyCount: 1 });
    expect(body.messages).toHaveLength(1);
    expect(body.feedback).not.toHaveProperty('contact');
    expect(body.feedback).not.toHaveProperty('pageUrl');
    expect(body.feedback).not.toHaveProperty('userAgent');
    expect(mocks.query).toHaveBeenCalledTimes(4);
  });

  it('lets a signed-in non-owner reply', async () => {
    mocks.requireAuth.mockResolvedValue({ wcaId: '2018REPLY01', name: 'Reply User' });
    mocks.query
      .mockResolvedValueOnce([{ wca_id: '2017OWNER01', status: 'new' }])
      .mockResolvedValueOnce([{ id: '100' }])
      .mockResolvedValueOnce([]);

    const response = await feedbackRoutes.request('/feedback/42/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({ body: 'Community reply' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 100 });
    expect(mocks.query.mock.calls[1][1]).toEqual([
      42, 'user', '2018REPLY01', 'Reply User', 'Community reply',
    ]);
    expect(mocks.sendBark).toHaveBeenCalledOnce();
  });
});
