import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
vi.mock('../src/monitors/watched.js', () => ({ getWatchedPersons: vi.fn() }));
vi.mock('../src/monitors/bark.js', () => ({ sendBark: vi.fn() }));
import { detectChanges } from '../src/monitors/wca_past_results';

const before = { c: 'MidAtlanticChampionship2026', e: '333', r: 'f', f: 'h', b: 344, a: 0, p: 1,
  at: [387,344,428,520,407,632,510,617,368,529,452,554,403,444,493], rs: null, ra: null };

describe('result republication', () => {
  const audited = JSON.parse(readFileSync(new URL('./fixtures/wca-result-republication.json', import.meta.url), 'utf8')) as {
    person: string; beforeId: number; afterId: number; fingerprint: typeof before;
  }[];
  it.each(audited)('does not report audited replacement $person $beforeId → $afterId', ({ beforeId, afterId, fingerprint }) => {
    expect(detectChanges({ [beforeId]: fingerprint }, { [afterId]: fingerprint })).toEqual([]);
  });
  it('does not cancel identical results republished under another ID', () => {
    expect(detectChanges({8431058: before}, {8452464: {...before}})).toEqual([]);
  });
  it('retains actual corrections when the ID also changes', () => {
    const changes = detectChanges({8431058: before}, {8452464: {...before, p: 2}});
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({resultId: 8452464, changeType: 'modified', fields: [{field:'pos',old:1,new:2}]});
  });
  it('retains genuine removals and does not match a different round', () => {
    expect(detectChanges({8431058: before}, {})[0].changeType).toBe('removed');
    expect(detectChanges({8431058: before}, {8452464: {...before,r:'3'}})[0].changeType).toBe('removed');
  });
  it('does not guess when replacement identities are ambiguous', () => {
    expect(() => detectChanges({8431058: before}, {8452464: before,8452465: before})).toThrow('Ambiguous WCA result replacement');
  });
});
