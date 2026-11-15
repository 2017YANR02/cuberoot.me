import { afterEach, expect, it, vi } from 'vitest';
import { startCubingRecordMonitor, isChinaInWindow } from '../src/monitors/cubing_record';
import type { CubingCompetition } from '@cuberoot/shared/cubing-live';

const mocks = vi.hoisted(() => ({ list: vi.fn(), meta: vi.fn(), poll: vi.fn() }));
vi.mock('../src/utils/cubing_source.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/utils/cubing_source.js')>(), fetchCubingCompetitions: mocks.list,
}));
vi.mock('../src/utils/cubing_live.js', () => ({ fetchCubingMeta: mocks.meta }));
vi.mock('../src/monitors/poll.js', () => ({ startPoller: mocks.poll }));
vi.mock('../src/monitors/watched.js', () => ({ getWatchedMatchKeys: async () => new Set() }));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn(() => { throw new Error('No database access in cadence test'); }) }));
vi.mock('../src/monitors/bark.js', () => ({ sendBark: vi.fn(() => { throw new Error('No notifications in cadence test'); }) }));
afterEach(() => vi.useRealTimers());

it('scans active competitions on every minute tick, but old competitions only when due', async () => {
  vi.useFakeTimers();
  const start = Date.parse('2026-11-14T06:00:00Z');
  vi.setSystemTime(start);
  const active = { id: 10001, alias: 'Active', startDate: '2026-11-14', endDate: null, live: true, locations: [{ regionIso2: 'CN' }] } as CubingCompetition;
  const old = { ...active, id: 10002, alias: 'Old', startDate: '2026-11-10' };
  expect(isChinaInWindow({ ...active, startDate: '2026-11-15' }, start / 1000, 30 * 86400)).toBe(false);
  mocks.list.mockResolvedValue([active, old]);
  mocks.meta.mockImplementation(async () => {
    vi.setSystemTime(Date.now() + 5000); // real scans finish after the tick, not at its boundary
    return { events: [] };
  });
  startCubingRecordMonitor();
  const tick = mocks.poll.mock.calls[0][1] as () => Promise<void>;
  await tick();
  expect(mocks.meta.mock.calls.map(([slug]) => slug)).toEqual(['Active', 'Old']);
  vi.setSystemTime(start + 60_000);
  await tick();
  expect(mocks.meta.mock.calls.map(([slug]) => slug)).toEqual(['Active', 'Old', 'Active']);
  vi.setSystemTime(start + 6 * 3600_000);
  await tick();
  expect(mocks.meta.mock.calls.map(([slug]) => slug)).toEqual(['Active', 'Old', 'Active', 'Active', 'Old']);
});
