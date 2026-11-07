import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startWcaCompMonitor } from '../src/monitors/wca_comp';
import { startCubingCompMonitor } from '../src/monitors/cubing_comp';

const mocks = vi.hoisted(() => ({
  send: vi.fn(), count: vi.fn(), pushed: vi.fn(), mark: vi.fn(), cubing: vi.fn(), poll: vi.fn(),
}));
vi.mock('../src/monitors/bark.js', () => ({ sendBark: mocks.send }));
vi.mock('../src/monitors/state.js', () => ({
  countPushed: mocks.count, getPushedSet: mocks.pushed, markPushed: mocks.mark,
}));
vi.mock('../src/monitors/poll.js', () => ({ startPoller: mocks.poll }));
vi.mock('@cuberoot/shared/cubing-live', () => ({ fetchCubingCompetitions: mocks.cubing }));

const wcaComp = {
  id: 'FMCZhengzhou2026', name: 'FMC Zhengzhou 2026', country_iso2: 'CN',
  start_date: '2026-12-26', city: 'Zhengzhou, Henan', event_ids: ['333fm'], competitor_limit: 50,
};
const cubingComp = {
  id: 123, alias: 'FMC-Zhengzhou-2026', type: 'WCA', wcaCompetitionId: wcaComp.id,
  name: wcaComp.name, nameZh: '2026WCA郑州最少步赛', startDate: wcaComp.start_date,
  endDate: null, events: ['333fm'], competitorLimit: 50,
  locations: [{ venueZh: '二七区兴隆街8号郑州大酒店五楼月季厅', competitorLimit: 50 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
  mocks.count.mockResolvedValue(1);
  const seen = new Map<string, Set<string>>();
  mocks.pushed.mockImplementation(async (monitor: string) => new Set(seen.get(monitor)));
  mocks.mark.mockImplementation(async (monitor: string, ids: string[]) => {
    const entries = seen.get(monitor) ?? new Set<string>();
    ids.forEach(id => entries.add(id));
    seen.set(monitor, entries);
  });
  mocks.send.mockResolvedValue(true);
  mocks.cubing.mockResolvedValue([cubingComp]);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([wcaComp])));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function cycles() {
  startWcaCompMonitor();
  startCubingCompMonitor();
  return Object.fromEntries(mocks.poll.mock.calls.map(([label, run]) => [label, run])) as Record<string, () => Promise<void>>;
}

describe('competition announcement source ownership', () => {
  it.each([['wca-comp', 'cubing-comp'], ['cubing-comp', 'wca-comp']])(
    'sends only the Chinese announcement when %s runs before %s', async (first, second) => {
      const run = cycles();
      expect(mocks.poll).toHaveBeenCalledWith('cubing-comp', expect.any(Function), 60_000);
      expect(mocks.poll).toHaveBeenCalledWith('wca-comp', expect.any(Function), 300_000);
      await run[first]();
      await run[second]();
      await run[first]();
      await run[second]();
      expect(mocks.send).toHaveBeenCalledExactlyOnceWith({
        title: '比赛公示快讯! 2026WCA郑州最少步赛',
        body: '2026-12-26 | 二七区兴隆街8号郑州大酒店五楼月季厅🇨🇳 | 1个项目 | 上限50',
        url: 'https://cuberoot.me/zh/wca/comp/FMCZhengzhou2026', group: 'cubing-comp',
      });
    },
  );

  it('preserves WCA notices outside mainland China', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(['HK', 'MO', 'TW', 'US'].map(region => ({
      ...wcaComp, id: `${region}2026`, country_iso2: region,
    }))));
    await cycles()['wca-comp']();
    expect(mocks.send).toHaveBeenCalledTimes(4);
    expect(mocks.mark.mock.calls.map(([, ids]) => ids)).toEqual([
      ['HK2026'], ['MO2026'], ['TW2026'], ['US2026'],
    ]);
  });

  it('retries a failed Chinese notice on its next existing poll', async () => {
    const run = cycles();
    mocks.send.mockResolvedValueOnce(false);
    await run['cubing-comp']();
    expect(mocks.mark).not.toHaveBeenCalled();
    await run['cubing-comp']();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.mark).toHaveBeenCalledWith('cubing_comp', ['123']);
  });
});
