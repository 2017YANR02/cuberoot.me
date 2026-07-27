/**
 * LSLL 三类(两步路线)模型回归 —— lib/lsll/class3.ts。
 *
 * 数字口径本身锁在 tests/lsll_class3_structure.test.ts(306 × 494 = 151,164 与公式表无关);
 * 本文件锁的是**实现**:枚举出来的 306 / 494 与站内公式库逐条对得上。
 * 两条闭环是真正的证据 —— 模型是纯组合枚举,DB 是人工录入的公式集,两边独立:
 *   · 306 个 ZBLS 构型 ↔ zbls 集 305 案(差的那 1 个就是全解构型),且分组逐个相等;
 *   · 494 个 ZBLL case ↔ zbll 集 472 + pll 集 21 = 493(差的那 1 个就是跳过)。
 */
import { describe, expect, it } from 'vitest';
import { CATEGORIES, keyFromString, keyToString, unpackState, decodeKey, canonicalKey } from '@/lib/lsll/model';
import {
  ZBLS_CASE_COUNT, ZBLL_CASE_COUNT, TOTAL_CASES_CLASS3,
  allZblsCases, allZbllCases, listedZblsCases, listedClass3Total,
  zblsCasesForFamily, class3CountForFamily,
  phiOfState, zblsCaseByCode, zblsLibRefs, zbllLibRefs,
  zblsCardFacelets, zbllCardFacelets,
} from '@/lib/lsll/class3';
import zblsOverlay from '@/lib/lsll/zbls_algs.json';
import zbllOverlay from '@/lib/lsll/zbll_algs.json';

const zblsDb = zblsOverlay as Record<string, { name: string; subgroup: string }[]>;
const zbllDb = zbllOverlay as Record<string, { set: string; name: string; slug: string; algCount: number }[]>;

describe('lsll class 3 — ZBLS 构型枚举', () => {
  it('306 个,pre-AUF 轨道谱 297 / 3 / 6', () => {
    const cases = allZblsCases();
    expect(cases.length).toBe(ZBLS_CASE_COUNT);
    expect(cases.length).toBe(306);
    const spec: Record<number, number> = {};
    for (const z of cases) spec[z.stab] = (spec[z.stab] ?? 0) + 1;
    expect(spec).toEqual({ 1: 297, 2: 3, 4: 6 });
    // 轨道大小之和 = 构型空间 |Φ|
    expect(297 * 4 + 3 * 2 + 6 * 1).toBe(1200);
  });

  it('恰好一个全解构型,且落在 O 大类', () => {
    const solved = allZblsCases().filter((z) => z.solved);
    expect(solved.length).toBe(1);
    expect(solved[0].family).toBe('o');
    expect(solved[0].eoBad).toBe(0);
  });

  it('分组数逐个等于 zbls 库(全解那格只在模型里)', () => {
    const dbCount: Record<string, number> = {};
    for (const refs of Object.values(zblsDb)) for (const r of refs) dbCount[r.subgroup] = (dbCount[r.subgroup] ?? 0) + 1;
    expect(Object.keys(dbCount).length).toBe(42);
    for (const cat of CATEGORIES) {
      const expected = (dbCount[cat.letter] ?? 0) + (cat.slug === 'o' ? 1 : 0);
      expect(zblsCasesForFamily(cat.slug).length, cat.letter).toBe(expected);
    }
    // TT/CS/ES 每类 8,SS 里 e=0 的(O / D±)4、e=1 的(F / C±)2。
    expect(zblsCasesForFamily('ap').length).toBe(8);
    expect(zblsCasesForFamily('o').length).toBe(4);
    expect(zblsCasesForFamily('dp').length).toBe(4);
    expect(zblsCasesForFamily('f').length).toBe(2);
    expect(zblsCasesForFamily('cm').length).toBe(2);
    expect(CATEGORIES.reduce((s, c) => s + zblsCasesForFamily(c.slug).length, 0)).toBe(306);
  });

  it('zbls 库 305 条 setup 各自落到不同构型,且大类判定一致', () => {
    const seen = new Set<number>();
    const letterOf = new Map(CATEGORIES.map((c) => [c.letter, c.slug]));
    for (const [ks, refs] of Object.entries(zblsDb)) {
      const key = keyFromString(ks)!;
      const phi = phiOfState(unpackState(key));
      expect(seen.has(phi), `${refs[0].subgroup} ${refs[0].name} 与别的 case 撞了构型`).toBe(false);
      seen.add(phi);
      const z = allZblsCases().find((x) => x.id === phi);
      expect(z, ks).toBeDefined();
      expect(z!.family, `${refs[0].subgroup} ${refs[0].name}`).toBe(letterOf.get(refs[0].subgroup));
      expect(z!.solved).toBe(false);
      expect(zblsLibRefs(phi)?.[0]?.name).toBe(refs[0].name);
    }
    expect(seen.size).toBe(305);
    expect(allZblsCases().filter((z) => !seen.has(z.id))).toHaveLength(1);
  });

  it('构型 id 对首 AUF 不变(拿真 model 的 16 个像验)', () => {
    for (const ks of Object.keys(zblsDb).slice(0, 40)) {
      const st = unpackState(keyFromString(ks)!);
      const phi = phiOfState(st);
      // canonicalKey 已经是 16 个像的最小者;换一个像(重新解码 canonical)必须同构型。
      expect(phiOfState(unpackState(canonicalKey(st)))).toBe(phi);
      expect(zblsCaseByCode(phi.toString(36))?.id).toBe(phi);
    }
  });
});

describe('lsll class 3 — ZBLL case 枚举', () => {
  it('494 个,全是合法且已 canonical 的 key', () => {
    const zbll = allZbllCases();
    expect(zbll.length).toBe(ZBLL_CASE_COUNT);
    for (const k of zbll) {
      const st = decodeKey(k);
      expect(st, String(k)).not.toBeNull();
      expect(canonicalKey(st!)).toBe(k);
      // ZBLL 态:槽对归位 + 顶层 EO 全正。
      expect(st!.cp[4]).toBe(4);
      expect(st!.co[4]).toBe(0);
      expect(st!.ep[4]).toBe(4);
      expect(st!.eo).toEqual([0, 0, 0, 0, 0]);
    }
  });

  it('zbll 集 472 + pll 集 21 = 493 全部命中,剩下的那 1 个是跳过', () => {
    const bySet: Record<string, number> = {};
    for (const refs of Object.values(zbllDb)) for (const r of refs) bySet[r.set] = (bySet[r.set] ?? 0) + 1;
    expect(bySet).toEqual({ zbll: 472, pll: 21 });
    expect(Object.keys(zbllDb).length).toBe(493);

    const inside = allZbllCases().map((k) => keyToString(k));
    const set = new Set(inside);
    for (const k of Object.keys(zbllDb)) expect(set.has(k), k).toBe(true);
    const uncovered = inside.filter((k) => !zbllDb[k]);
    expect(uncovered.length).toBe(1);
    const st = decodeKey(keyFromString(uncovered[0])!)!;
    expect(st.cp).toEqual([0, 1, 2, 3, 4]);
    expect(st.co).toEqual([0, 0, 0, 0, 0]);
    expect(st.ep).toEqual([0, 1, 2, 3, 4]);
  });

  it('每条库引用结构完整,且 zbllLibRefs 按 key 取得到', () => {
    for (const [k, refs] of Object.entries(zbllDb)) {
      expect(refs.length, k).toBe(1);
      expect(zbllLibRefs(k)?.[0]?.name).toBe(refs[0].name);
      for (const r of refs) {
        expect(['zbll', 'pll']).toContain(r.set);
        expect(r.slug, r.name).toMatch(/^[a-z0-9+-]+$/);
        expect(r.algCount).toBeGreaterThanOrEqual(1);
      }
    }
    expect(zbllLibRefs('nope')).toBeNull();
  });
});

describe('lsll class 3 — 计数与出图', () => {
  it('N₃ = 306 × 494 = 151,164,按大类求和相同', () => {
    expect(TOTAL_CASES_CLASS3).toBe(151164);
    expect(ZBLS_CASE_COUNT * ZBLL_CASE_COUNT).toBe(151164);
    expect(CATEGORIES.reduce((s, c) => s + class3CountForFamily(c.slug), 0)).toBe(151164);
    expect(class3CountForFamily('ap')).toBe(3952);
    expect(class3CountForFamily('o')).toBe(1976);
    expect(class3CountForFamily('f')).toBe(988);
  });

  it('站上列 302 × 494 = 149,188 —— O 类那 4 个构型对子已在槽里,不算最后一槽', () => {
    expect(listedZblsCases()).toHaveLength(302);
    expect(listedZblsCases().some((z) => z.family === 'o')).toBe(false);
    expect(allZblsCases().length - listedZblsCases().length).toBe(4);
    expect(listedClass3Total()).toBe(149188);
    expect(TOTAL_CASES_CLASS3 - listedClass3Total()).toBe(class3CountForFamily('o'));
  });

  it('两半的图都是 54 位合法 fd 串', () => {
    const ok = /^[urfdlbo]{54}$/;
    for (const z of allZblsCases()) expect(ok.test(zblsCardFacelets(z.id)), z.code).toBe(true);
    for (const k of allZbllCases().slice(0, 60)) expect(ok.test(zbllCardFacelets(k)), String(k)).toBe(true);
  });

  it('ZBLS 图:顶层棱只画朝向(正 = U 面黄,翻 = 侧面黄),槽外全灰', () => {
    // 全解构型:U 面 4 条棱全黄、4 个角全灰,四周顶排全灰。
    const solved = allZblsCases().find((z) => z.solved)!;
    const fd = zblsCardFacelets(solved.id);
    expect([1, 3, 5, 7].map((i) => fd[i]).join('')).toBe('uuuu');
    expect([0, 2, 6, 8].map((i) => fd[i]).join('')).toBe('oooo');
    for (const side of [9, 18, 36, 45]) expect(fd.slice(side, side + 3)).toBe('ooo');

    // 不变量:5 个棱位共 10 片贴纸里恰好 4 片黄 —— 4 条顶层棱各露一片(朝上或朝侧),
    // 槽棱那条画的是实色(F/R),不掺黄。翻错一条棱只会把黄从 U 面挪到侧面,不会凭空多出来。
    const EDGE_FACELETS = [[5, 10], [7, 19], [3, 37], [1, 46], [23, 12]];
    const ssFamilies = new Set(CATEGORIES.filter((c) => c.kind === 'SS').map((c) => c.slug));
    for (const z of allZblsCases()) {
      const g = zblsCardFacelets(z.id);
      const yellow = EDGE_FACELETS.flat().filter((i) => g[i] === 'u').length;
      expect(yellow, z.code).toBe(4);
      // 槽对都在槽里时(SS),4 条顶层棱全在 U 面上,翻几条就少几片黄。
      if (ssFamilies.has(z.family)) {
        expect([1, 3, 5, 7].filter((i) => g[i] === 'u').length, z.code).toBe(4 - z.eoBad);
      }
    }
  });

  it('ZBLL 图:顶面全黄(EO 已正),F2L 是实色', () => {
    for (const k of allZbllCases().slice(0, 40)) {
      const fd = zbllCardFacelets(k);
      expect([1, 3, 5, 7].map((i) => fd[i]).join('')).toBe('uuuu'); // 4 条顶层棱都朝上
      expect(fd.slice(27, 36)).toBe('ddddddddd');                   // D 面还原
    }
  });
});
