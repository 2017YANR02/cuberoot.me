/**
 * LL case 出现概率 —— 由旋转对称阶直接推出,不做群运算。
 *
 * 一个 case 是全体顶层状态在「起手 AUF × 收尾 AUF」(Z4×Z4,16 个元素)双边作用下的
 * 一条轨道。轨道-稳定子定理下,稳定子是 cn 阶循环群(表里的 `meta.sym.cn`),故
 * 轨道大小 = 16 / cn,概率 = 轨道大小 / 全集状态数。
 *
 * 全集状态数(顶层相对底两层的状态,含 AUF、含还原态):
 *   1LLL 62208 = 27(CO)×8(EO)×24(CP)×24(EP)/2(奇偶)
 *   ZBLL  7776 = 62208/8(EO 已解决)
 *   PLL    288 = 24×24/2(朝向已解决)
 *   ELL    384 = 4(角块 AUF 相位)×8(EO)×12(EP 与角奇偶匹配)
 *
 * 对账(2026-07-15,线上 API 实测):
 *   pll  21 例 Σ(16/cn)=284 = 288−4(还原态轨道)  → H/Na/Nb 1/72、E/Z 1/36、其余 1/18 全对
 *   zbll 472 例 Σ=7488 = 7776−288(PLL 态归 pll 集)
 *   ell  25 例 Σ=336 = 384−44(EPLL 归 pll)−4(还原)
 *   1lll 3397 例 Σ=54096;四集合计 62204 = 62208−4 ✓
 */
import type { AlgCase } from '@cuberoot/shared';

export interface AlgSetUniverse {
  /** 全集状态数(见文件头) */
  total: number;
  /** 全集名(展示用) */
  label: string;
}

/** 有意义的「本集概率」全集 —— 只有这四个 set 的 case 带 meta。 */
export const ALG_SET_UNIVERSE: Record<string, AlgSetUniverse> = {
  zbll: { total: 7776, label: 'ZBLL' },
  pll: { total: 288, label: 'PLL' },
  ell: { total: 384, label: 'ELL' },
  '1lll': { total: 62208, label: '1LLL' },
};

/** 全体顶层状态数(1LLL 全集)—— 四个 set 的 case 都活在这里面。 */
export const LL_UNIVERSE_TOTAL = 62208;

/**
 * case 的轨道大小(= 该 case 覆盖的状态数)。
 * 无 meta(f2l 等非 LL set)返回 null —— 概率对它们没有定义。
 * meta 在而 sym.cn 缺 = C1(无对称),轨道 16。
 */
export function caseOrbit(c: AlgCase): number | null {
  if (!c.meta) return null;
  const n = Number(c.meta.sym?.cn ?? '1');
  if (!Number.isFinite(n) || n <= 0 || 16 % n !== 0) return 16;
  return 16 / n;
}

/** 概率的单位分数形式:orbit/total 恒可约成 1/n(total 均为 16 的倍数)。 */
export function probabilityFraction(orbit: number, total: number): string {
  const g = gcd(orbit, total);
  const num = orbit / g;
  const den = total / g;
  return num === 1 ? `1/${den}` : `${num}/${den}`;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** 顶层还原态自己也是一条轨道:0 步、16/4 = 4 个状态(它的对称阶是 4)。 */
export const LL_SOLVED_ORBIT = { len: 0, states: 4, cases: 1 };

export type OptimalMetric = 'htm' | 'qtm' | 'stm' | 'sqtm';

export interface LlLengthBins {
  /** 步数 → 该步数的状态数(每个 case 记 16/cn 个) */
  byState: Record<number, number>;
  /** 步数 → 该步数的 case 数 */
  byCase: Record<number, number>;
  /** 计入的状态总数 / case 总数 */
  states: number;
  cases: number;
  /** 有 meta 但该度量下没有最优步数的 case —— 有一个就说明数据层缺口 */
  missing: number;
}

/**
 * 顶层最优步数分布:把四个 set 的 case 按轨道大小加权,得到「按状态计」的分布。
 *
 * 为什么要加权:对称 case(cn = 2 / 4)只覆盖 8 / 4 个状态,按 case 数画出来的直方图
 * 会把它们与普通 case 等同看待。日常遇到的概率是按状态算的,两条曲线因此并不一样。
 *
 * 还原态那条轨道不在任何公式集里,`includeSolved` 打开时补上(4 个状态、0 步),
 * 补上后总数正好 62,208 —— 这也是这个函数最强的自检。
 */
export function llOptimalBins(
  caseLists: AlgCase[][],
  metric: OptimalMetric = 'htm',
  includeSolved = true,
): LlLengthBins {
  const byState: Record<number, number> = {};
  const byCase: Record<number, number> = {};
  let states = 0;
  let cases = 0;
  let missing = 0;
  for (const list of caseLists) {
    for (const c of list) {
      const orbit = caseOrbit(c);
      if (orbit === null) continue;
      const len = c.meta?.optimal?.[metric]?.len;
      if (typeof len !== 'number') { missing++; continue; }
      byState[len] = (byState[len] ?? 0) + orbit;
      byCase[len] = (byCase[len] ?? 0) + 1;
      states += orbit;
      cases += 1;
    }
  }
  if (includeSolved) {
    const { len, states: s, cases: n } = LL_SOLVED_ORBIT;
    byState[len] = (byState[len] ?? 0) + s;
    byCase[len] = (byCase[len] ?? 0) + n;
    states += s;
    cases += n;
  }
  return { byState, byCase, states, cases, missing };
}

/** 按状态加权的平均步数。 */
export function llMeanLength(bins: LlLengthBins): number {
  const sum = Object.entries(bins.byState).reduce((acc, [len, n]) => acc + Number(len) * n, 0);
  return bins.states ? sum / bins.states : 0;
}
