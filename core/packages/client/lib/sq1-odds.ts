/**
 * Square-1 的形状枚举与各阶段「跳步」概率 —— 每个数都由状态空间现算,不写死小数。
 *
 * 一层是 12 个 30° 槽:角块占 2 槽、棱块占 1 槽,所以一层恰好由若干「2 / 1」拼满 12 槽。
 * 「可切」(twistable)= 槽 0|11 与槽 5|6 两条切线都落在块的边界上 —— 否则 "/" 会劈开一个角块。
 * 把一层拆成两个半层(右半 = 槽 0..5、左半 = 槽 6..11)后,可切等价于「两个半层各自填满 6 槽」,
 * 而 6 槽的填法只有 13 种。整只魔方的形状 = 四个半层,再加一条「角块总数 = 8」的约束 ——
 * 这正是 cstimer 建 `Shape_ShapeIdx` 时的 `bitCount(value) === 16`。
 *
 * 形状数 3678 与「立方体形只有 4 种」都在这里现算,`tests/sq1_odds.test.ts` 锁住:3678 与
 * `/math/god?event=sq1` 引的 jaapsch.net 数字对得上,总状态数 3678 × 2 × 8! × 8! 也与该页
 * `FACE_DIST` 逐档求和相等(两条完全独立的来源)。
 *
 * 概率一律按「朝向固定」口径:还原目标是一个确定的状态,不把「整只上下翻过来」另算一种成功。
 * 上游表格的 OBL 那格用的是另一套(把翻转也算成功,故 ×2),差异见 `SQ1_ODDS` 上的注释。
 */

/** 一层 12 个 30° 槽。 */
export const SQ1_SLOTS = 12;
/** 半层 6 槽 —— "/" 一刀正好切成两个半层。 */
export const SQ1_HALF_SLOTS = SQ1_SLOTS / 2;

/** 半层的所有块序(1 = 棱块占 1 槽,2 = 角块占 2 槽),共 13 种。 */
export const HALF_PATTERNS: readonly (readonly number[])[] = (() => {
  const out: number[][] = [];
  const walk = (acc: number[], left: number) => {
    if (left === 0) { out.push([...acc]); return; }
    for (const size of [1, 2]) {
      if (size <= left) { acc.push(size); walk(acc, left - size); acc.pop(); }
    }
  };
  walk([], SQ1_HALF_SLOTS);
  return out;
})();

/** 一层 = 右半 + 左半的块序拼接(共占 12 槽)。 */
export type Sq1Layer = readonly number[];

/** 形状 = 上下两层。 */
export interface Sq1ShapeState {
  top: Sq1Layer;
  bottom: Sq1Layer;
}

const cornersIn = (layer: Sq1Layer): number => layer.filter((s) => s === 2).length;
/** 形状的去重键。 */
export const shapeKey = (s: Sq1ShapeState): string => `${s.top.join('')}|${s.bottom.join('')}`;

/** 一层是不是正方形:4 角 4 棱交替(2,1,2,1,…),也就是立方体形状的那一层。 */
export function isSquareLayer(layer: Sq1Layer): boolean {
  if (layer.length !== 8) return false;
  return layer.every((size, i) => size !== layer[(i + 1) % layer.length]);
}

/** 半层拼一层:右半在前(槽 0..5),左半在后(槽 6..11)。 */
const joinHalves = (right: readonly number[], left: readonly number[]): Sq1Layer => [...right, ...left];

/** 把一层拆回两个半层 —— 可切状态下前缀和必然正好经过 6。 */
function splitHalves(layer: Sq1Layer): { right: number[]; left: number[] } {
  const right: number[] = [];
  let filled = 0;
  let i = 0;
  for (; filled < SQ1_HALF_SLOTS; i++) { right.push(layer[i]); filled += layer[i]; }
  return { right, left: layer.slice(i) };
}

/**
 * 一层能转到的所有可切位置:把块序循环移位,使某个块的起点落到槽 0,
 * 且移位后前缀和仍能正好经过 6(否则槽 5|6 那条切线劈在角块中间)。
 *
 * 只看形状,所以按块序去重、并去掉转回自己那一档 —— 正方形层的块序有 8 个循环移位,
 * 但落在形状上只有「角起头」「棱起头」两种,减去自己就只剩 1 个去处。
 */
export function layerTurns(layer: Sq1Layer): Sq1Layer[] {
  const self = layer.join('');
  const seen = new Set<string>([self]);
  const out: Sq1Layer[] = [];
  for (let k = 1; k < layer.length; k++) {
    const rot = [...layer.slice(k), ...layer.slice(0, k)];
    const key = rot.join('');
    if (seen.has(key)) continue;
    let sum = 0;
    for (const size of rot) {
      sum += size;
      if (sum >= SQ1_HALF_SLOTS) {
        if (sum === SQ1_HALF_SLOTS) { seen.add(key); out.push(rot); }
        break;
      }
    }
  }
  return out;
}

/** "/" 一刀:上下两层交换右半(与 cstimer `Shape_TwistMove` 互换低 6 位同构)。 */
export function sliceShape(s: Sq1ShapeState): Sq1ShapeState {
  const t = splitHalves(s.top);
  const b = splitHalves(s.bottom);
  return { top: joinHalves(b.right, t.left), bottom: joinHalves(t.right, b.left) };
}

/** 立方体形状之一(上下两层都是正方形),BFS 的起点。 */
export const SQ1_SOLVED_SHAPE: Sq1ShapeState = {
  top: [2, 1, 2, 1, 2, 1, 2, 1],
  bottom: [2, 1, 2, 1, 2, 1, 2, 1],
};

/** 直接枚举:四个半层任意组合,留下角块总数 = 8 的那些。 */
export function enumerateShapes(): Sq1ShapeState[] {
  const out: Sq1ShapeState[] = [];
  for (const tr of HALF_PATTERNS) {
    for (const tl of HALF_PATTERNS) {
      const top = joinHalves(tr, tl);
      const topCorners = cornersIn(top);
      if (topCorners > 8) continue;
      for (const br of HALF_PATTERNS) {
        for (const bl of HALF_PATTERNS) {
          const bottom = joinHalves(br, bl);
          if (topCorners + cornersIn(bottom) === 8) out.push({ top, bottom });
        }
      }
    }
  }
  return out;
}

/** 从立方体形状广搜:顶层转 / 底层转 / "/" 三种邻接 —— 用来验「枚举出来的形状全都摸得到」。 */
export function reachableShapes(): Set<string> {
  const seen = new Set<string>([shapeKey(SQ1_SOLVED_SHAPE)]);
  const queue: Sq1ShapeState[] = [SQ1_SOLVED_SHAPE];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const next: Sq1ShapeState[] = [
      ...layerTurns(cur.top).map((top) => ({ top, bottom: cur.bottom })),
      ...layerTurns(cur.bottom).map((bottom) => ({ top: cur.top, bottom })),
      sliceShape(cur),
    ];
    for (const s of next) {
      const k = shapeKey(s);
      if (!seen.has(k)) { seen.add(k); queue.push(s); }
    }
  }
  return seen;
}

const ALL_SHAPES = enumerateShapes();

/** 可切形状总数 —— 现数 3,678(与 jaapsch.net 同数)。 */
export const SQ1_SHAPES = ALL_SHAPES.length;
/** 其中立方体形状的个数 —— 现数 4(上下层各 2 种可切的正方形摆位)。 */
export const SQ1_CUBE_SHAPES = ALL_SHAPES.filter((s) => isSquareLayer(s.top) && isSquareLayer(s.bottom)).length;

const factorial = (n: number): bigint => {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
};

/** 8 个角块与 8 个棱块各自的排法。 */
export const SQ1_PIECE_FILLINGS = factorial(8) * factorial(8);
/** 中层两半可辨,整体再乘 2。 */
export const SQ1_MIDDLE = 2n;
/** 全空间 = 形状 × 中层 × 块排法 = 11,958,666,854,400。 */
export const SQ1_STATES = BigInt(SQ1_SHAPES) * SQ1_MIDDLE * SQ1_PIECE_FILLINGS;

const choose = (n: number, k: number): number => {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
};

/** 底色朝向:8 个角块里哪 4 个在上层 = C(8,4) = 70;棱块同理。 */
export const SQ1_LAYER_SPLITS = choose(8, 4);
/** OBL(orient both layers)= 角、棱两组各自选边 = 70 × 70。 */
export const SQ1_OBL_UNIVERSE = SQ1_LAYER_SPLITS ** 2;

/** 4 个元素的全排列,给 PBL 的类数现算用。 */
function perms4(): number[][] {
  const out: number[][] = [];
  const walk = (acc: number[], left: number[]) => {
    if (!left.length) { out.push([...acc]); return; }
    for (let i = 0; i < left.length; i++) {
      acc.push(left[i]);
      walk(acc, [...left.slice(0, i), ...left.slice(i + 1)]);
      acc.pop();
    }
  };
  walk([], [0, 1, 2, 3]);
  return out;
}

/**
 * 角块排列(CP)的情形数:上下各 4 个角共 4!·4! = 576 种摆法,但整层怎么转都还是同一个 PBL 情形
 * —— 上层 4 个、下层 4 个转位组成 16 元群。逐个规范化去重现数,不硬写 36。
 */
function cornerPermClasses(): number {
  const seen = new Set<string>();
  const all = perms4();
  for (const top of all) {
    for (const bot of all) {
      let best = '';
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          const key = [...top.slice(a), ...top.slice(0, a), ...bot.slice(b), ...bot.slice(0, b)].join('');
          if (!best || key < best) best = key;
        }
      }
      seen.add(best);
    }
  }
  return seen.size;
}

/** PBL 的角块情形数 = 36。 */
export const SQ1_CP_CASES = cornerPermClasses();
/** PBL 的棱块情形数 = 576:角块归位时已经把整层转位用掉了,这里不再商掉。 */
export const SQ1_EP_CASES = 24 * 24;
/** 整个 PBL = 角 × 棱 = 20,736。 */
export const SQ1_PBL_CASES = SQ1_CP_CASES * SQ1_EP_CASES;

/**
 * 「上下层各换一对相邻棱块」的棱块情形数:一层 4 条棱围成一圈,相邻对换有 4 个,两层相乘 = 16。
 * 逐个数出来 —— 一个置换算相邻对换,当且仅当它固定另外两块、且换掉的两块在圈上挨着。
 */
function adjAdjEdgeCases(): number {
  const isAdjSwap = (p: number[]): boolean => {
    const moved = p.map((v, i) => (v === i ? -1 : i)).filter((i) => i >= 0);
    if (moved.length !== 2) return false;
    const [i, j] = moved;
    return p[i] === j && p[j] === i && (j - i === 1 || (i === 0 && j === 3));
  };
  const adj = perms4().filter(isAdjSwap).length;
  return adj * adj;
}

/** 上下层各一对相邻棱互换的情形数 = 16。 */
export const SQ1_ADJ_ADJ_EP = adjAdjEdgeCases();

export interface Sq1Odds {
  /** 分子 / 分母,整数比;分母最大 20,736,Number 足够。 */
  num: number;
  den: number;
}

/**
 * 各阶段跳步的整数比:分母是该阶段的全集,分子是其中已还原的那些。
 *
 * 上游表格(`Cube Odds.xlsx` 的 SQ1 页)把 OBL 写作 2/4900 = 1/2450 —— 它把「整只上下翻过来」
 * 也算还原成功。同一套口径下 CO / EO 单看也该是 2/70,但表格那两格写的是 1/70,自相矛盾。
 * 本站统一按朝向固定计:CO 1/70、EO 1/70、OBL 1/4900,页面上把这处差异写明。
 */
export const SQ1_ODDS = {
  /** 打乱一上来就是立方体形状。 */
  cs: { num: SQ1_CUBE_SHAPES, den: SQ1_SHAPES } as Sq1Odds,
  /** 立方体形状且没有 parity —— 块的排列奇偶各占一半,与形状独立。 */
  csp: { num: SQ1_CUBE_SHAPES, den: SQ1_SHAPES * 2 } as Sq1Odds,
  /** 8 个角块正好分对层。 */
  co: { num: 1, den: SQ1_LAYER_SPLITS } as Sq1Odds,
  /** 8 个棱块正好分对层。 */
  eo: { num: 1, den: SQ1_LAYER_SPLITS } as Sq1Odds,
  /** 角、棱都分对层(OBL 跳步)。 */
  obl: { num: 1, den: SQ1_OBL_UNIVERSE } as Sq1Odds,
  /** 角块排列已好(PBL 只剩棱)。 */
  cp: { num: 1, den: SQ1_CP_CASES } as Sq1Odds,
  /** 棱块排列已好。 */
  ep: { num: 1, den: SQ1_EP_CASES } as Sq1Odds,
  /** 整个 PBL 跳过。 */
  pbl: { num: 1, den: SQ1_PBL_CASES } as Sq1Odds,
  /** 棱是「上下各一对相邻互换」那一类。 */
  adjAdjEp: { num: SQ1_ADJ_ADJ_EP, den: SQ1_EP_CASES } as Sq1Odds,
} as const;
