import { describe, expect, it } from 'vitest';
import type { CompData } from '../src/routes/cubing_live';
import { recordResultHref, tiedInEarlierRound } from '../src/utils/record_result_link';
import { enrich, formatCombinedRecords } from '../src/utils/record_format';

const data = {
  slug: 'GLSGdanskVI2026', users: { '87': { number: 87, name: 'Teodor Zajder', wcaid: 'person', region: 'pl' } },
  events: [{ i: '333', rs: [{ i: 'd' }, { i: '2' }, { i: 'f' }] }],
  resultsByRound: {
    '333:d': [{ e: '333', r: 'd', n: 87, a: 437, b: 400, v: [400] }],
    '333:f': [{ e: '333', r: 'f', n: 87, a: 437, b: 400, v: [400] }],
  }, membersByFilter: { females: [], children: [], newcomers: [] },
} as unknown as CompData;
const target = { eventId: '333', roundNumber: 3, personWcaId: 'person', personName: 'Teodor Zajder', type: 'average', value: 437 };

describe('notification result destinations and chronological ties', () => {
  it('resolves final and combined rounds to the page’s competitor number', () => {
    expect(recordResultHref(data, target)).toBe('/wca/comp/GLSGdanskVI2026/result/333/f/87');
    expect(recordResultHref(data, { ...target, roundNumber: 1 })).toBe('/wca/comp/GLSGdanskVI2026/result/333/d/87');
    expect(recordResultHref(data, { ...target, roundNumber: undefined, roundId: 'f' })).toBe('/wca/comp/GLSGdanskVI2026/result/333/f/87');
  });
  it('does not emit a round-page fallback when the exact result is missing', () => {
    expect(() => recordResultHref(data, { ...target, value: 436 })).toThrow();
    expect(() => recordResultHref(data, { ...target, personWcaId: 'different' })).toThrow();
    expect(() => recordResultHref(data, { ...target, roundNumber: 2 })).toThrow();
  });
  it('marks the later 4.37 as tied, but not the first or a faster result', () => {
    expect(tiedInEarlierRound(data, target, 'ER', 'PL')).toBe(true);
    expect(tiedInEarlierRound(data, { ...target, roundNumber: 1 }, 'ER', 'PL')).toBe(false);
    expect(tiedInEarlierRound(data, { ...target, value: 436 }, 'ER', 'PL')).toBe(false);
    expect(tiedInEarlierRound(data, target, 'NAR', 'US')).toBe(false);
    expect(tiedInEarlierRound(data, target, 'NR', 'DE')).toBe(false);
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
