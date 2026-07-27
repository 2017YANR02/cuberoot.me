import { describe, expect, it } from 'vitest';
import {
  CLASS_MEAN_TRAP, PARTIAL_SOLVE_FAMILIES, familyById, meanFraction, meanOf, totalOf,
} from '@/lib/partial-solve-god';

/**
 * 部分还原上帝之数的回归锁。
 *
 * 逐深度数字有两个来源,都必须锁死:
 *   - classCounts —— cuBerBruce 2011 公布的等价类计数(类数 1152 / 3272 由
 *     tests/partial_solve_god_solver.test.ts 现场复算对上);
 *   - stateCounts —— 本机对每个类代表跑最优解器(cube48opt + h48 剪枝表)、再按轨道大小
 *     加权得到,上游没有给过。
 *
 * 组合恒等式是白送的自检:类数 × 轨道大小、Σ counts、以及构造式本身。
 */

const C = (n: number, k: number): number => {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
};
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

describe('状态数的构造式', () => {
  it('角 5-循环 = C(8,5)·4!·3⁴ = 108,864', () => {
    expect(C(8, 5)).toBe(56);
    expect(fact(4)).toBe(24);
    expect(3 ** 4).toBe(81);
    expect(C(8, 5) * fact(4) * 3 ** 4).toBe(108864);
    expect(familyById('corner5').states).toBe(108864);
  });

  it('棱 5-循环 = C(12,5)·4!·2⁴ = 304,128', () => {
    expect(C(12, 5)).toBe(792);
    expect(2 ** 4).toBe(16);
    expect(C(12, 5) * fact(4) * 2 ** 4).toBe(304128);
    expect(familyById('edge5').states).toBe(304128);
  });

  // 5 个块的朝向和被定死 → 少一个自由度。写死这两条,免得哪天有人"补上"最后一位。
  it('朝向自由度是 base^4 而非 base^5', () => {
    expect(3 ** 5).not.toBe(81);
    expect(2 ** 5).not.toBe(16);
  });
});

describe('轨道结构', () => {
  it.each(PARTIAL_SOLVE_FAMILIES)('$id:Σ(类数 × 轨道大小) = 状态数', (f) => {
    const byOrbit = Object.entries(f.orbitSizes)
      .reduce((a, [size, n]) => a + Number(size) * n, 0);
    expect(byOrbit).toBe(f.states);
    const classes = Object.values(f.orbitSizes).reduce((a, b) => a + b, 0);
    expect(classes).toBe(f.classes);
  });

  // 96 = 48 个空间对称 × {恒等, 取逆}。轨道大小整除 96,且两族都真的出现了两种大小 ——
  // 只要还有 48 这一档,「每类一票」就永远不等于「每状态一票」。
  it.each(PARTIAL_SOLVE_FAMILIES)('$id:轨道大小整除 96,且不止一种', (f) => {
    for (const size of Object.keys(f.orbitSizes)) expect(96 % Number(size)).toBe(0);
    expect(Object.keys(f.orbitSizes).length).toBeGreaterThan(1);
  });
});

describe('角 5-循环 的两条分布', () => {
  const f = familyById('corner5');

  it('等价类计数逐位对齐 cuBerBruce 2011', () => {
    expect(f.classCounts).toEqual({ 10: 13, 11: 31, 12: 229, 13: 445, 14: 414, 15: 20 });
    expect(totalOf(f.classCounts)).toBe(f.classes);
  });

  it('状态计数(本机最优解 + 轨道加权)', () => {
    expect(f.stateCounts).toEqual({ 10: 1152, 11: 2976, 12: 21408, 13: 42144, 14: 39264, 15: 1920 });
    expect(totalOf(f.stateCounts)).toBe(f.states);
  });

  it('两条分布的支撑集与直径一致', () => {
    expect(Object.keys(f.stateCounts)).toEqual(Object.keys(f.classCounts));
    expect(Math.max(...Object.keys(f.stateCounts).map(Number))).toBe(f.diameter);
  });

  // 真平均 = 13 + 64/567。写成分数是因为它精确;小数只是它的近似。
  it('真平均 = 13 + 64/567 ≈ 13.1129', () => {
    expect(meanFraction(f.stateCounts)).toEqual({ whole: 13, num: 64, den: 567 });
    expect(meanOf(f.stateCounts).toFixed(7)).toBe('13.1128748');
  });

  /**
   * 表格 https://bit.ly/3x3odds 报的 13.10763889 —— 这条测试证明它不是"精度差一点",
   * 而是**算了另一个量**:把 1152 个大小不等的等价类当等权样本。数值逐位重现即为实锤。
   */
  it('表格那个平均值 = 类平均,不是真平均', () => {
    expect(meanOf(f.classCounts).toFixed(8)).toBe('13.10763889');
    expect(CLASS_MEAN_TRAP.corner5.published).toBe(13.10763889);
    expect(meanOf(f.classCounts)).toBeLessThan(meanOf(f.stateCounts));
  });
});

describe('棱 5-循环 的两条分布', () => {
  const f = familyById('edge5');

  it('等价类计数逐位对齐 cuBerBruce 2011', () => {
    expect(f.classCounts).toEqual({
      6: 3, 7: 5, 8: 23, 9: 57, 10: 248, 11: 579, 12: 1212, 13: 1011, 14: 132, 15: 2,
    });
    expect(totalOf(f.classCounts)).toBe(f.classes);
  });

  it('状态计数(本机最优解 + 轨道加权)', () => {
    expect(f.stateCounts).toEqual({
      6: 192, 7: 480, 8: 2112, 9: 5472, 10: 22992,
      11: 54144, 12: 112800, 13: 93936, 14: 11904, 15: 96,
    });
    expect(totalOf(f.stateCounts)).toBe(f.states);
    expect(Object.keys(f.stateCounts)).toEqual(Object.keys(f.classCounts));
  });

  it('真平均 = 11 + 2039/2112 ≈ 11.9654', () => {
    expect(meanFraction(f.stateCounts)).toEqual({ whole: 11, num: 2039, den: 2112 });
    expect(meanOf(f.stateCounts).toFixed(7)).toBe('11.9654356');
  });

  // 与角族同一个病:表格报的数逐位就是类平均。两族都中,说明是口径错而非抄错。
  it('表格那个平均值 = 类平均,不是真平均', () => {
    expect(meanOf(f.classCounts)).toBeCloseTo(CLASS_MEAN_TRAP.edge5.published, 9);
    expect(meanOf(f.classCounts)).toBeGreaterThan(meanOf(f.stateCounts));
  });

  it('两族直径同为 15,但棱族最浅能到 6 步', () => {
    expect(f.diameter).toBe(15);
    expect(Math.min(...Object.keys(f.classCounts).map(Number))).toBe(6);
    expect(Math.min(...Object.keys(familyById('corner5').classCounts).map(Number))).toBe(10);
  });
});
