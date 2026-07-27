/**
 * 「跳步」概率的单一真源 —— 每一条都由状态空间**现算**,不写死小数。
 *
 * 为什么要现算:同一批数字站内原本散落在好几处,彼此对不上,而且抄错了不会有人发现。
 * 这里把每条概率都还原成「合法状态数 / 全集大小」的整数比(BigInt),小数只是它的展示形式。
 * 谁改坏了,tests/skip_probability.test.ts 立刻红。
 *
 * 三类来源,页面上分开标:
 *   - `counted`  顶层全集直接数出来(62,208 那一族),纯组合;
 *   - `exact`    全状态空间穷举 / 容斥算出来的精确整数比(十字族、2×2×2 块);
 *   - `sim`      只有模拟值(条件概率那一类,如「解出十字时顺手带出一对 F2L」),标注样本来源。
 */

import { CUBE3_STATES } from './god-distance-333';

// ── 顶层(LL)全集 ─────────────────────────────────────────────────────
// F2L 做完后剩四个自由度:角朝向 3³(第 4 个由和定死)、棱朝向 2³、角排列 4!、棱排列 4!,
// 角/棱排列的奇偶必须相同 → 4!·4!/2。62,208 与 /math/probability 的 UniverseBuilder 同源。
export const LL_CO = 3 ** 3;          // 27
export const LL_EO = 2 ** 3;          // 8
export const LL_PERM = (24 * 24) / 2; // 288
export const LL_UNIVERSE = LL_CO * LL_EO * LL_PERM; // 62,208
/** AUF:整条解法可以在收尾时任意转 U 层,所以「还原」在全集里对应 4 个状态。 */
export const AUF = 4;

// ── 2×2×2 块 ────────────────────────────────────────────────────────
// 一个 2×2×2 块 = 1 个角 + 与它同属三面的 3 条棱(中心块在三阶上是固定参照,不计)。
// 邻接表按标准块名写死,并在测试里用 facelet 表现场核对 —— lib 不反向依赖 app/。
const CORNER_FACES: Record<string, string> = {
  URF: 'URF', UFL: 'UFL', ULB: 'ULB', UBR: 'UBR',
  DFR: 'DFR', DLF: 'DLF', DBL: 'DBL', DRB: 'DRB',
};
const EDGE_FACES: Record<string, string> = {
  UR: 'UR', UF: 'UF', UL: 'UL', UB: 'UB', DR: 'DR', DF: 'DF',
  DL: 'DL', DB: 'DB', FR: 'FR', FL: 'FL', BL: 'BL', BR: 'BR',
};
export const CORNER_NAMES = Object.keys(CORNER_FACES);
export const EDGE_NAMES = Object.keys(EDGE_FACES);

/** 棱 e 属于角 c 的 2×2×2 块 ⟺ e 的两个面都在 c 的三个面里。 */
export function blockEdges(corner: string): string[] {
  const cf = new Set(CORNER_FACES[corner]);
  return EDGE_NAMES.filter((e) => [...EDGE_FACES[e]].every((f) => cf.has(f)));
}

const factorial = (n: number): bigint => {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
};
const pow = (b: number, e: number): bigint => BigInt(b) ** BigInt(Math.max(e, 0));

/**
 * 「指定的这些角与棱都已归位」的三阶状态数。
 *
 * 自由块:角排列 (8−s)!、角朝向 3^(7−s)(总和 ≡ 0 mod 3 吃掉一个自由度)、
 * 棱排列 (12−e)!、棱朝向 2^(11−e);再除以 2 —— 角排列与棱排列的奇偶必须相同。
 * 只有当两组自由块都少于 2 个时奇置换根本不存在,那时不能再除(边界,别省)。
 */
export function statesWithSolved(corners: string[], edges: string[]): bigint {
  const s = corners.length, e = new Set(edges).size;
  const freeC = 8 - s, freeE = 12 - e;
  const n = factorial(freeC) * pow(3, 7 - s) * factorial(freeE) * pow(2, 11 - e);
  return (freeC >= 2 || freeE >= 2) ? n / 2n : n;
}

/** 一个 2×2×2 块 = 该角 + 它的 3 条棱。 */
export const statesWithBlocksSolved = (corners: string[]): bigint =>
  statesWithSolved(corners, corners.flatMap(blockEdges));

/**
 * 容斥:这批目标里**至少一个**已经完成的状态数。
 *
 * 目标之间会共享块(相邻两个 2×2×2 块共用 1 条棱、相邻两个十字共用 1 条棱),
 * 所以不能简单相加 —— `|∪Aᵢ| = Σ_{S≠∅} (−1)^{|S|+1}·N(∪S)`,每一项都得算。
 *
 * 但**不能**按 2ⁿ 个子集逐个枚举:六色底 XXCross 是 6 面 × C(4,2) = 36 个目标,
 * 2³⁶ = 690 亿项,跑不完。关键观察是 `N(∪S)` 只看并出来的块集合,而不同子集并出的
 * 块集合远少于子集本身(8 角 + 12 棱 = 20 位,上限 2²⁰,实际几千)。
 * 所以按并集聚合系数:逐个吞掉目标,`{S} → {S ∪ {g}}` 时符号翻转。
 * 规模从「子集个数」降到「不同并集个数」,36 个目标也是毫秒级。
 */
export function statesWithAnySolved(goals: Array<{ corners: string[]; edges: string[] }>): bigint {
  const cIx = new Map(CORNER_NAMES.map((c, i) => [c, i]));
  const eIx = new Map(EDGE_NAMES.map((e, i) => [e, i]));
  // 键 = 角位图 × 2¹² + 棱位图,合起来 20 位,能进 Map 的整数键
  const maskOf = (g: { corners: string[]; edges: string[] }): number =>
    g.corners.reduce((m, c) => m | (1 << (cIx.get(c)! + 12)), 0)
    | g.edges.reduce((m, e) => m | (1 << eIx.get(e)!), 0);

  const coeff = new Map<number, bigint>();
  for (const g of goals) {
    const mg = maskOf(g);
    const delta = new Map<number, bigint>([[mg, 1n]]);
    for (const [m, c] of coeff) {
      const u = m | mg;
      delta.set(u, (delta.get(u) ?? 0n) - c);
    }
    for (const [m, d] of delta) {
      const v = (coeff.get(m) ?? 0n) + d;
      if (v === 0n) coeff.delete(m); else coeff.set(m, v);
    }
  }

  // N(mask) 只取决于两个位数,按 (角数, 棱数) 记忆化
  const memo = new Map<number, bigint>();
  const popcount = (x: number): number => {
    let n = 0;
    for (let v = x; v; v &= v - 1) n++;
    return n;
  };
  let total = 0n;
  for (const [m, c] of coeff) {
    const s = popcount(m >> 12), e = popcount(m & 0xfff);
    const key = s * 16 + e;
    let n = memo.get(key);
    if (n === undefined) {
      n = statesWithSolved(CORNER_NAMES.slice(0, s), EDGE_NAMES.slice(0, e));
      memo.set(key, n);
    }
    total += c * n;
  }
  return total;
}

export const statesWithAnyBlockSolved = (corners: string[]): bigint =>
  statesWithAnySolved(corners.map((c) => ({ corners: [c], edges: blockEdges(c) })));

/** 一个面上的 4 个角(该面字母出现在块名里)。 */
export const cornersOnFace = (face: string): string[] =>
  CORNER_NAMES.filter((c) => CORNER_FACES[c].includes(face));

/** 某面的十字 = 该面的 4 条棱。 */
export const crossEdges = (face: string): string[] =>
  EDGE_NAMES.filter((e) => EDGE_FACES[e].includes(face));

/** 容斥:这批底色里至少一个十字已拼好的状态数。 */
export const statesWithAnyCrossSolved = (faces: string[]): bigint =>
  statesWithAnySolved(faces.map((f) => ({ corners: [], edges: crossEdges(f) })));

/**
 * 某个底色的 4 个 F2L 槽:该面的 4 个角,各配一条「两个侧面之间」的中层棱。
 * 底为 U 时是 URF↔FR、UFL↔FL、ULB↔BL、UBR↔BR。
 */
export function f2lSlots(face: string): Array<{ corner: string; edge: string }> {
  return cornersOnFace(face).map((corner) => {
    const sides = [...CORNER_FACES[corner]].filter((f) => f !== face);
    const edge = EDGE_NAMES.find((e) => sides.every((f) => EDGE_FACES[e].includes(f)))!;
    return { corner, edge };
  });
}

const chooseSets = <T,>(arr: T[], k: number): T[][] => (k === 0 ? [[]]
  : arr.flatMap((x, i) => chooseSets(arr.slice(i + 1), k - 1).map((c) => [x, ...c])));

/**
 * 容斥:这批底色里,至少有一个底色的十字 + **至少 k 个** F2L 槽已完成的状态数。
 * k=1 就是 XCross,k=2 XXCross,依此到 k=4(整个 F2L)。
 */
/**
 * 底色档 → 参与取 min 的面集合,与精确集(`scramble/stats/_data/exact_dist.ts`)的
 * 四个底色键一一对应。同档内换哪几个面不影响计数,也不影响分布 —— 后者是
 * `dist_cross_6col --faces` 把 LRFB / UDFB / UDLR 各跑一遍验出来的。
 * (键写在这里而不是 import 精确集:lib 不反向依赖 app/。)
 */
export const BOTTOM_FACES: Record<'W' | 'WY' | 'BGOR' | 'BGORWY', string[]> = {
  W: ['U'],
  WY: ['U', 'D'],
  BGOR: ['L', 'R', 'F', 'B'],
  BGORWY: ['U', 'D', 'L', 'R', 'F', 'B'],
};

export const statesWithAnyXCrossSolved = (faces: string[], k = 1): bigint =>
  statesWithAnySolved(faces.flatMap((f) =>
    chooseSets(f2lSlots(f), k).map((slots) => ({
      corners: slots.map((s) => s.corner),
      edges: [...crossEdges(f), ...slots.map((s) => s.edge)],
    }))));

// ── Roux 的块 ───────────────────────────────────────────────────────
// 1×2×3(FB)= 2 角 + 3 棱;1×2×2 = **1 角 + 2 棱**(第四个格子是中心块,三阶上不动)。
// 下面这两族都是「块已经在自己的家位上」的口径 —— 与「块在别处拼好了」是两回事,
// 后者是相对位置条件,不能用固定块计数,页面上写清楚了。

/**
 * 某个面上、绕该面一圈的 4 个 1×2×3 块(D 面 → DL / DF / DR / DB)。
 * 每块 = 该面上相邻的两个角 + 它们共用的那条面上棱 + 各自那条竖着的侧棱。
 */
export function fbBlocksOnFace(face: string): Array<{ corners: string[]; edges: string[] }> {
  const corners = cornersOnFace(face);
  const out: Array<{ corners: string[]; edges: string[] }> = [];
  for (const c of corners) {
    for (const d of corners) {
      if (c >= d) continue;
      const shared = blockEdges(c).filter((e) => blockEdges(d).includes(e));
      if (shared.length !== 1) continue; // 面对角不相邻,没有共用棱
      const upright = (x: string) => blockEdges(x).filter((e) => !EDGE_FACES[e].includes(face));
      out.push({ corners: [c, d], edges: [...shared, ...upright(c), ...upright(d)] });
    }
  }
  return out;
}

/** 全部 24 个「在家位上」的 1×2×2:每个角配它 3 条棱里的 2 条。 */
export const BLOCK122_ALL: Array<{ corners: string[]; edges: string[] }> =
  CORNER_NAMES.flatMap((c) => {
    const es = blockEdges(c);
    return es.map((_, i) => ({ corners: [c], edges: es.filter((__, j) => j !== i) }));
  });

// ── 概率条目 ────────────────────────────────────────────────────────

export type SkipKind = 'counted' | 'exact' | 'sim';

// ── 非三阶项目的分母 ────────────────────────────────────────────────
// 三阶那几族靠上面的 `statesWithSolved` 容斥;别的项目各有各的空间,分母单独写在这里,
// 每一个都在 `tests/skip_probability.test.ts` 里与站内已有的枚举结果或闭式对账。

const fact = (n: number): bigint => {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
};

/** 2×2 全空间(固定一个角块)= 7!·3⁶。与 `stats/scramble/2x2_essential.json` 的 `total_positions` 同数。 */
export const CUBE2_STATES = 3_674_160;
/** WCA 2×2 打乱不给 ≤3 HTM 的态 —— 同一份 JSON 的 `wca_legal_min4h`。 */
export const CUBE2_WCA_LEGAL = 3_673_775;

/** 4×4 中心块的可分辨排布数 = 24!/(4!)⁶。 */
export const CUBE4_CENTRE_STATES = fact(24) / fact(4) ** 6n;
/** 某一种颜色的 4 块中心凑成完整一面(哪一面都行)。 */
export const CUBE4_ONE_CENTRE = 6n * (fact(20) / fact(4) ** 5n);
/** 一对相对色的 8 块中心各自凑成完整一面、且落在一对相对面上(3 对面 × 2 种朝向 = 6)。 */
export const CUBE4_TWO_CENTRES = 6n * (fact(16) / fact(4) ** 4n);

/**
 * 五魔顶层:5 个角 + 5 条棱。
 * 朝向各差一个总和约束 → 3⁴ 与 2⁴。排列这一半是关键:五魔的每个面转都把 5 个角、5 条棱各转一个
 * 5-轮换(偶置换),所以**角排列与棱排列各自必为偶** —— 顶层就各只有 A5 的 60 种,不是 5! 的 120 种。
 * 这条约束正是站内 `god_data` 把五魔写成 `20!·3¹⁹·30!·2²⁷`(而不是 2²⁹)时折进去的那个 /4。
 */
export const MINX_LL_CO = 3 ** 4;                  // 81
export const MINX_LL_EO = 2 ** 4;                  // 16
export const MINX_LL_PERM_RAW = 60 * 60;           // A5 × A5
export const MINX_AUF = 5;
export const MINX_PLL = MINX_LL_PERM_RAW / MINX_AUF;               // 720
export const MINX_EP = MINX_PLL / 60;                              // 12
export const MINX_LL = MINX_LL_CO * MINX_LL_EO * MINX_PLL;         // 933,120

export interface SkipEntry {
  id: string;
  group: 'll' | 'block' | 'cross' | 'roux' | '222' | '444' | 'minx';
  name: { zh: string; en: string };
  kind: SkipKind;
  /** 分子 / 分母,十进制字符串 —— 分母能到 4.3×10¹⁹,不能过 Number。 */
  num: string;
  den: string;
  /** 这个数是怎么来的,一句话。页面上跟着数字走,不让它孤立出现。 */
  why: { zh: string; en: string };
  /**
   * 若给出,页面另报一列「相对于该条目」的条件概率。
   * 大家日常引用的「XCross 大约 1/96」就是这一列,不是绝对概率(那是 1/1834 万)。
   */
  relativeTo?: string;
}

const ll = (
  id: string, zh: string, en: string, num: number, den: number,
  whyZh: string, whyEn: string,
): SkipEntry => ({
  id, group: 'll', name: { zh, en }, kind: 'counted',
  num: String(num), den: String(den), why: { zh: whyZh, en: whyEn },
});

const block = (id: string, zh: string, en: string, corners: string[], whyZh: string, whyEn: string): SkipEntry => ({
  id,
  group: 'block',
  name: { zh, en },
  kind: 'exact',
  num: statesWithAnyBlockSolved(corners).toString(),
  den: CUBE3_STATES,
  why: { zh: whyZh, en: whyEn },
});

/** 非三阶项目:分子分母都已经是算好的整数(字符串),只负责装进条目。 */
const other = (
  id: string, group: SkipEntry['group'], zh: string, en: string, num: string, den: string,
  whyZh: string, whyEn: string,
): SkipEntry => ({
  id, group, name: { zh, en }, kind: 'counted', num, den, why: { zh: whyZh, en: whyEn },
});

const cross = (id: string, zh: string, en: string, faces: string[], whyZh: string, whyEn: string): SkipEntry => ({
  id,
  group: 'cross',
  name: { zh, en },
  kind: 'exact',
  num: statesWithAnyCrossSolved(faces).toString(),
  den: CUBE3_STATES,
  why: { zh: whyZh, en: whyEn },
});

export const SKIP_ENTRIES: SkipEntry[] = [
  ll('eo', 'EO 跳步', 'EO skip', 1, LL_EO,
    '顶层 4 条棱的朝向,第 4 个由总和定死 → 2³ 种,其中 1 种全对',
    'Four last-layer edges, the fourth flip forced by parity → 2³ states, one of them all-good'),
  ll('oll', 'OLL 跳步', 'OLL skip', 1, LL_CO * LL_EO,
    '角朝向 3³ × 棱朝向 2³ = 216,其中 1 种全对',
    'Corner orientation 3³ × edge orientation 2³ = 216, one of them all-good'),
  ll('pll', 'PLL 跳步', 'PLL skip', AUF, LL_PERM,
    '角/棱排列同奇偶 → 4!·4!/2 = 288 种,其中 4 种是「还原 + 一次 AUF」',
    'Corner and edge permutations share parity → 4!·4!/2 = 288, four of which are solved up to AUF'),
  ll('coll', 'COLL 跳步', 'COLL skip', AUF, LL_CO * 24,
    '角朝向 3³ × 角排列 4!,其中 4 种是角全好(差一次 AUF)—— 只剩 EPLL',
    'Corner orientation 3³ × corner permutation 4!, four of which leave the corners done up to AUF — EPLL only'),
  ll('ll', 'LL 连跳(OLL + PLL)', 'LL skip (OLL and PLL)', AUF, LL_UNIVERSE,
    '整个顶层全集 62,208,其中 4 种是「已还原 + 一次 AUF」',
    'The whole 62,208-state last-layer universe, four of which are solved up to AUF'),
  ll('lll1', '单个 1LLL case(无对称)', 'One 1LLL case (asymmetric)', 16, LL_UNIVERSE,
    'case = 16 元 AUF 双边作用的轨道;无对称时轨道满 16 个状态',
    'A case is an orbit of the 16-element two-sided AUF action; with no symmetry the orbit has all 16'),

  // ZZ / ZBLS 视角:到顶层时棱已经定向,OLL 只剩角朝向
  ll('oll-given-eo', '棱已定向时的 OLL 跳步', 'OLL skip when edges are already oriented', 1, 27,
    '条件概率:棱朝向已解决,只剩角朝向 3³ = 27 种',
    'Conditional: edge orientation is already solved, leaving corner orientation 3³ = 27'),
  // 「至少跳了 O 或 P」—— 两个事件的并,不是相加(两个都跳就是 LL 连跳,要减掉)
  {
    id: 'oll-or-pll',
    group: 'll',
    name: { zh: 'OLL 或 PLL 至少跳一个', en: 'OLL or PLL skips (at least one)' },
    kind: 'counted',
    // 1/216 + 1/72 − 1/15552 = (72 + 216 − 1)/15552
    num: String(72 + 216 - 1),
    den: String(LL_UNIVERSE / 4),
    why: {
      zh: '容斥:1/216 + 1/72 − 1/15,552,减掉的那项就是两个一起跳(LL 连跳)',
      en: 'Inclusion-exclusion: 1/216 + 1/72 − 1/15,552; the subtracted term is both skipping at once',
    },
  },

  cross('cross-fixed', '固定底十字', 'A fixed cross', ['U'],
    '4 条棱同时归位:12·11·10·9 × 2⁴ = 190,080 分之一',
    'Four edges in place at once: one state in 12·11·10·9 × 2⁴ = 190,080'),
  cross('cross-dual', '双色底十字', 'Dual-colour cross', ['U', 'D'],
    '一对相对面取并集 —— 两个十字不共用棱,但仍要减掉「两个都好」那一项',
    'Union over a pair of opposite faces — the two crosses share no edge, but the both-solved term still has to come off'),
  cross('cross-cn', '六色底十字(CN)', 'Colour-neutral cross', ['U', 'D', 'L', 'R', 'F', 'B'],
    '6 个面取并集;相邻两面共用 1 条棱,容斥 63 项',
    'Union over all six faces; adjacent faces share an edge, so 63 inclusion-exclusion terms'),

  {
    id: 'xcross-fixed1',
    group: 'cross',
    name: { zh: '固定底 + 固定槽 XCross', en: 'Fixed cross, fixed slot XCross' },
    kind: 'exact',
    num: statesWithSolved(['URF'], [...crossEdges('U'), 'FR']).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '十字 4 棱 + 该槽的 1 角 1 棱同时归位 = 72,990,720 分之一',
      en: 'The four cross edges plus that slot&apos;s corner and edge all at once: one in 72,990,720',
    },
  },
  {
    id: 'xcross-fixed',
    group: 'cross',
    name: { zh: '固定底 XCross(任一槽)', en: 'Fixed cross, any slot XCross' },
    kind: 'exact',
    num: statesWithAnyXCrossSolved(['U']).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '4 个槽取并集。相对十字看才是大家引用的那个数 —— 解出十字时顺手带出一对',
      en: 'Union over the four slots. Relative to the cross is the figure people actually quote: a pair falling out with the cross',
    },
    relativeTo: 'cross-fixed',
  },
  {
    id: 'xcross-dual',
    group: 'cross',
    name: { zh: '双色底 XCross(任一槽)', en: 'Dual-colour XCross, any slot' },
    kind: 'exact',
    num: statesWithAnyXCrossSolved(['U', 'D']).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '一对相对面 × 各 4 个槽 = 8 个目标取并集',
      en: 'A pair of opposite faces × four slots each = union over eight goals',
    },
    relativeTo: 'cross-dual',
  },

  ...([
    [2, 'XXCross(任两槽)', 'XXCross (any two slots)',
      '十字 + 2 个槽,C(4,2) = 6 种取法取并集',
      'Cross plus two slots, union over the C(4,2) = 6 choices'],
    [3, 'XXXCross(任三槽)', 'XXXCross (any three slots)',
      '十字 + 3 个槽,C(4,3) = 4 种取法',
      'Cross plus three slots, C(4,3) = 4 choices'],
    [4, 'F2L 直接完成', 'Whole F2L already done',
      '十字 + 4 个槽全好 —— 前两层一步没走就已经拼好',
      'Cross plus all four slots — the first two layers solved before a single move'],
  ] as const).map(([k, zh, en, whyZh, whyEn]): SkipEntry => ({
    id: `xcross${k}-fixed`,
    group: 'cross',
    name: { zh, en },
    kind: 'exact',
    num: statesWithAnyXCrossSolved(['U'], k).toString(),
    den: CUBE3_STATES,
    why: { zh: whyZh, en: whyEn },
    relativeTo: 'cross-fixed',
  })),

  // CN 档:6 个底色 × C(4,k) 个槽组合一起取并集(k=2 就是 36 个目标)。
  // 这四条与精确集覆盖矩阵的「六色底 0 步」同数,那一列的 0 步金标出自 solver 的
  // dist_*_0f,与本文件的容斥逐位一致(tests/skip_probability.test.ts)。
  ...([
    [1, 'XCross(CN)', 'XCross (colour neutral)'],
    [2, 'XXCross(CN)', 'XXCross (colour neutral)'],
    [3, 'XXXCross(CN)', 'XXXCross (colour neutral)'],
    [4, 'F2L 直接完成(CN)', 'Whole F2L already done (colour neutral)'],
  ] as const).map(([k, zh, en]): SkipEntry => ({
    id: `xcross${k}-cn`,
    group: 'cross',
    name: { zh, en },
    kind: 'exact',
    num: statesWithAnyXCrossSolved(BOTTOM_FACES.BGORWY, k).toString(),
    den: CUBE3_STATES,
    why: {
      zh: `6 个底色 × ${k === 1 ? '4 个槽' : `C(4,${k}) 种槽组合`} 一起取并集,与精确集的六色底 0 步同数`,
      en: `Union over six bottom colours × ${k === 1 ? 'four slots' : `C(4,${k}) slot choices`}; same number as the CN 0-move count in the exhaustive dataset`,
    },
    relativeTo: 'cross-cn',
  })),

  block('block222-fixed', '固定 2×2×2 块', 'A fixed 2×2×2 block',
    ['URF'],
    '1 个角 + 3 条棱都归位:8·3 × 12·11·10·2³ = 253,440 分之一',
    'One corner and three edges in place: one state in 8·3 × 12·11·10·2³ = 253,440'),
  block('block222-face', '同一面上任一 2×2×2 块', 'Any 2×2×2 block on one face',
    cornersOnFace('U'),
    '该面 4 个角取并集 —— 相邻两块共用 1 条棱,容斥必须逐项算',
    'Union over that face&apos;s four corners — adjacent blocks share an edge, so inclusion-exclusion is not optional'),
  block('block222-cn', '任一 2×2×2 块(CN)', 'Any 2×2×2 block (colour neutral)',
    CORNER_NAMES,
    '8 个角全取并集。注意「双色底」已经等于 CN —— 一对相对面的 8 个角就是全部 8 个角',
    'Union over all eight corners. Note that "dual colour" already equals CN here: a pair of opposite faces covers all eight corners'),

  // ── Roux ──────────────────────────────────────────────────────────
  // LSE 那一族活在自己的全集(11,520)里,不是 |G| 的比 —— 但 Roux 每把都会走到 LSE,
  // 所以「每把出现一次的概率」仍然就是这个数,和上面几族可以并排看。
  {
    id: 'roux-cmll',
    group: 'roux',
    name: { zh: 'CMLL 跳步', en: 'CMLL skip' },
    kind: 'counted',
    num: '1',
    den: String(LL_CO * 3 * 2),
    why: {
      zh: '角朝向 3³ × 角排列 4!,其中 4 种差一次 AUF —— 与 COLL 同一个数',
      en: 'Corner orientation 3³ × corner permutation 4!, four of which are an AUF away — the same number as COLL',
    },
  },
  {
    id: 'roux-lse-eo',
    group: 'roux',
    name: { zh: 'LSE 的 EO 跳步', en: 'LSE edge-orientation skip' },
    kind: 'counted',
    num: '1',
    den: '32',
    why: {
      zh: '最后 6 条棱的朝向,第 6 个由总和定死 → 2⁵ = 32 种,其中 1 种全对',
      en: 'Orientation of the last six edges, the sixth fixed by the parity sum → 2⁵ = 32, one of which is all-good',
    },
  },
  {
    id: 'roux-lse-ep',
    group: 'roux',
    name: { zh: 'EO 之后排列也跳', en: 'Permutation skip after EO' },
    kind: 'counted',
    num: '1',
    den: '360',
    why: {
      zh: '角已还原 → 这 6 条棱只能是偶排列,6!/2 = 360 种',
      en: 'With the corners solved the six edges can only be an even permutation: 6!/2 = 360',
    },
  },
  {
    id: 'roux-lse',
    group: 'roux',
    name: { zh: 'LSE 全跳', en: 'Whole LSE skip' },
    kind: 'exact',
    num: '1',
    // 8 角 + 非 M 层 6 棱都好 → 只剩 6 条棱的合法状态数。恰为 EO 32 × EP 360。
    den: statesWithSolved(CORNER_NAMES, ['DL', 'BL', 'FL', 'DR', 'FR', 'BR']).toString(),
    why: {
      zh: 'F2B + CMLL 做完后整个魔方就活在 ⟨M, U⟩ 里,合法状态恰 11,520 = EO 32 × 排列 360',
      en: 'After F2B and CMLL the cube lives in ⟨M, U⟩: exactly 11,520 legal states = 32 orientations × 360 permutations',
    },
  },
  {
    id: 'roux-cmll-lse',
    group: 'roux',
    name: { zh: 'CMLL + LSE 连跳', en: 'CMLL and LSE both skip' },
    kind: 'exact',
    num: '1',
    den: String(162 * 11520),
    why: {
      zh: '两步互相独立,分母直接相乘:162 × 11,520',
      en: 'The two steps are independent, so the denominators multiply: 162 × 11,520',
    },
  },
  {
    id: 'roux-f2l-given-f2b',
    group: 'roux',
    name: { zh: 'F2B 做完时 F2L 也好了', en: 'F2L already done when F2B is' },
    kind: 'counted',
    num: '1',
    den: '120',
    why: {
      zh: '条件概率:剩下 6 条棱里 DF/DB 恰好归位且朝向对 —— (4!·2⁴)/(6!·2⁶) = 1/120',
      en: 'Conditional: DF and DB happen to be placed and oriented among the six remaining edges — (4!·2⁴)/(6!·2⁶) = 1/120',
    },
  },
  {
    id: 'roux-fb-fixed',
    group: 'roux',
    name: { zh: '指定的 1×2×3 首块', en: 'One specific 1×2×3 first block' },
    kind: 'exact',
    num: statesWithSolved(fbBlocksOnFace('D')[0].corners, fbBlocksOnFace('D')[0].edges).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '2 角 + 3 棱都归位:8·7·3² × 12·11·10·2³ = 5,322,240 分之一',
      en: 'Two corners and three edges in place: one state in 8·7·3² × 12·11·10·2³ = 5,322,240',
    },
  },
  {
    id: 'roux-fb-y',
    group: 'roux',
    name: { zh: '首块(允许 y 转体)', en: 'First block, free to y-rotate' },
    kind: 'exact',
    num: statesWithAnySolved(fbBlocksOnFace('D')).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '底面一圈 4 个首块取并集 —— 相邻两块共用 1 角 1 棱,所以不是直接除以 4',
      en: 'Union over the four first blocks around the bottom face — adjacent ones share a corner and an edge, so this is not the single value over four',
    },
  },
  {
    id: 'roux-fb-xy',
    group: 'roux',
    name: { zh: '首块(允许 x2 y 转体)', en: 'First block, free to x2 and y-rotate' },
    kind: 'exact',
    num: statesWithAnySolved([...fbBlocksOnFace('D'), ...fbBlocksOnFace('U')]).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '上下两圈共 8 个首块取并集;8 个已经是这个颜色方案下的全部,再多就没有了',
      en: 'Union over all eight first blocks, top ring and bottom ring — eight is all there is for one colour scheme',
    },
  },
  {
    id: 'roux-122-fixed',
    group: 'roux',
    name: { zh: '指定的 1×2×2 方块', en: 'One specific 1×2×2 square' },
    kind: 'exact',
    num: statesWithSolved(['URF'], ['UR', 'UF']).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '1 角 + 2 棱都归位(第四格是中心块):8·3 × 12·11·2² = 12,672 分之一',
      en: 'One corner and two edges in place (the fourth cell is a centre): one in 8·3 × 12·11·2² = 12,672',
    },
  },
  {
    id: 'roux-122-any',
    group: 'roux',
    name: { zh: '任一 1×2×2(在家位上)', en: 'Any 1×2×2, in its home slot' },
    kind: 'exact',
    num: statesWithAnySolved(BLOCK122_ALL).toString(),
    den: CUBE3_STATES,
    why: {
      zh: '8 个角 × 每角 3 种配棱 = 24 个方块取并集。注意这是「在家位」口径,不是「在别处拼好」',
      en: 'Union over 8 corners × 3 edge pairs each = 24 squares. Note this is the in-home-slot reading, not "assembled somewhere else"',
    },
  },

  // ── 二阶 ──────────────────────────────────────────────────────────
  other('222-oll', '222', '二阶 OLL 跳步', '2×2 OLL skip', '1', String(3 ** 3),
    '顶层 4 个角的朝向,第 4 个由总和定死 → 3³ 种',
    'Four last-layer corners, the fourth twist forced by the sum → 3³ states'),
  other('222-pll', '222', '二阶 PLL 跳步', '2×2 PLL skip', '1', '6',
    '4 个角的排列 4! = 24,其中 4 种只差一次 AUF',
    'Corner permutation 4! = 24, four of which are one AUF apart'),
  other('222-ll', '222', '二阶顶层连跳', '2×2 LL skip', '1', String(3 ** 3 * 6),
    '朝向 27 × 排列 6,两步独立',
    'Orientation 27 × permutation 6, the two are independent'),
  other('222-ff', '222', '首面已好(任一色)', 'A face already done (any colour)', '22654', String(CUBE2_STATES),
    '站内 3,674,160 态全枚举里「CN 首面」的 0 步档',
    'The 0-move bucket of the site’s CN-first-face enumeration over all 3,674,160 states'),
  other('222-fl', '222', '首层已好(任一色)', 'A layer already done (any colour)', '3814', String(CUBE2_STATES),
    '同一份枚举里「CN 首层」的 0 步档',
    'The 0-move bucket of the CN-first-layer enumeration in the same dataset'),
  other('222-nobar', '222', '一根棒都没有', 'No bar anywhere', '155414', String(CUBE2_STATES),
    '同一份枚举的「无棒」子集大小',
    'The size of the no-bar subset in the same enumeration'),
  other('222-4q', '222', '比赛里抽到 4 步(QTM)', 'A four-quarter-turn state in competition', '534', String(CUBE2_WCA_LEGAL),
    'QTM 最优 4 步的态有 534 个;分母是比赛能抽到的 3,673,775 个(WCA 不给 ≤3 HTM)',
    '534 states are optimal in four quarter turns; the denominator is the 3,673,775 a competition can hand you (the WCA never gives ≤3 HTM)'),

  // ── 四阶 ──────────────────────────────────────────────────────────
  other('444-centre1', '444', '一种颜色的中心已成面', 'One colour’s centres already form a face',
    CUBE4_ONE_CENTRE.toString(), CUBE4_CENTRE_STATES.toString(),
    '24 块中心的可分辨排布 24!/(4!)⁶;某色 4 块凑成一面(6 个面都算)= 6·20!/(4!)⁵,约掉正好 1/1771',
    'Distinguishable centre arrangements are 24!/(4!)⁶; one colour completing any of the six faces is 6·20!/(4!)⁵, which reduces to exactly 1/1771'),
  other('444-centre2', '444', '一对相对色的中心都已成面', 'An opposite colour pair already done',
    CUBE4_TWO_CENTRES.toString(), CUBE4_CENTRE_STATES.toString(),
    '两色各占一面且互为对面:3 对面 × 2 种朝向 = 6 种落法,剩下 16 块自由',
    'Both colours complete, on opposite faces: 3 face pairs × 2 orientations = 6 placements, the other 16 pieces free'),

  // ── 五魔 ──────────────────────────────────────────────────────────
  other('minx-eo', 'minx', '五魔 EO 跳步', 'Megaminx EO skip', '1', String(MINX_LL_EO),
    '顶层 5 条棱的朝向,第 5 个由总和定死 → 2⁴',
    'Five last-layer edges, the fifth flip forced by the sum → 2⁴'),
  other('minx-co', 'minx', '五魔 CO 跳步', 'Megaminx CO skip', '1', String(MINX_LL_CO),
    '顶层 5 个角的朝向,第 5 个由总和定死 → 3⁴',
    'Five last-layer corners, the fifth twist forced by the sum → 3⁴'),
  other('minx-oll', 'minx', '五魔 OLL 跳步', 'Megaminx OLL skip', '1', String(MINX_LL_CO * MINX_LL_EO),
    '3⁴ × 2⁴ = 1296',
    '3⁴ × 2⁴ = 1296'),
  other('minx-ep', 'minx', '五魔 EP 跳步', 'Megaminx EP skip', '1', String(MINX_EP),
    '每个面转都是棱上的 5-轮换 ⇒ 顶层棱排列必为偶,只有 A5 的 60 种;再模掉 5 个 AUF',
    'Every face turn is a 5-cycle on edges, so the last-layer edge permutation must be even — only A5’s 60, then modulo the five AUFs'),
  other('minx-cp', 'minx', '五魔 CP 跳步', 'Megaminx CP skip', '1', String(MINX_EP),
    '角这边同理:A5 的 60 种,模 AUF 后 12 种',
    'Corners are the same story: A5’s 60, twelve after the AUF quotient'),
  other('minx-pll', 'minx', '五魔 PLL 跳步', 'Megaminx PLL skip', '1', String(MINX_PLL),
    '角 60 × 棱 60 一起模掉 5 个 AUF = 720。注意不是 12 × 12 —— AUF 是两边共用的',
    'Corners 60 × edges 60, quotiented by the five shared AUFs = 720. Not 12 × 12: the AUF is shared'),
  other('minx-ll', 'minx', '五魔顶层连跳', 'Megaminx LL skip', '1', String(MINX_LL),
    '1296 × 720 = 933,120',
    '1296 × 720 = 933,120'),
];

export const entryById = (id: string): SkipEntry => SKIP_ENTRIES.find((e) => e.id === id)!;

/**
 * 展示值:分数落到 double。
 *
 * 计数一路都是 BigInt(分母大到 4.3×10¹⁹,任何中途转 Number 都会静默丢位),
 * 只在最后一步除。这里**不能**用「先 BigInt 定点缩放再转 Number」:定点是绝对精度,
 * 而本表的概率横跨 1/8 到 1/7×10¹⁴,小的那头会被截掉有效数字。
 * `Number(十进制串)` 按规范就近舍入,两次舍入的相对误差 ~2×10⁻¹⁶,与量级无关。
 */
const asNum = (s: string) => Number(s);

/** 1/p 的展示值。 */
export function oneOver(e: SkipEntry): number {
  return asNum(e.den) / asNum(e.num);
}

export function probability(e: SkipEntry): number {
  return asNum(e.num) / asNum(e.den);
}

/**
 * 条件概率 1/P(e | 参照条目) —— 两条都是「全群里的合法状态数」,同分母,直接比分子。
 * 前提:e 的目标包含参照的目标(XCross ⊃ 十字),否则这个比值没有意义。
 */
export function oneOverRelative(e: SkipEntry): number | null {
  if (!e.relativeTo) return null;
  const base = entryById(e.relativeTo);
  return (asNum(base.num) * asNum(e.den)) / (asNum(e.num) * asNum(base.den));
}

/**
 * 一轮五把里至少 k 把跳步(二项分布)。
 *
 * 逐项累加而不是 1 − P(0)+P(1)+… —— p 小到 1e-5 时后者会在浮点里把有效数字全吃掉。
 */
export function atLeastKInRound(p: number, k: number, rounds = 5): number {
  if (k <= 0) return 1;
  let acc = 0;
  for (let i = k; i <= rounds; i++) acc += exactlyKInRound(p, i, rounds);
  return acc;
}

/** 一轮里**恰好** k 把跳步。C(n,k)·pᵏ·(1−p)ⁿ⁻ᵏ,组合数逐项乘除,不先算阶乘。 */
export function exactlyKInRound(p: number, k: number, rounds = 5): number {
  if (k < 0 || k > rounds) return 0;
  let c = 1;
  for (let j = 0; j < k; j++) c = (c * (rounds - j)) / (j + 1);
  return c * p ** k * (1 - p) ** (rounds - k);
}
