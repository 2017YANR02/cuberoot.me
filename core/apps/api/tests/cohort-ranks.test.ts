import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
import { wcaStatsExtraRoutes } from '../src/routes/wca_stats_extra.js';

beforeEach(() => mocks.query.mockReset());
it.each(['_Europe', '_Asia', '_Africa'])('filters %s before ranking and pagination, including the total', async (country) => {
  mocks.query.mockResolvedValueOnce([{ wca_id: '2022TEST01', value: 400, country_id: 'Test', iso2: 'XX', world_rank: 8, country_rank: 1, scope_rank: '2', person_name: 'Test' }])
    .mockResolvedValueOnce([{ n: '51' }]);
  const response = await wcaStatsExtraRoutes.request(`/wca/cohort-ranks?cohort=2022&country=${country}&page=2&size=50`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.country).toBe(country);
  expect(data.total).toBe(51);
  expect(data.rows[0].rank).toBe(2);
  const [[sql, params], [countSql, countParams]] = mocks.query.mock.calls;
  expect(sql).toContain('RANK() OVER (ORDER BY cr.value ASC) AS scope_rank');
  expect(sql).toContain('ORDER BY scope_rank ASC, cr.wca_id ASC');
  for (const query of [sql, countSql]) expect(query).toContain('cr.country_id IN (SELECT id FROM wca_countries WHERE continent_id = ?)');
  expect(countParams).toEqual([2022, '333', false, country]);
  expect(params).toEqual([...countParams, 50, 50]);
});
it('preserves stored country ranks and filters both queries by the same country', async () => {
  mocks.query.mockResolvedValueOnce([{ id: 'China' }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ n: '0' }]);
  const response = await wcaStatsExtraRoutes.request('/wca/cohort-ranks?cohort=2019&country=CN&type=average');
  expect(response.status).toBe(200);
  const [, [sql, params], [countSql, countParams]] = mocks.query.mock.calls;
  expect(sql).toContain('cr.country_rank AS scope_rank');
  expect(sql).toContain('AND cr.country_id = ?');
  expect(countSql).toContain('AND cr.country_id = ?');
  expect(countParams).toEqual([2019, '333', true, 'China']);
  expect(params).toEqual([...countParams, 100, 0]);
});
