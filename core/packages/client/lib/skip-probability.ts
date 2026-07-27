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

// ── 概率条目 ────────────────────────────────────────────────────────

export type SkipKind = 'counted' | 'exact' | 'sim';

export interface SkipEntry {
  id: string;
  group: 'll' | 'block' | 'cross';
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
  for (let i = k; i <= rounds; i++) {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (rounds - j)) / (j + 1);
    acc += c * p ** i * (1 - p) ** (rounds - i);
  }
  return acc;
}
