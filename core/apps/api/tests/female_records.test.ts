import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { femaleRecordBaseline, prepareFemaleRecords } from '../src/utils/female_records';
import { emptyDayBest, enrichComp, foldCompIntoDayBest, getCurrentRecords } from '../src/utils/current_records';
import { enrich, formatCombinedRecords, type RecordEvent } from '../src/utils/record_format';

vi.mock('../src/db/connection.js', () => ({ query: vi.fn(async (sql: string) => {
  if (sql.includes('wca_persons')) return [{ wca_id: '2025LIAN01', gender: 'f' }];
  if (sql.includes('wca_countries')) return [{ id: 'China', iso2: 'CN', name: 'China', continent_id: '_Asia' }];
  return [false, true].map(is_avg => ({ event_id: '333', is_avg, person_country_id: 'China', vd: [is_avg ? 351 : 276, 20000] }));
}) }));

const history = [
  { e: '333', t: 'a' as const, v: 468, d: '2026-05-01' },
  { e: '333', t: 'a' as const, v: 495, d: '2025-11-23' },
  { e: '333', t: 'a' as const, v: 450, d: '2026-09-15' },
];
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rows: history }) })));
  await getCurrentRecords();
});
afterAll(() => vi.unstubAllGlobals());

describe('female record adjudication', () => {
  it('uses the historical baseline, excluding later and invalid results', () => {
    expect(femaleRecordBaseline([...history, { e: '333', t: 'a', v: -1, d: '2026-01-01' }], '2026-09-13')).toEqual({ '333|1': 468 });
    expect(femaleRecordBaseline(history, '2024-01-01')).toEqual({});
  });

  it('resolves known WCA and newcomer female competitors', async () => {
    const users = { '4': { wcaid: '2025LIAN01', gender: undefined as string | undefined }, '5': { wcaid: '', gender: undefined as string | undefined } };
    expect(await prepareFemaleRecords(users, [5], '2026-09-13')).toEqual({ '333|1': 468 });
    expect(users['4'].gender).toBe('f');
    expect(users['5'].gender).toBe('f');
  });

  it('marks Lian 4.52 FWR, allows ties, excludes men and slower same-day female results', () => {
    const users = {
      '4': { name: 'Yunzhi Lian (连允之)', gender: 'f', region: 'CN' },
      '5': { gender: 'm', region: 'CN' },
      '6': { gender: 'f', region: 'CN' },
    };
    const row = (n: number, a: number) => ({ e: '333', n, b: 354, a, sr: '', ar: '' });
    const resultsByRound = { '333:1': [row(4, 465)], '333:3': [row(4, 452), row(5, 440), row(6, 452)] };
    const day = emptyDayBest();
    foldCompIntoDayBest(day, { slug: 'WuhanCrimsonAutumn2026', name: 'Wuhan', users, resultsByRound });
    const snap = enrichComp(users, resultsByRound, undefined, day, '2026-09-13', { '333|1': 468 });
    expect(resultsByRound['333:3'].map(r => r.ar)).toEqual(['FWR', '', 'FWR']);
    expect(resultsByRound['333:1'][0].ar).toBe('');
    expect(snap?.fwr?.['333|1']).toBe(468);
    expect(snap?.day?.wr['f|333|1'].value).toBe(452);
  });
});

const event: RecordEvent = enrich({ tag: 'FWR', rec_type: 'average', attempt_result: 452, event_id: '333', person_name: 'Yunzhi Lian (连允之)', person_iso2: 'CN', comp_name: '武汉丹秋赛', comp_iso2: 'CN', url: '/wca/comp/WuhanCrimsonAutumn2026' });
describe('FWR notification formatting', () => {
  it('keeps FWR and overall WR10 without mislabelling it AsR', () => {
    const result = formatCombinedRecords([event], () => 10);
    expect(result.cn).toBe('纪录快讯! 4.52三阶平均女子世界纪录FWR/WR10 连允之🇨🇳| 武汉丹秋赛🇨🇳');
    expect(result.en).toContain('FWR/WR10');
    expect(result.en).not.toContain('AsR');
  });
  it('supports double FWR and mixed WR/FWR messages', () => {
    expect(formatCombinedRecords([event, { ...event, rec_type: 'single', attempt_result: 354 }], () => null).cn).toContain('双女子世界纪录FWR');
    expect(formatCombinedRecords([{ ...event, tag: 'WR', rec_type: 'single', attempt_result: 200 }, event], () => 10).cn).toContain('4.52平均女子世界纪录FWR/WR10');
  });
});
