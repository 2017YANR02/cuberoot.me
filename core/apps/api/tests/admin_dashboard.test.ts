import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
import { requireAdminOrApiKey } from '../src/utils/recon_helpers.js';
import { query } from '../src/db/connection.js';
import { readFile } from 'node:fs/promises';
import { adminDashboardRoutes } from '../src/routes/admin_dashboard.js';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(query).mockResolvedValue([]);
  vi.mocked(readFile).mockRejectedValue(new Error('missing'));
});

describe('administrator dashboard boundaries', () => {
  it('does not read records or files before administrator authorization', async () => {
    vi.mocked(requireAdminOrApiKey).mockRejectedValue(new HTTPException(403));
    const response = await adminDashboardRoutes.request('/admin/dashboard');
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
  it('rejects unsupported date ranges before querying', async () => {
    const response = await adminDashboardRoutes.request('/admin/dashboard?days=10000');
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it('preserves other sections when revenue fails, and never substitutes zero for missing traffic', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ feedback: 601, threads: 201, posts: 0, reports: 301, sponsorClaims: 2 }])
      .mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce([{ currency: 'CNY', amount: '25.50' }]);
    const response = await adminDashboardRoutes.request('/admin/dashboard?days=7');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const data = await response.json();
    expect(data.pending.feedback).toBe(601);
    expect(data.pending.reports).toBe(301);
    expect(data.revenue).toBe(null);
    expect(data.traffic).toBe(null);
    expect(data.sponsors).toEqual([{ currency: 'CNY', amount: '25.50' }]);
    expect((Date.parse(data.to) - Date.parse(data.from)) / 86400_000).toBe(6);
  });
  it('projects only aggregate traffic fields and marks stale reports', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ windowStart: '2020-01-01T00:00:00Z', windowEnd: '2020-01-01T01:00:00Z',
      sources: [{ source: 'nginx', coverage: 'observed', requests: 20, pageCandidates: 3, unexpected5xx: 1, attribution: { private: 'hidden' }, topRoutes: ['hidden'] }] }));
    const data = await (await adminDashboardRoutes.request('/admin/dashboard')).json();
    expect(data.traffic.stale).toBe(true);
    expect(data.traffic.sources).toEqual([{ source: 'nginx', coverage: 'observed', requests: 20, pageCandidates: 3, unexpected5xx: 1 }]);
  });
  it('rejects malformed counts instead of displaying fabricated traffic', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ windowStart: '2020-01-01', windowEnd: '2020-01-02', sources: [{ source: 'nginx', coverage: 'observed', requests: -1 }] }));
    expect((await (await adminDashboardRoutes.request('/admin/dashboard')).json()).traffic).toBe(null);
  });
});
