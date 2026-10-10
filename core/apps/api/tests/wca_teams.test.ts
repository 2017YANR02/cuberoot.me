import { beforeEach, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAdminOrApiKey: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: mocks.requireAdminOrApiKey }));
import { wcaTeamRoutes } from '../src/routes/wca_teams.js';
const put = (body: unknown) => wcaTeamRoutes.request('/wca/teams/2017YANR02', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); });
it('rejects non-admin writes before touching the database', async () => {
  mocks.requireAdminOrApiKey.mockRejectedValue(new HTTPException(403));
  expect((await put({ name: 'GAN' })).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('rejects malformed and overlong names before database writes', async () => {
  for (const name of [null, {}, 'x'.repeat(81)]) expect((await put({ name })).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('normalizes a custom name and atomically assigns it to an existing cuber', async () => {
  mocks.query.mockResolvedValueOnce([{ wca_id: '2017YANR02' }]).mockResolvedValueOnce([{ id: 4, name: 'Team A' }]);
  const response = await put({ name: '  Team   A  ' });
  expect(await response.json()).toEqual({ team: { id: 4, name: 'Team A' } });
  expect(mocks.query.mock.calls[1][1]).toEqual(['Team A', '2017YANR02']);
});
it('clears only the selected cuber assignment', async () => {
  mocks.query.mockResolvedValueOnce([{ wca_id: '2017YANR02' }]).mockResolvedValueOnce([]);
  expect(await (await put({ name: '' })).json()).toEqual({ team: null });
  expect(mocks.query).toHaveBeenLastCalledWith('DELETE FROM wca_person_teams WHERE wca_id = ?', ['2017YANR02']);
});
it('rejects invalid lookup IDs without querying', async () => {
  expect((await wcaTeamRoutes.request('/wca/teams?persons=invalid')).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('returns public options and assignments without caching', async () => {
  mocks.query.mockResolvedValueOnce([{ id: 1, name: 'GAN' }]).mockResolvedValueOnce([{ wcaId: '2017YANR02', teamId: 1 }]);
  const response = await wcaTeamRoutes.request('/wca/teams?persons=2017YANR02');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ teams: [{ id: 1, name: 'GAN' }], assignments: [{ wcaId: '2017YANR02', teamId: 1 }] });
});
