import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', async (original) => ({
  ...await original<typeof import('../src/utils/recon_helpers.js')>(),
  requireAdmin: (c: { req: { header: (key: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer admin') throw new HTTPException(403);
  },
}));
import { reconRoutes } from '../src/routes/recon.js';
const app = new Hono().route('/v1', reconRoutes);
const pin = (id: string, body: unknown, token = 'admin') => app.request(`/v1/recon/${id}/home-pin`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});
describe('homepage reconstruction pins', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([]); });
  it('rejects anonymous and ordinary users before any database access', async () => {
    for (const token of ['', 'member']) expect((await pin('1', { pinned: true }, token)).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects invalid input before writing', async () => {
    for (const id of ['0', '-1', 'abc', '1.2']) expect((await pin(id, { pinned: true })).status).toBe(400);
    for (const pinned of [1, 'true', undefined]) expect((await pin('1', { pinned })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('pins independently, only from public reconstructions, and removes only the selected pin', async () => {
    mocks.query.mockResolvedValue([{ recon_id: 1 }]);
    expect((await pin('1', { pinned: true })).status).toBe(200);
    expect((await pin('2', { pinned: true })).status).toBe(200);
    for (const [sql] of mocks.query.mock.calls) {
      expect(sql).toContain("visibility = 'public'");
      expect(sql).toContain("record_type IS DISTINCT FROM 'timing'");
      expect(sql).not.toContain('DELETE');
    }
    expect((await pin('1', { pinned: false })).status).toBe(200);
    expect(mocks.query.mock.lastCall).toEqual(['DELETE FROM recon_home_pins WHERE recon_id = ?', [1]]);
    mocks.query.mockResolvedValue([]);
    expect((await pin('3', { pinned: true })).status).toBe(404);
  });
  it('never lists private, unlisted, or timing records and does not cache pin changes', async () => {
    const response = await app.request('/v1/recon/pinned');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.query.mock.calls[0][0]).toContain("visibility = 'public'");
    expect(mocks.query.mock.calls[0][0]).toContain("record_type IS DISTINCT FROM 'timing'");
  });
});
