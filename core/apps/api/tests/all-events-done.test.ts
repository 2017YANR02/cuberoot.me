import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
import { wcaStatsExtraRoutes } from '../src/routes/wca_stats_extra.js';

beforeEach(() => mocks.query.mockReset());

it.each([
  { onlyDone: '1', order: 'asc', sqlOrder: 'aed.days_to_complete ASC NULLS LAST, aed.wca_id ASC' },
  { onlyDone: '1', order: 'desc', sqlOrder: 'aed.days_to_complete DESC NULLS LAST, aed.wca_id ASC' },
  { onlyDone: '0', order: 'asc', sqlOrder: 'aed.done_count DESC, aed.days_to_complete ASC NULLS LAST, aed.wca_id ASC' },
  { onlyDone: '0', order: 'desc', sqlOrder: 'aed.done_count DESC, aed.days_to_complete DESC NULLS LAST, aed.wca_id ASC' },
])('sorts the filtered dataset before pagination: $onlyDone / $order', async ({ onlyDone, order, sqlOrder }) => {
  mocks.query.mockResolvedValueOnce([{ id: 'China' }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ n: '101' }]);
  const response = await wcaStatsExtraRoutes.request(`/wca/all-events-done?country=CN&onlyDone=${onlyDone}&order=${order}&page=2&size=50`);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ country: 'China', onlyDone: onlyDone === '1', order, page: 2, size: 50, total: 101 });
  const [, [sql, params], [countSql, countParams]] = mocks.query.mock.calls;
  expect(sql).toContain(`ORDER BY ${sqlOrder}\n    LIMIT ? OFFSET ?`);
  expect(sql).toContain('aed.country_id = ?');
  expect(countSql).toContain('aed.country_id = ?');
  expect(sql.includes('aed.is_done = TRUE')).toBe(onlyDone === '1');
  expect(countSql.includes('aed.is_done = TRUE')).toBe(onlyDone === '1');
  expect(params).toEqual(['China', 50, 50]);
  expect(countParams).toEqual(['China']);
});

it.each(['', 'desc;DROP TABLE wca_all_events_done'])('defaults missing or unrecognized order to ascending: %s', async order => {
  mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ n: '0' }]);
  const response = await wcaStatsExtraRoutes.request(`/wca/all-events-done?order=${encodeURIComponent(order)}`);
  expect((await response.json()).order).toBe('asc');
  expect(mocks.query.mock.calls[0][0]).toContain('ORDER BY aed.days_to_complete ASC NULLS LAST, aed.wca_id ASC');
  expect(mocks.query.mock.calls[0][0]).not.toContain('DROP');
});
