import { beforeEach, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAdminOrApiKey: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: (run: (query: typeof mocks.query) => unknown) => run(mocks.query) }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: mocks.requireAdminOrApiKey }));
import { wcaTeamRoutes } from '../src/routes/wca_teams.js';
const put = (body: unknown) => wcaTeamRoutes.request('/wca/teams/2017YANR02', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const createMember = (body: unknown) => wcaTeamRoutes.request('/wca/teams/members', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); });
it('returns directory counts and paginated member results without modifying assignments', async () => {
  mocks.query.mockResolvedValueOnce([{ id: 2, name: '魔域', count: 2 }])
    .mockResolvedValueOnce([{ wcaId: '2017YANR02', teamName: '魔域', bestAverage: 1000 }])
    .mockResolvedValueOnce([{ count: 2 }]);
  const response = await wcaTeamRoutes.request('/wca/teams?directory=1&team=moyu&page=2&size=1');
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.total).toBe(2);
  expect(data.members).toHaveLength(1);
  expect(mocks.query.mock.calls[1][0]).toContain('average > 0');
  expect(mocks.query.mock.calls[1][1]).toEqual(['魔域', '魔域战队', '魔域梦之队', 1, 1]);
  expect(mocks.query.mock.calls[2][1]).toEqual(['魔域', '魔域战队', '魔域梦之队']);
});
it('rejects non-admin writes before touching the database', async () => {
  mocks.requireAdminOrApiKey.mockRejectedValue(new HTTPException(403));
  expect((await put({ names: ['GAN', 'Cubicle'] })).status).toBe(403);
  expect((await createMember({ name: 'New Member', teamId: 1 })).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('creates a real named member without inventing a WCA identity', async () => {
  const member = { memberId: 42, wcaId: null, name: 'New Member', teamId: 1 };
  mocks.query.mockResolvedValueOnce([member]);
  const response = await createMember({ name: '  New   Member  ', teamId: 1 });
  expect(response.status).toBe(201);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ member });
  expect(mocks.query).toHaveBeenCalledTimes(1);
  expect(mocks.query.mock.calls[0][1]).toEqual(['New Member', 1]);
});
it('rejects missing identities and invalid teams before writing', async () => {
  for (const body of [{ name: '', teamId: 1 }, { name: ' ', teamId: 1 }, { name: 'x'.repeat(81), teamId: 1 },
    { name: 'Member', teamId: '1' }, { name: 'Member', teamId: -1 }, { name: 'Member', teamId: 1.5 }]) {
    expect((await createMember(body)).status).toBe(400);
  }
  expect(mocks.query).not.toHaveBeenCalled();
  mocks.query.mockResolvedValueOnce([]);
  expect((await createMember({ name: 'Member', teamId: 99 })).status).toBe(404);
});
it('rejects malformed and overlong names before database writes', async () => {
  for (const names of [null, {}, ['x'.repeat(81)], [''], [null], Array(21).fill('Team')]) {
    expect((await put({ names })).status).toBe(400);
  }
  expect((await put({ name: 'GAN' })).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('normalizes and deduplicates custom names, keeping all selected memberships', async () => {
  mocks.query.mockResolvedValue([]).mockResolvedValueOnce([{ wca_id: '2017YANR02' }])
    .mockResolvedValueOnce([{ id: 4, name: 'Team A' }]).mockResolvedValueOnce([{ id: 5, name: 'Team B' }]);
  const response = await put({ names: ['  Team   A  ', 'Team B', 'Team A'] });
  expect(await response.json()).toEqual({ teams: [{ id: 4, name: 'Team A' }, { id: 5, name: 'Team B' }] });
  expect(mocks.query.mock.calls[1][1]).toEqual(['Team A']);
  expect(mocks.query.mock.calls[3][1]).toEqual(['2017YANR02', 4, 5]);
  expect(mocks.query.mock.calls[4][1]).toEqual(['2017YANR02', 4]);
  expect(mocks.query.mock.calls[5][1]).toEqual(['2017YANR02', 5]);
});
it('clears only the selected cuber assignment', async () => {
  mocks.query.mockResolvedValueOnce([{ wca_id: '2017YANR02' }]).mockResolvedValueOnce([]);
  expect(await (await put({ names: [] })).json()).toEqual({ teams: [] });
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
