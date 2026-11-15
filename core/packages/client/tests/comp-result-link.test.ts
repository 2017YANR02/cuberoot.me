import { describe, expect, it } from 'vitest';
import { compRecordHref, compResultHref, parseCompResultPath, resolveCompResultPath, resolveCompRecord } from '@/lib/comp-link';

const target = { eventId: '444', roundId: 'f', number: 1 };
const row = { e: '444', r: 'f', n: 1, a: 2759, b: 2562, v: [2562, 2614, 2931, 2953, 2733] };
const data = {
  users: { 1: { name: 'Rhys Caskey' }, 2: { name: 'Other' } },
  events: [{ i: '444', rs: [{ i: 'd' }, { i: 'f' }] }],
  resultsByRound: { '444:d': [{ ...row, r: 'd', a: 3000 }], '444:f': [row, { ...row, n: 2 }] },
};

describe('competition result deep links', () => {
  it('round trips canonical paths in both languages', () => {
    const href = compResultHref('VillanuevaOpen2026', target, { wcaid: '2018CASK01', name: 'Rhys Caskey' });
    expect(href).toBe('/wca/comp/VillanuevaOpen2026/result/444/f/2018CASK01');
    expect(parseCompResultPath(href)).toEqual({ eventId: '444', roundId: 'f', wcaId: '2018CASK01' });
    expect(parseCompResultPath(`/zh${href}`)).toEqual(parseCompResultPath(href));
    for (const suffix of ['0', '-1', '1.5', '9007199254740992', 'x', '1/extra', '%ZZ', 'name%3A']) {
      expect(parseCompResultPath(`/wca/comp/Test/result/444/f/${suffix}`)).toBeNull();
    }
    expect(parseCompResultPath('/wca/comp/Test')).toBeNull();
  });

  it('keeps the Clem Tucker WR attached to Clem across refreshes and data sources', () => {
    const clem = { name: 'Clem Tucker', wcaid: '2022TUCK09' };
    const james = { name: 'James Kershaw', wcaid: '2022KERS01' };
    const href = compResultHref('DobbsFerryDecathlon2026', { eventId: 'pyram', roundId: 'f' }, clem);
    const path = parseCompResultPath(href)!;
    for (const [clemNumber, jamesNumber] of [[5, 6], [6, 5], [87, 12]]) {
      const snapshot = {
        users: { [clemNumber]: clem, [jamesNumber]: james },
        resultsByRound: { 'pyram:f': [{ n: jamesNumber }, { n: clemNumber }] },
      };
      expect(resolveCompResultPath(snapshot, path)).toEqual({ eventId: 'pyram', roundId: 'f', number: clemNumber });
      // The original Bark URL has no identity and must never open James by accident.
      expect(resolveCompResultPath(snapshot, parseCompResultPath('/wca/comp/DobbsFerryDecathlon2026/result/pyram/f/5')!)).toBeNull();
    }
    expect(resolveCompResultPath({ users: { 5: james }, resultsByRound: { 'pyram:f': [{ n: 5 }] } }, path)).toBeNull();
  });

  it('supports newcomers and refuses ambiguous names', () => {
    const person = { name: 'New Person (新人) / A' };
    const href = compResultHref('Test', target, person);
    const path = parseCompResultPath(href)!;
    expect(path).toEqual({ eventId: '444', roundId: 'f', personName: person.name });
    expect(resolveCompResultPath({ ...data, users: { 1: person } }, path)).toEqual(target);
    expect(resolveCompResultPath({ ...data, users: { 1: person, 2: person } }, path)).toBeNull();
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
