import { beforeEach, expect, it, vi } from 'vitest';
import { wcaRelationFilter } from '../src/utils/wca_relation_filters.js';
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
import { historicalRanksRoutes } from '../src/routes/historical_ranks.js';

beforeEach(() => mocks.query.mockReset());
it('combines brand and event-specific teacher membership with bound parameters', () => {
  const qs = new URLSearchParams({ team: 'moyu', teacherFilter: '2017YANR02' });
  const filter = wcaRelationFilter(key => qs.get(key) ?? undefined, 's.wca_id', ['333', '222']);
  expect(filter.params).toEqual(['魔域', '魔域战队', '魔域梦之队', '333', '222', '2017YANR02']);
  expect(filter.sql).toContain('rf.student_wca_id = s.wca_id');
  expect(filter.sql).toContain('rf.event_id IN (?,?)');
  expect(filter.sql).toContain('rf.teacher_wca_id = ?');
});
it('distinguishes no recorded relation from explicit self teaching', () => {
  const missing = wcaRelationFilter(key => key === 'teacherFilter' ? 'none' : undefined, 't.wca_id', ['333']);
  const self = wcaRelationFilter(key => key === 'teacherFilter' ? 'self' : undefined, 't.wca_id', ['333']);
  expect(missing.sql).toContain('NOT EXISTS');
  expect(self.sql).toContain('rf.teacher_wca_id IS NULL');
  expect(self.sql).not.toContain('NOT EXISTS');
});
it('rejects unrecognized filter values before querying', async () => {
  const response = await historicalRanksRoutes.request('/wca/historical-ranks?year=2026&team=1%20OR%201=1');
  expect(response.status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('filters the ranked base and count before pagination, with identical parameters', async () => {
  mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ n: '185' }]);
  const response = await historicalRanksRoutes.request('/wca/historical-ranks?year=2026&team=moyu&teacherFilter=2017YANR02&page=2&size=50');
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect((await response.json()).total).toBe(185);
  const [[dataSql, dataParams], [countSql, countParams]] = mocks.query.mock.calls;
  expect(dataSql.indexOf('FROM wca_person_teams')).toBeLessThan(dataSql.indexOf('RANK() OVER'));
  expect(countSql).toContain('FROM wca_person_teams');
  expect(dataParams).toEqual([...countParams, 50, 50]);
  expect(countParams).toEqual(['333', 2026, '魔域', '魔域战队', '魔域梦之队', '333', '2017YANR02']);
});
