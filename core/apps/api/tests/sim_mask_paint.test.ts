import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAdminOrApiKey: (c: { req: { header: (name: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer test-admin') throw new HTTPException(403);
  },
}));
import { simMasksRoutes } from '../src/routes/sim_masks.js';
const app = new Hono().route('/v1', simMasksRoutes);
const put = (sids: string, admin = true) => app.request('/v1/sim-masks', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) },
  body: JSON.stringify({ maskKey: 'preset:mixed', kind: 'custom', cubeSize: 3, labelEn: 'Mixed', sids, pick: 'regular', rest: 'ignored' }),
});
beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async (_sql, values) => [{
    id: 1, mask_key: values[0], kind: values[1], cube_size: values[2], hidden: values[3],
    label_en: values[4], label_zh: values[5], sids: values[6], pick: values[7], rest: values[8], position: -1,
  }]);
});
it.each(['U:0,4;F:3-5', 'regular=U:4|dim=F:0,1|outline=R:3-5'])('preserves mask styles through the existing persistence contract: %s', async sids => {
  const response = await put(sids);
  expect(response.status).toBe(200);
  expect((await response.json()).sids).toBe(sids);
  expect(query.mock.calls[0][1][6]).toBe(sids);
});
it.each(['dim=U:0|dim=F:4', 'unknown=U:0', 'dim=U:0|', 'dim=U:0-99999999', 'dim=bad', 'outline='])('rejects malformed painted data without writing: %s', async sids => {
  expect((await put(sids)).status).toBe(400);
  expect(query).not.toHaveBeenCalled();
});
it('keeps painted masks admin-only to save', async () => {
  expect((await put('dim=U:4', false)).status).toBe(403);
  expect(query).not.toHaveBeenCalled();
});
