/**
 * /scramble/symmetry 搜索引擎回归测试(SymSearch.pas 的移植)。
 *
 * 最硬的判据:对高对称类型做"恰好这个对称"的穷尽搜索,结果条数必须等于
 * Cube Explorer 自带的 symInfo1 表(SymSearch.pas)。这是跨实现的独立对照。
 */

import { describe, it, expect } from 'vitest';
import { searchSymmetric, type SymSearchOptions } from '@/app/[lang]/scramble/symmetry/_sym_search';
import {
  SYM_TYPES, classifyCube, symMask, maskOrder, normalizer, conjugateCount, canonicalKey,
} from '@/app/[lang]/scramble/symmetry/_sym_core';
import { faceletToCubie, validateFacelet } from '@/lib/cube-facelet';

function run(over: Partial<SymSearchOptions>): string[] {
  const out: string[] = [];
  searchSymmetric(
    {
      symMask: 1n,
      asymMask: 0n,
      exactSym: true,
      exactAsym: false,
      noSelfInverse: false,
      colorCounts: [true, true, true, true, true, true],
      permMode: 'all',
      continuous: false,
      allowIsomorphics: true,
      isoIncludeInverse: false,
      maxResults: 100000,
      ...over,
    },
    { onResult: (f) => out.push(f) },
  );
  return out;
}

const typeByName = (n: string) => SYM_TYPES.find((t) => t.name === n)!;

describe('穷尽搜索的条数 = 上游 symInfo1 表', () => {
  // 只跑规模可控的高对称类型;低对称类型的状态数是天文数字。
  const cases = [
    'Oh', 'O', 'Td', 'D3d', 'Th', 'C3v', 'T', 'D4h', 'D3', 'S6',
    'D4', 'D2d(face)', 'C4v', 'C4h', 'D2h(edge)', 'D2d(edge)', 'D2h(face)',
  ];
  for (const name of cases) {
    it(`${name}:⊇ 该子群 = symInfo1,恰好等于 = exact`, () => {
      const t = typeByName(name);
      const loose = run({ symMask: t.mask, exactSym: false });
      expect(loose).toHaveLength(Number(t.atLeast));
      for (const f of loose) {
        expect(validateFacelet(f)).toBeNull();
        expect(symMask(faceletToCubie(f)) & t.mask).toBe(t.mask);
      }
      const exact = run({ symMask: t.mask, exactSym: true });
      expect(exact).toHaveLength(Number(t.exact));
      for (const f of exact) {
        expect(SYM_TYPES[classifyCube(faceletToCubie(f))].name).toBe(name);
      }
    });
  }
});

describe('搜索选项', () => {
  it('不加 exact 时,多出来的正好是"更高对称"的状态', () => {
    const t = typeByName('D4h');
    const loose = run({ symMask: t.mask, exactSym: false });
    const exact = run({ symMask: t.mask, exactSym: true });
    const higher = new Set(loose);
    for (const f of exact) higher.delete(f);
    expect(higher.size).toBe(loose.length - exact.length);
    for (const f of higher) {
      expect(maskOrder(symMask(faceletToCubie(f)))).toBeGreaterThan(t.order);
    }
  });

  it('每面颜色数筛选生效', () => {
    const t = typeByName('D4h');
    const res = run({ symMask: t.mask, colorCounts: [true, true, false, false, false, false] });
    expect(res.length).toBeGreaterThan(0);
    for (const f of res) {
      for (let face = 0; face < 6; face++) {
        const colors = new Set(f.slice(face * 9, face * 9 + 9).split(''));
        expect(colors.size).toBeLessThanOrEqual(2);
      }
    }
    expect(res.length).toBeLessThan(Number(t.exact));
  });

  it('只置换棱 / 只置换角', () => {
    const t = typeByName('D4h');
    for (const f of run({ symMask: t.mask, permMode: 'edgesEven' })) {
      const c = faceletToCubie(f);
      expect(c.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(c.co).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    }
    for (const f of run({ symMask: t.mask, permMode: 'cornersEven' })) {
      const c = faceletToCubie(f);
      expect(c.ep).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(c.eo).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
  });

  it('奇置换模式产出的仍是合法(显示已修正)状态', () => {
    let total = 0;
    for (const name of ['C4', 'C2(a)', 'D4h', 'C4v']) {
      const t = typeByName(name);
      for (const mode of ['edgesOdd', 'cornersOdd'] as const) {
        const res = run({ symMask: t.mask, permMode: mode, exactSym: false, maxResults: 200 });
        total += res.length;
        for (const f of res) expect(validateFacelet(f)).toBeNull();
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it('同构去重:结果两两不同构', () => {
    const t = typeByName('C4v');
    const raw = run({ symMask: t.mask });
    const dedup = run({ symMask: t.mask, allowIsomorphics: false });
    expect(dedup.length).toBeGreaterThan(0);
    expect(dedup.length).toBeLessThan(raw.length);
    // 每个保留下来的结果,其 48 元轨道互不相交
    const orbits = new Set<string>();
    for (const f of dedup) {
      const c = faceletToCubie(f);
      const key = canonicalKey(c, Array.from({ length: 48 }, (_, i) => i), false);
      expect(orbits.has(key)).toBe(false);
      orbits.add(key);
    }
  });

  it('自逆约束:asymMask 含恒等 ⟹ 结果都是对合', () => {
    const t = typeByName('D4h');
    const res = run({ symMask: t.mask, asymMask: 1n });
    expect(res.length).toBeGreaterThan(0);
    for (const f of res) {
      const c = faceletToCubie(f);
      for (let i = 0; i < 8; i++) expect(c.cp[c.cp[i]]).toBe(i);
      for (let i = 0; i < 12; i++) expect(c.ep[c.ep[i]]).toBe(i);
    }
  });

  it('No Selfinverse 排掉所有对合', () => {
    const t = typeByName('D4h');
    const res = run({ symMask: t.mask, noSelfInverse: true });
    for (const f of res) {
      const c = faceletToCubie(f);
      const selfInv = c.cp.every((v, i) => c.cp[v] === i && (c.co[v] + c.co[i]) % 3 === 0)
        && c.ep.every((v, i) => c.ep[v] === i && (c.eo[v] + c.eo[i]) % 2 === 0);
      expect(selfInv).toBe(false);
    }
  });

  it('maxResults 截断', () => {
    const t = typeByName('D4h');
    const out: string[] = [];
    const stats = searchSymmetric(
      {
        symMask: t.mask, asymMask: 0n, exactSym: true, exactAsym: false, noSelfInverse: false,
        colorCounts: [true, true, true, true, true, true], permMode: 'all', continuous: false,
        allowIsomorphics: true, isoIncludeInverse: false, maxResults: 5,
      },
      { onResult: (f) => out.push(f) },
    );
    expect(out).toHaveLength(5);
    expect(stats.truncated).toBe(true);
  });
});

describe('共轭类计数自洽', () => {
  it('Σ(exact × 共轭个数) = 魔方状态总数', () => {
    let sum = 0n;
    for (const t of SYM_TYPES) sum += t.exact * BigInt(conjugateCount(t.mask));
    expect(sum).toBe(43252003274489856000n);
  });

  it('共轭个数 = 48 / |N(H)|', () => {
    for (const t of SYM_TYPES) {
      expect(conjugateCount(t.mask)).toBe(48 / maskOrder(normalizer(t.mask)));
    }
  });
});
