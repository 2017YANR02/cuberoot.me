import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { mirrorFamily, mirrorKeepsAmount } from '@cuberoot/shared/alg-notation';
import {
  CN_XCROSS_10_REPS, CN_XCROSS_10_SYMMETRY_ORDER, CN_XCROSS_10_TOTAL, CUBE_STATES,
} from '@/app/[lang]/scramble/hardest/_data/cn_xcross_10';

/**
 * 六色底 XCross = 10 的 438 个状态:把上游给的「23 条代表 + 438 条全表」这层关系现场证掉。
 *
 * 证的是**闭包与集合相等**:23 条代表在 48 元对称群(24 转体 × M 镜像)下展开、去重,
 * 必须逐个命中上游那 438 条,不多不少。这一步能挡住的错:代表抄漏一条、全表混进重复、
 * 某条代表其实和另一条对称等价(那样轨道并集就凑不满 438)。
 *
 * 证不了的是**穷尽性**(不存在第 439 个)—— 那要在 4.3e19 全空间上跑,见数据文件头注。
 * 「这 438 条确实都是六色底 10 步」由 solver 的 std_analyzer 本地实证,结论存进 fixture。
 */

interface Golden {
  total: number;
  all: string[];
  analyzer: { xcrossAllTen: boolean; crossHistogram: Record<string, number> };
}
const golden: Golden = JSON.parse(
  readFileSync(new URL('./fixtures/cn_xcross_10_golden.json', import.meta.url), 'utf8'),
);

/** M 面镜像:复用全站单一真源的 family 映射(带 M/x 豁免取反那条规则)。 */
function mirrorM(alg: string): string {
  const out: string[] = [];
  for (const m of new Alg(alg).experimentalLeafMoves()) {
    const family = mirrorFamily(m.family, 'M');
    const amount = mirrorKeepsAmount(m.family, 'M') ? m.amount : -m.amount;
    if (amount === 0) continue;
    out.push(m.modified({ family, amount }).toString());
  }
  return out.join(' ');
}

// 24 个转体 = 6 个「哪面朝上」× 4 个绕竖轴自转。
const ROTATIONS: string[] = [];
for (const orient of ['', 'x', 'x2', "x'", 'z', "z'"]) {
  for (const spin of ['', 'y', 'y2', "y'"]) ROTATIONS.push([orient, spin].filter(Boolean).join(' '));
}

const kpuzzle = await cube3x3x3.kpuzzle();

/** 状态指纹 —— 只取角/棱的位置与朝向,中心块朝向不参与(对本题无意义)。 */
function stateKey(alg: string): string {
  const d = kpuzzle.defaultPattern().applyAlg(alg).patternData;
  return JSON.stringify([d.CORNERS.pieces, d.CORNERS.orientation, d.EDGES.pieces, d.EDGES.orientation]);
}

/** 一条打乱在 48 元群下的整条轨道(转体走共轭 R S R',镜像走 mirrorM)。 */
function orbit(scramble: string): Set<string> {
  const out = new Set<string>();
  for (const variant of [scramble, mirrorM(scramble)]) {
    for (const r of ROTATIONS) {
      out.add(stateKey(r ? `${r} ${variant} ${new Alg(r).invert().toString()}` : variant));
    }
  }
  return out;
}

describe('六色底 XCross = 10:23 条代表 → 438 个状态', () => {
  it('转体集合恰好 24 个互不相同的姿态', () => {
    expect(new Set(ROTATIONS.map((r) => stateKey(r || ''))).size).toBe(24);
    expect(ROTATIONS.length).toBe(24);
    expect(CN_XCROSS_10_SYMMETRY_ORDER).toBe(48);
  });

  it('数据层自洽:23 条代表,轨道大小整除 48 且合计 438', () => {
    expect(CN_XCROSS_10_REPS.length).toBe(23);
    for (const r of CN_XCROSS_10_REPS) expect(48 % r.orbit).toBe(0);
    expect(CN_XCROSS_10_REPS.reduce((a, b) => a + b.orbit, 0)).toBe(CN_XCROSS_10_TOTAL);
    expect(CN_XCROSS_10_TOTAL).toBe(438);
    // 轨道分布:越对称的态轨道越小。改了代表表这行会红,是有意的 review 信号。
    const sizes = CN_XCROSS_10_REPS.map((r) => r.orbit).sort((a, b) => a - b).join(',');
    expect(sizes).toBe('6,6,6,6,6,6,6,12,12,12,12,12,12,12,24,24,24,24,24,48,48,48,48');
  });

  it('每条代表现场展开的轨道大小与数据层一致', () => {
    for (const r of CN_XCROSS_10_REPS) {
      expect(`${r.scramble} → ${orbit(r.scramble).size}`).toBe(`${r.scramble} → ${r.orbit}`);
    }
  });

  it('23 条轨道两两不相交(= 23 条代表互不对称等价)', () => {
    const owner = new Map<string, number>();
    CN_XCROSS_10_REPS.forEach((r, i) => {
      for (const k of orbit(r.scramble)) {
        expect(owner.get(k) ?? i).toBe(i);
        owner.set(k, i);
      }
    });
    expect(owner.size).toBe(438);
  });

  it('闭包 = 上游 438,逐个状态相等(不是只比个数)', () => {
    const closure = new Set<string>();
    for (const r of CN_XCROSS_10_REPS) for (const k of orbit(r.scramble)) closure.add(k);

    expect(golden.all.length).toBe(438);
    const upstream = new Set(golden.all.map((s) => stateKey(s)));
    expect(upstream.size).toBe(438); // 上游表里没有重复状态

    const missing = [...upstream].filter((k) => !closure.has(k));
    const extra = [...closure].filter((k) => !upstream.has(k));
    expect({ missing: missing.length, extra: extra.length }).toEqual({ missing: 0, extra: 0 });
  });

  it('概率与 Cube Odds 表的 9.87489e16 对得上', () => {
    // 43,252,003,274,489,856,000 / 438 = 9.8749e16
    const oneIn = Number(BigInt(CUBE_STATES) / BigInt(CN_XCROSS_10_TOTAL));
    expect(oneIn.toPrecision(6)).toBe('9.87489e+16');
  });

  it('solver 实证结论已归档:438×6 个 xcross 值全部为 10', () => {
    expect(golden.analyzer.xcrossAllTen).toBe(true);
    // 顺带锁住一个反直觉事实:XCross 全是 10,Cross 却不全是最难的 8 ——
    // 有一条轨道的部分底色只要 6 步十字。
    expect(golden.analyzer.crossHistogram).toEqual({ 6: 24, 8: 2604 });
  });
});
