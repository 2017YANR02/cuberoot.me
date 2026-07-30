// case 短链。两条容易踩的:
//   1. 结尾的 `-` 是**名字的一部分**(`L-` 和 `L` 是两张不同的 OLL),不能跟分隔用的 `-` 一起削掉;
//   2. 削法改了,以前发出去的链接得继续落地 —— 靠 buildCaseSlugMap 补的别名。
import { describe, it, expect } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import {
  buildCaseSlugMap, caseSlugBase, resolveCaseSlug, slugifyCasePart,
} from '@/lib/alg_case_link';
import { OLL_NAME_BY_NUMBER } from '@/lib/alg_case_display';

const mk = (id: number, name: string, extra: Partial<AlgCase> = {}): AlgCase =>
  ({ id, name, subgroup: '', algs: [], ...extra }) as unknown as AlgCase;

const ollCases = Array.from({ length: 57 }, (_, i) =>
  mk(1000 + i, `OLL ${i + 1}`, { subgroup: 'Dot Case' }));

describe('slugifyCasePart', () => {
  it('原串自带的首尾 +/- 留着', () => {
    expect(slugifyCasePart('S+')).toBe('s+');
    expect(slugifyCasePart('S-')).toBe('s-');
    expect(slugifyCasePart('L-')).toBe('l-');
    expect(slugifyCasePart('L')).toBe('l');
  });

  it('替换出来的分隔 `-` 照旧削掉', () => {
    expect(slugifyCasePart("C T'")).toBe('c-t');
    expect(slugifyCasePart('OLL 27')).toBe('oll-27');
    expect(slugifyCasePart('  Sune  ')).toBe('sune');
    expect(slugifyCasePart('Adj / O-')).toBe('adj---o-');
  });
});

describe('OLL 短链用社区名', () => {
  it('OLL 1 → dh,不是 oll-1', () => {
    expect(caseSlugBase('oll', ollCases[0])).toBe('dh');
    expect(caseSlugBase('oll', ollCases[26])).toBe('s+');
  });

  it('57 张各不相同 —— L-(16) 与 L(25) 不能撞', () => {
    const map = buildCaseSlugMap(ollCases, 'oll');
    const slugs = ollCases.map((c) => map.byId.get(c.id!)!);
    expect(new Set(slugs).size).toBe(57);
    expect(slugs[15]).toBe('l-');
    expect(slugs[24]).toBe('l');
    // 每一张都等于卡面上那个社区名,没有被 `-2` 之类的去重后缀污染。
    for (let n = 1; n <= 57; n++) {
      expect(slugs[n - 1]).toBe(slugifyCasePart(OLL_NAME_BY_NUMBER[n]));
    }
  });

  it('落地:dh / s+ / l- 都认,老的 oll-1 也还认', () => {
    expect(resolveCaseSlug(ollCases, 'dh', '3x3', 'oll')?.name).toBe('OLL 1');
    expect(resolveCaseSlug(ollCases, 'S+', '3x3', 'oll')?.name).toBe('OLL 27');
    expect(resolveCaseSlug(ollCases, 'l-', '3x3', 'oll')?.name).toBe('OLL 16');
    expect(resolveCaseSlug(ollCases, 'l', '3x3', 'oll')?.name).toBe('OLL 25');
    // 改名前发出去的链接 —— findCaseByHash 按 case 名兜住。
    expect(resolveCaseSlug(ollCases, 'oll-1', '3x3', 'oll')?.name).toBe('OLL 1');
    expect(resolveCaseSlug(ollCases, 'oll-57', '3x3', 'oll')?.name).toBe('OLL 57');
    expect(resolveCaseSlug(ollCases, 'oll-99', '3x3', 'oll')).toBeNull();
  });
});

describe('老 slug 别名', () => {
  // F2L 的 `A-` 以前是 `a`,现在是 `a-`;两个都得落到同一张。
  const f2l = [mk(1, 'A+'), mk(2, 'A-'), mk(3, 'B-')];

  it('生成端只用新 slug', () => {
    const map = buildCaseSlugMap(f2l, 'f2l');
    expect(map.byId.get(2)).toBe('a-');
    expect(map.byId.get(3)).toBe('b-');
  });

  it('落地端新老都收', () => {
    expect(resolveCaseSlug(f2l, 'a-', '3x3', 'f2l')?.name).toBe('A-');
    expect(resolveCaseSlug(f2l, 'a', '3x3', 'f2l')?.name).toBe('A-');
    expect(resolveCaseSlug(f2l, 'a+', '3x3', 'f2l')?.name).toBe('A+');
  });

  it('别名抢不走规范 slug', () => {
    // `L-` 的老 slug 是 `l`,但 `l` 已经是 OLL 25 的规范 slug —— 别名不许覆盖。
    const map = buildCaseSlugMap(ollCases, 'oll');
    expect(map.bySlug.get('l')?.name).toBe('OLL 25');
  });
});

describe('别的 set 没被改到', () => {
  it('PLL 仍按 case 名', () => {
    const pll = [mk(1, 'Aa'), mk(2, 'Gc')];
    expect(caseSlugBase('pll', pll[0])).toBe('aa');
    expect(caseSlugBase('pll', pll[1])).toBe('gc');
  });

  it('有 mark 的仍优先用 mark(剥 SET- 前缀)', () => {
    const c = mk(1, 'ZBLL U 3', { meta: { ollcp: 'ZBLL-UR3' } } as Partial<AlgCase>);
    expect(caseSlugBase('zbll', c)).toBe('ur3');
  });
});
