import { describe, it, expect } from 'vitest';
import { computeMbfMo3 } from '@/lib/mbf-average';
import { formatWcaResult } from '@/lib/wca-format-result';

// Raw WCA attempt encodings:
//   old 1SSAATTTTT: SS=99-solved, AA=attempted, TTTTT=seconds (99999=unknown)
//   new  DDTTTTTMM: DD=99-difference, TTTTT=seconds, MM=missed
const fmtMo3 = (atts: number[]) => formatWcaResult(computeMbfMo3(atts), '333mbo', 'average');

describe('computeMbfMo3 — old-format / mixed 333mbo (was decoding to garbage)', () => {
  it('Dutch Open 2006: 5/5 1:00:00, 3/7 1:55:00, 2/6 1:25:00 → Mo3 4/7 1:26:40', () => {
    // 1_94_05_03600, 1_96_07_06900, 1_97_06_05100
    expect(fmtMo3([1940503600, 1960706900, 1970605100])).toBe('4/7 1:26:40');
  });

  it('Euro 2006 (all times unknown): 3/3 ?:??, 4/5 ?:??, 2/4 ?:?? → Mo3 3/4 ?:??', () => {
    // 1_96_03_99999, 1_95_05_99999, 1_97_04_99999  (matches the old hardcoded MBO_MO3)
    expect(fmtMo3([1960399999, 1950599999, 1970499999])).toBe('3/4 ?:??');
  });

  it('mixed old+new encodings in one round average sensibly (solved ≤ attempted)', () => {
    // old 5/5 1:00:00 + new 5/5 0:30 (920003000→? actually 5/5: new diff=5→DD=94, t=30, m=0) + old 3/7 1:55:00
    const v = computeMbfMo3([1940503600, 940003000, 1960706900]);
    const s = formatWcaResult(v, '333mbo', 'average');
    const m = /^(\d+)\/(\d+)\b/.exec(s)!;
    expect(Number(m[1])).toBeLessThanOrEqual(Number(m[2])); // never solved > attempted
  });
});

describe('computeMbfMo3 — 333mbf new-format unchanged (backward compat)', () => {
  it('Mo3 of three identical 7/7 0:30 = 7/7 0:30', () => {
    expect(formatWcaResult(computeMbfMo3([920003000, 920003000, 920003000]), '333mbf', 'average')).toBe('7/7 0:30');
  });
});

describe('computeMbfMo3 — guards', () => {
  it('fewer than 3 valid attempts → 0 (no average)', () => {
    expect(computeMbfMo3([1940503600, 1960706900])).toBe(0);
    expect(computeMbfMo3([1940503600, 0, 0])).toBe(0);
  });
  it('any DNF/DNS among the 3 → -1 (DNF average)', () => {
    expect(computeMbfMo3([1940503600, -1, 1960706900])).toBe(-1);
  });
});
