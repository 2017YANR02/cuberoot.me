import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMatchingScrambleGroup, type WcaScrambleRow } from '@/lib/wca-results-api';

const official = "F' L' B R' B2 U L2 B2 U2 F2 D R D L F' U L B'";
const other = "R' F2 B' L' F' R F D' L2 B2 D' R2 D2 R2 F2 R D2 F2";
let nextComp = 0;
const row = (group: string, scramble: string, overrides: Partial<WcaScrambleRow> = {}): WcaScrambleRow => ({
  event_id: '333', round_type_id: '2', group_id: group,
  is_extra: false, scramble_num: 3, scramble, ...overrides,
});
function match(rows: WcaScrambleRow[], scramble = official, event = '3x3') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => rows }));
  return fetchMatchingScrambleGroup(`group-match-${++nextComp}`, event, '2', 3, scramble);
}
afterEach(() => vi.unstubAllGlobals());

describe('recon group inference from published scrambles', () => {
  it('matches reconstruction 2796 to GuangzhouGrandOpen2026 round 2, attempt 3, group C', async () => {
    expect(await match([
      row('A', "B2 L2 F L2 B U2 R2 F2 L' D2 B D2 L U F' D' F2 L2 F"),
      row('B', other), row('C', official),
      row('D', "R' F R2 B2 L2 D2 L' U' R2 D' B2 U F2 U' R' F' D R2"),
      row('E', "L U' R2 U' F2 U2 F2 D2 L' U L B' F R' F' U' B' D2"),
    ])).toBe('C');
  });

  it('compares puzzle states when an equivalent scramble has different move text', async () => {
    expect(await match([row('B', other), row('C', official)], `${official} R R' // equivalent`)).toBe('C');
  });

  it('excludes other events, rounds, attempts and extra scrambles', async () => {
    expect(await match([
      row('A', official, { event_id: '333oh' }),
      row('B', official, { round_type_id: '1' }),
      row('C', official, { scramble_num: 2 }),
      row('D', official, { is_extra: true }),
      row('E', other),
    ])).toBeNull();
  });

  it('does not guess when two groups reach the same state', async () => {
    expect(await match([row('A', official), row('B', `${official} U U'`)])).toBeNull();
  });

  it('accepts combined round ids', async () => {
    expect(await match([row('C', official, { round_type_id: 'e' })])).toBe('C');
  });

  it('leaves invalid, empty and unmatched scrambles unresolved', async () => {
    for (const scramble of ['', '?', 'invalid', 'R', `${official} invalid`]) {
      expect(await match([row('C', official)], scramble), scramble).toBeNull();
    }
  });

  it('matches compact Square-1 notation using the shared notation adapter', async () => {
    expect(await match([row('A', '(1, 0) / (0, 3)', { event_id: 'sq1' })], '1/03', 'sq1')).toBe('A');
  });
});
