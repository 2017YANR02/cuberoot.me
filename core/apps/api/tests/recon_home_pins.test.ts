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
describe.each([
  { list: 'pinned', action: 'home-pin', field: 'pinned', table: 'recon_home_pins' },
  { list: 'featured', action: 'featured', field: 'featured', table: 'recon_featured_solves' },
])('reconstruction curation: $list', ({ list, action, field, table }) => {
  const pin = (id: string, body: unknown, token = 'admin') => app.request(`/v1/recon/${id}/${action}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([]); });
  it('rejects anonymous and ordinary users before any database access', async () => {
    for (const token of ['', 'member']) expect((await pin('1', { [field]: true }, token)).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects invalid input before writing', async () => {
    for (const id of ['0', '-1', 'abc', '1.2']) expect((await pin(id, { [field]: true })).status).toBe(400);
    for (const pinned of [1, 'true', undefined]) expect((await pin('1', { [field]: pinned })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('pins independently, only from public reconstructions, and removes only the selected pin', async () => {
    mocks.query.mockResolvedValue([{ recon_id: 1 }]);
    expect((await pin('1', { [field]: true })).status).toBe(200);
    expect((await pin('2', { [field]: true })).status).toBe(200);
    for (const [sql] of mocks.query.mock.calls) {
      expect(sql).toContain("visibility = 'public'");
      expect(sql).toContain("record_type IS DISTINCT FROM 'timing'");
      expect(sql).not.toContain('DELETE');
      expect(sql).toContain(`INSERT INTO ${table}`);
    }
    expect((await pin('1', { [field]: false })).status).toBe(200);
    expect(mocks.query.mock.lastCall).toEqual([`DELETE FROM ${table} WHERE recon_id = ?`, [1]]);
    mocks.query.mockResolvedValue([]);
    expect((await pin('3', { [field]: true })).status).toBe(404);
  });
  it('never lists private, unlisted, or timing records and does not cache pin changes', async () => {
    const response = await app.request(`/v1/recon/${list}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.query.mock.calls[0][0]).toContain("visibility = 'public'");
    expect(mocks.query.mock.calls[0][0]).toContain("record_type IS DISTINCT FROM 'timing'");
  });
});
