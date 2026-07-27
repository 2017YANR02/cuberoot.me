/**
 * EOCross(ZZ 的第一步:全部 12 条棱朝向正确 + 底面十字)在**全状态空间**上的精确深度分布。
 *
 * ## 状态空间恰好是 24,330,240,两种数法都能到
 *
 * 只有棱参与:4 条底棱**在哪个槽**(有序,12·11·10·9 = 11,880)× 全部 12 个槽的**翻转位**
 * (总翻转数恒为偶,故第 12 位由前 11 位定死,2¹¹ = 2,048)。两者相乘 = **24,330,240**。
 * 换个数法也一样:底棱的位置 + 自身朝向就是十字那 190,080 个态,余下 8 条棱的朝向再给 2⁷ = 128
 * —— 190,080 × 128 是同一个数。底棱在自己的槽里「朝向对」与「EO 好」是一回事(U/D 轴口径下,
 * D 层槽里 EO 好的棱底色就朝下),所以两种拆法不会打架。
 *
 * 目标态只有一个:4 条底棱各归各位 + 12 位全 0。
 *
 * ## 这份分布是自己跑出来的,不是抄的
 *
 * `3x3.xlsx` 的 `dist` 页有一张 `fixed eocross (fixed orientation)` 表。本文件的
 * `computeEoCrossDist()` 用站内棱层模型(`lib/cross-solver` 的 `EDGE_PERM` / `EDGE_FLIP`,
 * 那张表对着 40,000 条真题 × 6 底色验过)从头 BFS 一遍,逐档与它相同,均值也相同(7.530829494)。
 * 同页另一张 `EOFC` 表的分母写着 212,889,530,但它自己那一列**加起来是 212,889,600**
 * (累积那列最后一格因此溢到 1.000000329)—— 那是分母格的笔误,见 `docs/xlsx-stats-port.md`。
 *
 * ## 「固定轴」与站内真题列不是同一个口径
 *
 * 底面定死之后,EO 的轴还剩两条可选(F/B 与 L/R,差一个 y 旋转),两条都是合法的 ZZ 起手。
 * 本文件与表格都是**固定一条轴**;而站内 WCA 真题那列(`stats/scramble/*.json` 的
 * `variants.eo.data.eo_cross`)来自 Rust `eo_cross_analyzer`,它的 `fold_cross_sym_to_rot`
 * 把 12 个 sym 两两取 min —— 即**两条轴取更短的那条**。差距不小:固定轴均值 7.531,
 * 真题那列 7.219。`tests/eocross_dist.test.ts` 拿 `solver/testdata` 的 100 条打乱逐格验过:
 * 两轴取 min 100/100 对上真题列,固定轴只对上 66(黄底)/ 84(白底)。
 *
 * 所以页面上这一格**不叠加真题对照** —— 不是没有数据,是两列量的不是同一件事。
 * (顺带:客户端 `/scramble/analyzer` 的 EOCross wasm 走的是固定轴,与本文件一致,与管道那列不一致。)
 *
 * ## 别在浏览器里跑
 *
 * BFS 要 24MB 距离表 + 96MB 队列,约 7 秒。页面读常量,`tests/eocross_dist.test.ts` 每次跑都重算。
 */

import { EDGE_FACE_SLOTS, EDGE_FLIP, EDGE_PERM, parseHtmMoves } from '@/lib/cross-solver';

/** 4 条底棱的有序位置数。 */
export const EO_CROSS_POS = 12 * 11 * 10 * 9;   // 11,880
/** 12 个槽的翻转位,偶数个 1。 */
export const EO_CROSS_EO = 2 ** 11;             // 2,048
export const EO_CROSS_TOTAL = EO_CROSS_POS * EO_CROSS_EO;   // 24,330,240
/** 上帝之数(HTM)。 */
export const EO_CROSS_MAX = 10;

/** `EDGE_PERM` 的逆:转 m 之后,slot i 上的东西去了哪个 slot。 */
const INV: number[][] = EDGE_PERM.map((p) => {
  const inv = new Array<number>(12);
  for (let i = 0; i < 12; i++) inv[p[i]] = i;
  return inv;
});

function rankPos(slots: ArrayLike<number>): number {
  const avail = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let rank = 0;
  for (let k = 0; k < 4; k++) {
    const p = avail.indexOf(slots[k]);
    rank = rank * (12 - k) + p;
    avail.splice(p, 1);
  }
  return rank;
}

function unrankPos(rank: number, out: Int32Array): void {
  const p3 = rank % 9; rank = (rank - p3) / 9;
  const p2 = rank % 10; rank = (rank - p2) / 10;
  const p1 = rank % 11; rank = (rank - p1) / 11;
  const avail = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const ps = [rank, p1, p2, p3];
  for (let k = 0; k < 4; k++) { out[k] = avail[ps[k]]; avail.splice(ps[k], 1); }
}

/** 翻转位下标 → 12 位 mask(补上由奇偶定死的第 0 位)。 */
const maskOfEo = (idx: number): number => {
  const hi = idx << 1;
  let pc = 0;
  for (let b = 1; b < 12; b++) if (hi & (1 << b)) pc++;
  return hi | (pc & 1);
};

export interface EoCrossTables {
  /** posNext[p·18 + m] = 位置坐标经 m 之后的值。 */
  posNext: Int32Array;
  /** eoNext[e·18 + m] = 翻转坐标经 m 之后的值。 */
  eoNext: Int32Array;
}

let cachedTables: EoCrossTables | null = null;

/** 两个坐标的转移表(各自很小,建表毫秒级)。 */
export function eoCrossTables(): EoCrossTables {
  if (cachedTables) return cachedTables;

  const posNext = new Int32Array(EO_CROSS_POS * 18);
  const s = new Int32Array(4);
  const ns = new Int32Array(4);
  for (let i = 0; i < EO_CROSS_POS; i++) {
    unrankPos(i, s);
    for (let m = 0; m < 18; m++) {
      for (let k = 0; k < 4; k++) ns[k] = INV[m][s[k]];
      posNext[i * 18 + m] = rankPos(ns);
    }
  }

  const eoNext = new Int32Array(EO_CROSS_EO * 18);
  for (let i = 0; i < EO_CROSS_EO; i++) {
    const mask = maskOfEo(i);
    for (let m = 0; m < 18; m++) {
      let next = 0;
      for (let j = 0; j < 12; j++) {
        const dest = INV[m][j];
        if ((((mask >> j) & 1) ^ EDGE_FLIP[m][dest]) === 1) next |= 1 << dest;
      }
      eoNext[i * 18 + m] = next >> 1;
    }
  }

  cachedTables = { posNext, eoNext };
  return cachedTables;
}

/** 打乱串 → EOCross 坐标(底色黄 = D 面)。无法归约成面转时返回 null。 */
export function eoCrossIndex(scramble: string, face: keyof typeof EDGE_FACE_SLOTS = 'Yellow'): number | null {
  const moves = parseHtmMoves(scramble);
  if (moves === null) return null;
  const { posNext, eoNext } = eoCrossTables();
  let pos = rankPos(EDGE_FACE_SLOTS[face]);
  let eo = 0;
  for (const m of moves) {
    pos = posNext[pos * 18 + m];
    eo = eoNext[eo * 18 + m];
  }
  return pos * EO_CROSS_EO + eo;
}

/** y 共轭:F→R B→L R→B L→F,U/D 不动。换轴只换这一层记号,底面不变。 */
const Y_CONJ: Record<string, string> = { U: 'U', D: 'D', F: 'R', B: 'L', R: 'B', L: 'F' };

/**
 * 同一条打乱、同一个底面,**另一条 EO 轴**的坐标。
 *
 * 底面在 U/D 时两条候选轴是 F/B 与 L/R,差一个 y 旋转,故把打乱按 y 共轭再读一次即可
 * (共轭后底面不动,原来的 L/R 轴落到 F/B 轴上,正好落进同一张距离表)。
 * 只对 U/D 底面成立 —— 别的底面与本模型的翻转轴不是这个关系,直接拒。
 */
export function eoCrossAltAxisIndex(scramble: string, face: 'White' | 'Yellow' = 'Yellow'): number | null {
  const conj = scramble.trim().split(/\s+/).map((t) => (Y_CONJ[t[0]] ?? '') + t.slice(1)).join(' ');
  return eoCrossIndex(conj, face);
}

/**
 * 全空间 BFS。**只在测试里跑** —— 24MB 距离表 + 96MB 队列,约 7 秒。
 * 返回距离表本身,调用方可以顺便挑出某一档的全部状态(如 d=10 的 140 个)。
 */
export function computeEoCrossDist(face: keyof typeof EDGE_FACE_SLOTS = 'Yellow'): {
  dist: Uint8Array;
  hist: number[];
} {
  const { posNext, eoNext } = eoCrossTables();
  const dist = new Uint8Array(EO_CROSS_TOTAL).fill(255);
  const queue = new Int32Array(EO_CROSS_TOTAL);
  let head = 0;
  let tail = 0;

  const start = rankPos(EDGE_FACE_SLOTS[face]) * EO_CROSS_EO;
  dist[start] = 0;
  queue[tail++] = start;

  while (head < tail) {
    const cur = queue[head++];
    const d = dist[cur] + 1;
    const posRow = ((cur / EO_CROSS_EO) | 0) * 18;
    const eoRow = (cur % EO_CROSS_EO) * 18;
    for (let m = 0; m < 18; m++) {
      const next = posNext[posRow + m] * EO_CROSS_EO + eoNext[eoRow + m];
      if (dist[next] === 255) { dist[next] = d; queue[tail++] = next; }
    }
  }

  const hist: number[] = [];
  for (let i = 0; i < EO_CROSS_TOTAL; i++) {
    const d = dist[i];
    hist[d] = (hist[d] ?? 0) + 1;
  }
  return { dist, hist };
}

/** `computeEoCrossDist()` 的结果,下标 = 步数。CI 每次重算并逐档断言。 */
export const EO_CROSS_HIST: readonly number[] = [
  1, 15, 178, 1_982, 21_041, 204_732, 1_645_039, 8_477_633, 12_917_628, 1_061_851, 140,
];

/** 平均步数(表格同样给到 9 位小数)。 */
export const EO_CROSS_MEAN = 7.530829494;
