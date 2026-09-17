import { describe, expect, it } from 'vitest';
import { compRecordHref, compResultHref, parseCompResultPath, resolveCompRecord } from '@/lib/comp-link';

const target = { eventId: '444', roundId: 'f', number: 1 };
const row = { e: '444', r: 'f', n: 1, a: 2759, b: 2562, v: [2562, 2614, 2931, 2953, 2733] };
const data = {
  users: { 1: { name: 'Rhys Caskey' }, 2: { name: 'Other' } },
  events: [{ i: '444', rs: [{ i: 'd' }, { i: 'f' }] }],
  resultsByRound: { '444:d': [{ ...row, r: 'd', a: 3000 }], '444:f': [row, { ...row, n: 2 }] },
};

describe('competition result deep links', () => {
  it('round trips canonical paths in both languages', () => {
    const href = compResultHref('VillanuevaOpen2026', target);
    expect(href).toBe('/wca/comp/VillanuevaOpen2026/result/444/f/1');
    expect(parseCompResultPath(href)).toEqual(target);
    expect(parseCompResultPath(`/zh${href}`)).toEqual(target);
    for (const suffix of ['0', '-1', '1.5', '9007199254740992', 'x', '1/extra']) {
      expect(parseCompResultPath(`/wca/comp/Test/result/444/f/${suffix}`)).toBeNull();
    }
    expect(parseCompResultPath('/wca/comp/Test')).toBeNull();
  });

  it('resolves the homepage record to the exact person, event and round', () => {
    const href = compRecordHref({ competitionId: 'VillanuevaOpen2026', eventId: '444',
      personName: 'Rhys Caskey', type: 'average', attemptResult: 2759 });
    const url = new URL(href, 'https://cuberoot.me');
    expect(url.searchParams.get('view')).toBe('result');
    expect(resolveCompRecord(data, url.searchParams.get('event')!, url.searchParams.get('record')!)).toEqual(target);
    expect(resolveCompRecord(data, '333', '["Rhys Caskey","average",2759]')).toBeNull();
    expect(resolveCompRecord(data, '444', '["Unknown","average",2759]')).toBeNull();
    expect(resolveCompRecord(data, '444', '["Rhys Caskey","single",2931]')).toEqual({ ...target, roundId: 'd' });
  });

  it.each(['bad json', '{}', '[]', '["Rhys Caskey","average",-1]', '["Rhys Caskey","bad",2759]',
    '["Rhys Caskey","average",2759.1]', '["Rhys Caskey","average",0]'])('ignores invalid record selectors: %s', record => {
    expect(resolveCompRecord(data, '444', record)).toBeNull();
  });
});
