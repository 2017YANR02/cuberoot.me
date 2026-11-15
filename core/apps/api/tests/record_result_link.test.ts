import { describe, expect, it } from 'vitest';
import type { CompData } from '../src/routes/cubing_live';
import { recordResultHref, tiedBeforeResult } from '../src/utils/record_result_link';
import { enrich, formatCombinedRecords } from '../src/utils/record_format';

const data = {
  slug: 'GLSGdanskVI2026', users: { '87': { number: 87, name: 'Teodor Zajder', wcaid: '2017ZAJD01', region: 'pl' } },
  events: [{ i: '333', rs: [{ i: 'd' }, { i: '2' }, { i: 'f' }] }],
  resultsByRound: {
    '333:d': [{ e: '333', r: 'd', n: 87, a: 437, b: 400, v: [400] }],
    '333:f': [{ e: '333', r: 'f', n: 87, a: 437, b: 400, v: [400] }],
  }, membersByFilter: { females: [], children: [], newcomers: [] },
} as unknown as CompData;
const target = { eventId: '333', roundNumber: 3, personWcaId: '2017ZAJD01', personName: 'Teodor Zajder', type: 'average', value: 437 };

describe('notification result destinations and chronological ties', () => {
  it('emits the same Bark destination after the live roster is renumbered', () => {
    const clem = { number: 5, name: 'Clem Tucker', wcaid: '2022TUCK09', region: 'us' };
    const james = { number: 6, name: 'James Kershaw', wcaid: '2022KERS01', region: 'us' };
    const record = { eventId: 'pyram', roundId: 'f', personWcaId: clem.wcaid, personName: clem.name, type: 'single', value: 70 };
    for (const [clemNumber, jamesNumber] of [[5, 6], [6, 5], [87, 12]]) {
      const snapshot = { ...data, slug: 'DobbsFerryDecathlon2026',
        users: { [clemNumber]: { ...clem, number: clemNumber }, [jamesNumber]: { ...james, number: jamesNumber } },
        events: [{ i: 'pyram', rs: [{ i: 'f' }] }],
        resultsByRound: { 'pyram:f': [
          { n: jamesNumber, b: 212, a: 440, v: [334, 542, 519, 466, 212] },
          { n: clemNumber, b: 70, a: 170, v: [165, 162, 468, 184, 70] },
        ] },
      } as unknown as CompData;
      expect(recordResultHref(snapshot, record)).toBe('/wca/comp/DobbsFerryDecathlon2026/result/pyram/f/2022TUCK09');
    }
  });
  it('marks Ningbo 4.34 as a tied historical PR and preserves the bilingual rank', () => {
    const ningbo = {
      ...data, slug: 'NingboOpen2026',
      personalRecords: { '2024LIZH03': { '333': { single: 332, average: 434 } } },
      users: { '40': { number: 40, name: 'Zhaokun Li (李昭昆)', wcaid: '2024LIZH03', region: 'CN' } },
      events: [{ i: '333', rs: [{ i: '1' }, { i: '2' }, { i: '3' }] }],
      resultsByRound: Object.fromEntries([484, 481, 434].map((a, i) => [`333:${i + 1}`,
        [{ e: '333', r: String(i + 1), n: 40, a, b: 380, v: [380] }]])),
    } as unknown as CompData;
    const result = { ...target, personWcaId: '2024LIZH03', personName: 'Zhaokun Li (李昭昆)', value: 434 };
    const tied = tiedBeforeResult(ningbo, result, 'PR', 'CN');
    expect(tied).toBe(true);
    expect(recordResultHref(ningbo, result)).toBe('/wca/comp/NingboOpen2026/result/333/3/2024LIZH03');
    const text = formatCombinedRecords([enrich({ tag: 'PR', tied, rec_type: 'average', attempt_result: 434,
      event_id: '333', person_name: result.personName, person_iso2: 'CN',
      comp_name: 'Ningbo Open 2026', comp_iso2: 'CN' })], () => 7);
    expect(text.cn).toContain('个人纪录PR(平)/WR7');
    expect(text.en).toContain('PR(Tied)/WR7 Avg');
    expect(tiedBeforeResult(ningbo, { ...result, value: 433 }, 'PR', 'CN')).toBe(false);
    expect(tiedBeforeResult({ ...ningbo, personalRecords: {} }, result, 'PR', 'CN')).toBe(false);
    expect(tiedBeforeResult({ ...ningbo, personalRecords: {
      '2024LIZH03': { '333': { average: 430 } },
    } }, { ...result, value: 481 }, 'PR', 'CN')).toBe(false);
    expect(tiedBeforeResult(ningbo, result, 'NR', 'CN')).toBe(false);
  });
  it('resolves final and combined rounds to a stable WCA identity', () => {
    expect(recordResultHref(data, target)).toBe('/wca/comp/GLSGdanskVI2026/result/333/f/2017ZAJD01');
    expect(recordResultHref(data, { ...target, roundNumber: 1 })).toBe('/wca/comp/GLSGdanskVI2026/result/333/d/2017ZAJD01');
    expect(recordResultHref(data, { ...target, roundNumber: undefined, roundId: 'f' })).toBe('/wca/comp/GLSGdanskVI2026/result/333/f/2017ZAJD01');
  });
  it('does not emit a round-page fallback when the exact result is missing', () => {
    expect(() => recordResultHref(data, { ...target, value: 436 })).toThrow();
    expect(() => recordResultHref(data, { ...target, personWcaId: 'different' })).toThrow();
    expect(() => recordResultHref(data, { ...target, roundNumber: 2 })).toThrow();
  });
  it('marks the later 4.37 as tied, but not the first or a faster result', () => {
    expect(tiedBeforeResult(data, target, 'ER', 'PL')).toBe(true);
    expect(tiedBeforeResult(data, { ...target, roundNumber: 1 }, 'ER', 'PL')).toBe(false);
    expect(tiedBeforeResult(data, { ...target, value: 436 }, 'ER', 'PL')).toBe(false);
    expect(tiedBeforeResult(data, target, 'NAR', 'US')).toBe(false);
    expect(tiedBeforeResult(data, target, 'NR', 'DE')).toBe(false);
  });
  it.each(['WR', 'ER', 'NR'])('renders %s ties in both languages, including combined records', tag => {
    const event = enrich({ tag, tied: true, rec_type: 'average', attempt_result: 437, event_id: '333',
      person_name: 'Teodor Zajder', person_iso2: 'PL', comp_name: 'GLS Gdańsk VI 2026', comp_iso2: 'PL' });
    const text = formatCombinedRecords([event], () => 8);
    expect(text.cn).toContain(`${tag}(平)`);
    expect(text.en).toContain(`${tag}(Tied)`);
    if (tag === 'ER') {
      expect(text.cn).toContain('ER(平)/WR8');
      expect(text.en).toContain('ER(Tied)/WR8');
    }
    const combined = formatCombinedRecords([{ ...event, rec_type: 'single', tied: false }, event], () => 8);
    expect(combined.cn.match(/\(平\)/g)).toHaveLength(1);
    expect(combined.en.match(/\(Tied\)/g)).toHaveLength(1);
  });
});
