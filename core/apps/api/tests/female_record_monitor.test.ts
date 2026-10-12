import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pushFemaleRecords } from '../src/monitors/wca_live_record';

const mocks = vi.hoisted(() => ({ send: vi.fn(), mark: vi.fn(), pushed: vi.fn(), records: vi.fn() }));
vi.mock('../src/monitors/bark.js', () => ({ sendBark: mocks.send }));
vi.mock('../src/monitors/state.js', () => ({ markPushed: mocks.mark, getPushedSet: mocks.pushed, countPushed: vi.fn() }));
vi.mock('../src/monitors/config.js', () => ({ RECORD_TAGS: new Set(['WR']), NR_COUNTRIES: new Set(), POLL_INTERVAL_MS: {}, SITE_BASE: 'https://cuberoot.me', isChineseRegion: () => true, siteCompUrl: () => 'https://cuberoot.me/zh/wca/comp/WuhanCrimsonAutumn2026?event=333' }));
vi.mock('../src/monitors/names.js', () => ({ enrichName: vi.fn() }));
vi.mock('../src/monitors/poll.js', () => ({ startPoller: vi.fn() }));
vi.mock('../src/routes/cubing_live.js', () => ({ extractInferredRecords: mocks.records }));
vi.mock('../src/routes/wca_recent_records.js', () => ({ formatInferred: async (record: { tag: string; newcomerSource?: string }) => record.tag === 'NWR'
  ? { cn: `新人世界纪录（${record.newcomerSource === '1st-comp' ? '首场比赛' : '首次还原'}）NWR`, en: `NWR (${record.newcomerSource})` }
  : { cn: '4.52 女子世界纪录 FWR 连允之', en: '4.52 FWR Yunzhi Lian' } }));
vi.mock('../src/routes/wca_format.js', () => ({ formatRecords: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue(true);
  mocks.pushed.mockResolvedValue(new Set());
  mocks.records.mockResolvedValue([{ id: 'inferred|Wuhan|333|3|average|4|FWR|452', tag: 'FWR', compId: 'WuhanCrimsonAutumn2026', eventId: '333', roundId: '3', personNumber: 4, personIso2: 'CN' }, { id: 'nr', tag: 'NR' }]);
});
describe('FWR Bark delivery', () => {
  it('delivers both NWR sources independently and deduplicates each successful notification', async () => {
    const records = ['1st-solve', '1st-comp'].map(source => ({ id: `nwr|${source}`, tag: 'NWR', newcomerSource: source, compId: 'Current2026', eventId: '444', roundId: 'f', personNumber: 7, personIso2: 'CN' }));
    mocks.records.mockResolvedValue(records);
    await pushFemaleRecords(false);
    expect(mocks.send.mock.calls.map(call => call[0].title)).toEqual(['新人世界纪录（首次还原）NWR', '新人世界纪录（首场比赛）NWR']);
    expect(mocks.send.mock.calls.map(call => call[0].url)).toEqual(Array(2).fill('https://cuberoot.me/wca/comp/Current2026/result/444/f/7'));
    expect(mocks.mark.mock.calls.map(call => call[1])).toEqual([['nwr|1st-solve'], ['nwr|1st-comp']]);
    mocks.pushed.mockResolvedValue(new Set(['nwr|1st-solve', 'nwr|1st-comp']));
    await pushFemaleRecords(false);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
  it('sends FWR once and persists its distinct ID', async () => {
    await pushFemaleRecords(false);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({ title: '4.52 女子世界纪录 FWR 连允之', url: 'https://cuberoot.me/wca/comp/WuhanCrimsonAutumn2026/result/333/3/4' });
    expect(mocks.mark).toHaveBeenCalledWith('wca_live_record', ['inferred|Wuhan|333|3|average|4|FWR|452']);
    mocks.pushed.mockResolvedValue(new Set(['inferred|Wuhan|333|3|average|4|FWR|452']));
    await pushFemaleRecords(false);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it('links Stephanie’s 23.13 FWR to her exact Megaminx result without a language prefix', async () => {
    mocks.records.mockResolvedValue([{ id: 'stephanie-fwr', tag: 'FWR', compId: 'MeathForMegaSpeed2026', eventId: 'minx', roundId: 'd', personNumber: 87, personIso2: 'IE' }]);
    await pushFemaleRecords(false);
    expect(mocks.send.mock.calls[0][0].url).toBe('https://cuberoot.me/wca/comp/MeathForMegaSpeed2026/result/minx/d/87');
  });
  it('keeps failed sends eligible for retry', async () => {
    mocks.send.mockResolvedValue(false);
    await pushFemaleRecords(false);
    expect(mocks.mark).not.toHaveBeenCalled();
  });
  it('keeps the existing silent first-run policy', async () => {
    await pushFemaleRecords(true);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.mark).toHaveBeenCalledTimes(1);
  });
});
