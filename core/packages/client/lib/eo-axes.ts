/**
 * 三轴坏棱的联合分布 —— 一个打乱同时对 F/B、U/D、R/L 三个轴各有多少条坏棱。
 *
 * 为什么值得单独算:大家熟悉的「平均 6 条坏棱」是**每个轴各自**的平均,但三个轴不独立
 * —— (4,6,6) 和 (6,6,8) 都比 (6,6,6) 更常见,而三个轴里最少的那个平均只有 4.7 条。
 * ZZ / DR 选轴时看的正是那个 min。
 *
 * 全集 70,963,200 = 12!/(4!·4!·4!) × 2¹¹ = 34,650 × 2,048:
 * 坏棱数只取决于「每个位置上的棱来自哪个层(M/E/S)」+ 那条棱的朝向位,
 * 层内谁在哪儿、角块什么样都不影响。
 *
 * 每条棱对三个轴的坏/好,只由 **{它家所在层, 它现在所在层}** 这个无序对与朝向位决定 ——
 * 这张 18 项小表是从 cubing.js 的三阶模型现场读出来的(把状态绕 x / y 共轭后再读朝向位),
 * `tests/eo_axes.test.ts` 每次跑都重读一遍并断言与这里一致,不是手抄的:
 *
 *   同层            → (o, o, o)
 *   {E,M}           → (o, 1−o, 1−o)
 *   {E,S}           → (o, o, 1−o)
 *   {M,S}           → (o, 1−o, o)
 *
 * 其中 o = 该棱在 F/B 轴意义下的朝向位(cubing.js 原生的那一位)。
 * 于是整条分布就是「3×3 列联表 × 四组二项卷积」,毫秒级算完,不需要枚举 7,096 万个状态。
 */

/** 层序:0 = E(UD 轴那一层,FR/FL/BR/BL),1 = M(RL 轴,UF/UB/DF/DB),2 = S(FB 轴,UR/UL/DR/DL)。 */
export const EO_SLICES = ['E', 'M', 'S'] as const;

/** 全集大小 = 12!/(4!·4!·4!) × 2¹¹。 */
export const EO_AXIS_UNIVERSE = 70963200;

/** 一条棱对 (U/D, R/L) 两轴的「翻转与否」相对 F/B 朝向位的偏移,按无序层对查表。 */
const PAIR_OFFSET: Record<string, [number, number]> = {
  'E|E': [0, 0], 'M|M': [0, 0], 'S|S': [0, 0],
  'E|M': [1, 1], 'M|E': [1, 1],
  'E|S': [0, 1], 'S|E': [0, 1],
  'M|S': [1, 0], 'S|M': [1, 0],
};

export function pairOffset(homeSlice: string, slotSlice: string): [number, number] {
  return PAIR_OFFSET[`${homeSlice}|${slotSlice}`];
}

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const choose = (n: number, k: number): number =>
  (k < 0 || k > n ? 0 : fact(n) / (fact(k) * fact(n - k)));

/** 行和列和都是 4 的 3×3 列联表:N[家所在层][现在所在层]。 */
export function contingencyTables(): number[][][] {
  const out: number[][][] = [];
  // 前两行自由,第三行由列和定死;行和必须为 4
  for (let a = 0; a <= 4; a++) for (let b = 0; a + b <= 4; b++) {
    const r0 = [a, b, 4 - a - b];
    for (let c = 0; c <= 4; c++) for (let d = 0; c + d <= 4; d++) {
      const r1 = [c, d, 4 - c - d];
      const r2 = [4 - r0[0] - r1[0], 4 - r0[1] - r1[1], 4 - r0[2] - r1[2]];
      if (r2.some((v) => v < 0)) continue;
      out.push([r0, r1, r2]);
    }
  }
  return out;
}

/** 该列联表对应多少种「位置 → 家所在层」的分配:每个位置层里选谁装哪一类。 */
export function tableWays(N: number[][]): number {
  let w = 1;
  for (let p = 0; p < 3; p++) {
    w *= fact(4) / (fact(N[0][p]) * fact(N[1][p]) * fact(N[2][p]));
  }
  return w;
}

export interface EoAxisCombo {
  /** 升序排好的三元组,与表格口径一致(不区分是哪个轴)。 */
  triple: [number, number, number];
  count: number;
}

/** 联合分布:按「升序三元组」聚合。65 个组合,总和 = EO_AXIS_UNIVERSE。 */
export function eoAxisJoint(): EoAxisCombo[] {
  const acc = new Map<string, number>();
  for (const N of contingencyTables()) {
    const ways = tableWays(N);
    // 四组:同层 / {E,M} / {E,S} / {M,S};组内每条棱的偏移相同
    const cSame = N[0][0] + N[1][1] + N[2][2];
    const cEM = N[0][1] + N[1][0];
    const cES = N[0][2] + N[2][0];
    const cMS = N[1][2] + N[2][1];
    for (let k0 = 0; k0 <= cSame; k0++) {
      for (let k1 = 0; k1 <= cEM; k1++) {
        for (let k2 = 0; k2 <= cES; k2++) {
          for (let k3 = 0; k3 <= cMS; k3++) {
            if ((k0 + k1 + k2 + k3) % 2 !== 0) continue; // 朝向总和必须是偶数
            const w = ways * choose(cSame, k0) * choose(cEM, k1) * choose(cES, k2) * choose(cMS, k3);
            if (w === 0) continue;
            const x = k0 + k1 + k2 + k3;                          // F/B
            const y = k0 + (cEM - k1) + k2 + (cMS - k3);          // U/D
            const z = k0 + (cEM - k1) + (cES - k2) + k3;          // R/L
            const key = [x, y, z].sort((a, b) => a - b).join(',');
            acc.set(key, (acc.get(key) ?? 0) + w);
          }
        }
      }
    }
  }
  return [...acc].map(([k, count]) => ({
    triple: k.split(',').map(Number) as [number, number, number],
    count,
  })).sort((a, b) => b.count - a.count || a.triple[0] - b.triple[0]);
}

/** 单个轴的边际分布:坏棱数 → 状态数。偶数档才有值。 */
export function eoAxisMarginal(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const { triple, count } of eoAxisJoint()) {
    // 升序三元组代表的是无序多重集,单轴边际要把三个位置都算进去
    for (const v of triple) out[v] = (out[v] ?? 0) + count;
  }
  // 最后统一除以 3(先除会掉浮点精度:count/3 不是整数)
  for (const k of Object.keys(out)) out[Number(k)] /= 3;
  return out;
}

/** 三个轴里最少的那个的分布 —— ZZ / DR 真正关心的量。 */
export function eoAxisMinDist(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const { triple, count } of eoAxisJoint()) {
    const m = Math.min(...triple);
    out[m] = (out[m] ?? 0) + count;
  }
  return out;
}

export function meanOfDist(d: Record<number, number>): number {
  let n = 0, s = 0;
  for (const [k, v] of Object.entries(d)) { n += v; s += Number(k) * v; }
  return s / n;
}
