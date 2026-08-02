/**
 * pyraminx-solver —— 金字塔(Pyraminx)的「画状态」模型 + 任意所画状态的最优解,纯 TS、零下载表、
 * 零 worker。与二阶 `pocket-facelet` / 斜转 `skewb-solver` 同一条路子:打乱框走 Rust WASM 精确表,
 * 画板这条路本地即时算。
 *
 * **状态 = 36 格颜色本身**(face×9,面序 F D L R,格序见 pyraminx_svg 头部那张图)。金字塔的每个
 * 件都由自己的颜色组合唯一确定(4 个轴块各 3 色、6 个棱块各 2 色 —— C(4,3)=4、C(4,2)=6,恰好一一
 * 对应、无重复),所以看到的颜色就是完整状态,不必另建 piece/orientation 层。
 *
 * 招式语义**单一源 = tnoodle**:`PyraminxState.turnBody` / `turnTipOnly` 是 WCA 打乱器自己的置换表,
 * 本文件运行时把它读成 36 元置换,所以画板、预览图、tnoodle PDF 三者永远同一个魔方。
 *
 * 坐标三分(全部**运行时**从置换群推,不誊抄):
 *   · 尖块(tip)—— 只被 `turnTipOnly` 动的那 12 格;4 个尖各自 3 态,彼此独立。
 *   · 轴块(axial)—— 核心里群轨道大小 3 的那 12 格:位置永不变,只自转 ⇒ 3⁴ = 81 态。
 *   · 棱块(edge)—— 核心里群轨道大小 12 的那 12 格 ⇒ 11,520 态。
 * 核心 = 81 × 11,520 = 933,120(公布值),在乘积上 BFS 出精确距离表(Uint8Array,~0.9MB)。
 *
 * **尖块不能事后随便贴上**:tnoodle 的层转(大写 U/L/R/B)会连带转动同名的尖(`turnBody` 里就调了
 * `turnTipOnly`),所以「先最优解核心、再补尖」未必最优 —— 一条同样长的核心解可能顺手把尖也转对了。
 * 这里给的是**真最优**:尖 i 的末态只取决于「初值 + 落在轴 i 上的转数之和」,于是沿距离表的全部
 * 最优路径做一次 (核心态, 尖向量) 的记忆化 DP,取「尖没转对的个数」最小的那条(每个歪的尖恰好补 1 步)。
 * 上限 15 步 = 核心 11 + 尖 4,与 WCA / 现有 Rust 求解器同口径。
 */

import { PyraminxState } from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import { derivePieceBlocks } from './piece-blocks';

/** 面序 = tnoodle 的 F D L R。 */
export const PYRA_FACES = ['F', 'D', 'L', 'R'] as const;
export type PyraFace = (typeof PYRA_FACES)[number];

export const PYRA_SLOTS_PER_FACE = 9;
export const PYRA_STICKERS = 36;
/** 一种颜色正好 9 格(一整面)。 */
export const PYRA_STICKERS_PER_COLOR = 9;
/** 上帝之数(含尖块,每次转动算 1 步):核心 11 + 4 个尖。 */
export const PYRA_GODS_NUMBER = 15;
/** 核心(不含尖)的上帝之数。 */
export const PYRA_CORE_GODS_NUMBER = 11;
/** 核心全空间态数(公布值);建表时会实测校验。 */
export const PYRA_CORE_STATE_COUNT = 933_120;

/** tnoodle 的轴序(`PyraminxState.applyMove` 里 `'ulrb'.indexOf`)。 */
const AXIS_LETTERS = 'ULRB';

/** 从 tnoodle 的一次转动读出 36 元置换:`perm[i]` = 转完后 slot i 上的东西原来在哪。 */
function readPerm(turn: (st: PyraminxState) => void): Uint8Array {
  const st = new PyraminxState();
  turn(st);
  const p = new Uint8Array(PYRA_STICKERS);
  for (let f = 0; f < 4; f++) {
    for (let s = 0; s < PYRA_SLOTS_PER_FACE; s++) p[f * PYRA_SLOTS_PER_FACE + s] = st.image[f][s];
  }
  return p;
}

function compose(p: Uint8Array): Uint8Array {
  const out = new Uint8Array(PYRA_STICKERS);
  for (let i = 0; i < PYRA_STICKERS; i++) out[i] = p[p[i]];
  return out;
}

/** 8 个核心生成元(层转,含带动同名尖):轴 0..3 × 转 1/2 次。 */
const CORE_PERMS: readonly Uint8Array[] = (() => {
  const out: Uint8Array[] = [];
  for (let a = 0; a < 4; a++) {
    const p1 = readPerm((st) => st.turnBody(a));
    out.push(p1, compose(p1));
  }
  return out;
})();

/** 8 个尖生成元。 */
const TIP_PERMS: readonly Uint8Array[] = (() => {
  const out: Uint8Array[] = [];
  for (let a = 0; a < 4; a++) {
    const p1 = readPerm((st) => st.turnTipOnly(a));
    out.push(p1, compose(p1));
  }
  return out;
})();

/** 招式名:大写 = 层转(带尖),小写 = 只转尖;带撇 = 转 2 次(与 tnoodle 解析一致)。 */
export const PYRA_CORE_MOVE_NAMES: readonly string[] = (() => {
  const out: string[] = [];
  for (let a = 0; a < 4; a++) for (const turns of [1, 2]) out.push(AXIS_LETTERS[a] + (turns === 2 ? "'" : ''));
  return out;
})();
export const PYRA_TIP_MOVE_NAMES: readonly string[] = PYRA_CORE_MOVE_NAMES.map((n) => n.toLowerCase().replace("'", "'"));

const CORE_MOVE_INVERSE: readonly number[] = PYRA_CORE_MOVE_NAMES.map((_, mi) => (mi % 2 === 0 ? mi + 1 : mi - 1));

/** slot 在给定生成元下的轨道大小。 */
function orbitSize(perms: readonly Uint8Array[], slot: number): number {
  const seen = new Set<number>([slot]);
  const stack = [slot];
  while (stack.length) {
    const v = stack.pop()!;
    for (const p of perms) { const w = p[v]; if (!seen.has(w)) { seen.add(w); stack.push(w); } }
  }
  return seen.size;
}

const ALL_SLOTS = Array.from({ length: PYRA_STICKERS }, (_, i) => i);

/** 尖块的 12 格 = 被尖生成元动到的那些。 */
export const PYRA_TIP_SLOTS: readonly number[] = ALL_SLOTS.filter((s) => TIP_PERMS.some((p) => p[s] !== s));
/** 轴块的 12 格 = 核心里轨道大小 3 的(位置永不变、只自转)。 */
export const PYRA_AXIAL_SLOTS: readonly number[] = ALL_SLOTS
  .filter((s) => !PYRA_TIP_SLOTS.includes(s) && orbitSize(CORE_PERMS, s) === 3);
/** 棱块的 12 格 = 核心里剩下的(同一个大小 12 的轨道)。 */
export const PYRA_EDGE_SLOTS: readonly number[] = ALL_SLOTS
  .filter((s) => !PYRA_TIP_SLOTS.includes(s) && !PYRA_AXIAL_SLOTS.includes(s));

const faceOf = (slot: number) => Math.floor(slot / PYRA_SLOTS_PER_FACE);
/** 块内颜色必须互不相同(金字塔 4 个面两两相邻,没有「对面色」这条规则)。 */
const distinctFaces = (block: readonly number[]) => new Set(block.map(faceOf)).size === block.length;

/** 尖块 / 轴块各是一个大小 3 的轨道 —— 直接取轨道即可,不必搜块系统。 */
function orbitBlocks(perms: readonly Uint8Array[], slots: readonly number[]): number[][] {
  const seenSlots = new Set<number>();
  const out: number[][] = [];
  for (const s of slots) {
    if (seenSlots.has(s)) continue;
    const block = new Set<number>([s]);
    const stack = [s];
    while (stack.length) {
      const v = stack.pop()!;
      for (const p of perms) { const w = p[v]; if (!block.has(w)) { block.add(w); stack.push(w); } }
    }
    const sorted = [...block].sort((a, b) => a - b);
    for (const v of sorted) seenSlots.add(v);
    out.push(sorted);
  }
  return out;
}

/**
 * 尖块按**轴序**排(第 i 项 = 轴 i 那个尖),不是按 slot 序 —— 尖的转数要和层转带动的那个尖对上,
 * 所以必须由「轴 i 的尖转动了哪 3 格」来定。
 */
export const PYRA_TIP_BLOCKS: ReadonlyArray<readonly number[]> = Array.from({ length: 4 }, (_, a) => {
  const p = TIP_PERMS[a * 2];
  return ALL_SLOTS.filter((s) => p[s] !== s).sort((x, y) => x - y);
});

/**
 * 「轴 i 的尖上 block[0] 这格现在是什么颜色」→「它相对还原态转了几次」。
 *
 * 别拿「排序下标之差」当转数:尖的 3-循环走的顺序未必是 slot 升序,那样算出来的 k 会和 tnoodle 的
 * 转动方向脱钩(实测就是这里错的 —— 反推的打乱复现不出所画状态)。这里直接用 tnoodle 的尖转把
 * 还原态转 0/1/2 次,记下 block[0] 的颜色,查表得到的 k 就是真·转数。
 */
const TIP_TURNS_BY_COLOR: ReadonlyArray<ReadonlyMap<number, number>> = PYRA_TIP_BLOCKS.map((block, a) => {
  const lut = new Map<number, number>();
  let cur = Uint8Array.from(ALL_SLOTS, faceOf);
  const p = TIP_PERMS[a * 2];
  for (let j = 0; j < 3; j++) {
    lut.set(cur[block[0]], j);
    const nxt = new Uint8Array(PYRA_STICKERS);
    for (let i = 0; i < PYRA_STICKERS; i++) nxt[i] = cur[p[i]];
    cur = nxt;
  }
  return lut;
});
export const PYRA_AXIAL_BLOCKS: ReadonlyArray<readonly number[]> = orbitBlocks(CORE_PERMS, PYRA_AXIAL_SLOTS);
/** 12 张棱贴纸同属一个大小 12 的轨道,块系统要靠群不变划分搜出来。 */
export const PYRA_EDGE_BLOCKS: ReadonlyArray<readonly number[]> = derivePieceBlocks(
  CORE_PERMS, PYRA_STICKERS,
  { slots: PYRA_EDGE_SLOTS, blockSize: 2, acceptBlock: distinctFaces },
);

export const PYRA_STICKER_SIBLINGS: ReadonlyArray<readonly number[]> = (() => {
  const out: number[][] = Array.from({ length: PYRA_STICKERS }, () => []);
  for (const block of [...PYRA_TIP_BLOCKS, ...PYRA_AXIAL_BLOCKS, ...PYRA_EDGE_BLOCKS]) {
    for (const s of block) out[s] = block.filter((o) => o !== s);
  }
  return out;
})();

// ─── facelet 串(36 字符,与其它画板同一种表示) ───

export const SOLVED_PYRA_FACELET = PYRA_FACES.map((f) => f.repeat(PYRA_SLOTS_PER_FACE)).join('');
export const EMPTY_PYRA_FACELET = 'X'.repeat(PYRA_STICKERS);

function faceletColors(facelet: string): Uint8Array | null {
  if (facelet.length !== PYRA_STICKERS) return null;
  const out = new Uint8Array(PYRA_STICKERS);
  for (let i = 0; i < PYRA_STICKERS; i++) {
    const c = (PYRA_FACES as readonly string[]).indexOf(facelet[i]);
    if (c < 0) return null;
    out[i] = c;
  }
  return out;
}

/** 把一段打乱作用到还原态 —— 走 tnoodle 自己的解析器,和预览图零偏差。 */
export function pyraFaceletFromMoves(scramble: string): string {
  const st = new PyraminxState();
  st.applyAlgorithm(scramble);
  const out: string[] = [];
  for (let f = 0; f < 4; f++) {
    for (let s = 0; s < PYRA_SLOTS_PER_FACE; s++) {
      out.push(PYRA_FACES[Math.floor(st.image[f][s] / PYRA_SLOTS_PER_FACE)]);
    }
  }
  return out.join('');
}

// ─── 坐标枚举 + 核心精确距离表 ───

interface Coord {
  slots: readonly number[];
  index: Map<string, number>;
  moveTable: Int32Array;
  n: number;
}

const coordKey = (a: Uint8Array): string => String.fromCharCode(...a);

function buildCoord(slots: readonly number[]): Coord {
  const loc = new Map<number, number>();
  slots.forEach((s, i) => loc.set(s, i));
  const localPerm = CORE_PERMS.map((p) => Int32Array.from(slots, (s) => {
    const src = loc.get(p[s]);
    if (src === undefined) throw new Error('pyraminx-solver: 招式把件换出了自己的坐标(置换表读错了)');
    return src;
  }));

  const n = slots.length;
  const solved = Uint8Array.from(slots, faceOf);
  const index = new Map<string, number>([[coordKey(solved), 0]]);
  const states: Uint8Array[] = [solved];
  const moves: number[] = [];

  for (let qi = 0; qi < states.length; qi++) {
    const cur = states[qi];
    for (let m = 0; m < CORE_PERMS.length; m++) {
      const lp = localPerm[m];
      const nxt = new Uint8Array(n);
      for (let i = 0; i < n; i++) nxt[i] = cur[lp[i]];
      const k = coordKey(nxt);
      let id = index.get(k);
      if (id === undefined) { id = states.length; index.set(k, id); states.push(nxt); }
      moves[qi * CORE_PERMS.length + m] = id;
    }
  }
  return { slots, index, moveTable: Int32Array.from(moves), n: states.length };
}

export interface PyraGraph {
  axial: Coord;
  edge: Coord;
  /** 核心精确最优步数表,idx = axialIdx · edge.n + edgeIdx。 */
  dist: Uint8Array;
  total: number;
  /** 招式 m 给自己那个尖加的转数(mod 3),下标同 PYRA_CORE_MOVE_NAMES。 */
  tipDelta: Int32Array;
  /** 招式 m 动的是哪个轴的尖。 */
  tipAxis: Int32Array;
}

let cached: PyraGraph | null = null;

export function pyraGraph(): PyraGraph {
  if (cached) return cached;

  const axial = buildCoord(PYRA_AXIAL_SLOTS);
  const edge = buildCoord(PYRA_EDGE_SLOTS);
  const total = axial.n * edge.n;
  const nMoves = CORE_PERMS.length;
  const nK = edge.n;

  const dist = new Uint8Array(total).fill(255);
  const qa = new Int32Array(total);
  const qe = new Int32Array(total);
  let head = 0;
  let tail = 0;
  dist[0] = 0;               // 两个坐标的 0 号都是还原态
  qa[tail] = 0; qe[tail] = 0; tail++;

  while (head < tail) {
    const a = qa[head];
    const e = qe[head];
    head++;
    const d = dist[a * nK + e] + 1;
    const aRow = a * nMoves;
    const eRow = e * nMoves;
    for (let m = 0; m < nMoves; m++) {
      const na = axial.moveTable[aRow + m];
      const ne = edge.moveTable[eRow + m];
      const nIdx = na * nK + ne;
      if (dist[nIdx] === 255) { dist[nIdx] = d; qa[tail] = na; qe[tail] = ne; tail++; }
    }
  }

  // 招式 m = 轴 (m>>1)、转 (m&1 ? 2 : 1) 次,带着同名尖一起转同样的次数。
  const tipDelta = Int32Array.from({ length: nMoves }, (_, m) => ((m & 1) ? 2 : 1));
  const tipAxis = Int32Array.from({ length: nMoves }, (_, m) => m >> 1);

  cached = { axial, edge, dist, total, tipDelta, tipAxis };
  return cached;
}

// ─── 校验 / 求解 ───

export function validatePyraFacelet(facelet: string): string | null {
  const colors = faceletColors(facelet);
  if (!colors) return 'bad facelet string';

  const counts = new Array<number>(4).fill(0);
  for (const c of colors) counts[c]++;
  if (counts.some((n) => n !== PYRA_STICKERS_PER_COLOR)) return `color counts != ${PYRA_STICKERS_PER_COLOR}`;

  for (const block of PYRA_TIP_BLOCKS) if (new Set(block.map((s) => colors[s])).size !== 3) return 'tip has duplicate colors';
  for (const block of PYRA_AXIAL_BLOCKS) if (new Set(block.map((s) => colors[s])).size !== 3) return 'axial has duplicate colors';
  for (const block of PYRA_EDGE_BLOCKS) if (colors[block[0]] === colors[block[1]]) return 'edge has duplicate colors';

  const g = pyraGraph();
  if (!g.axial.index.has(coordKey(Uint8Array.from(PYRA_AXIAL_SLOTS, (s) => colors[s])))) return 'axial arrangement unreachable';
  if (!g.edge.index.has(coordKey(Uint8Array.from(PYRA_EDGE_SLOTS, (s) => colors[s])))) return 'edge arrangement unreachable';
  return null;
}

export function friendlyPyraErr(msg: string, isZh: boolean): string {
  const t = (z: string, e: string) => (isZh ? z : e);
  if (msg.includes('color counts')) return t('每种颜色必须正好 9 格', 'Each color must appear exactly 9 times');
  if (msg.includes('tip has')) return t('一个尖块上不能有重复颜色', 'A tip cannot have two stickers of the same color');
  if (msg.includes('axial has')) return t('一个轴块上不能有重复颜色', 'An axial piece cannot have two stickers of the same color');
  if (msg.includes('edge has')) return t('一个棱块上不能有重复颜色', 'An edge cannot have two stickers of the same color');
  if (msg.includes('axial arrangement')) return t('这组轴块摆不出来(朝向不可能)', 'This axial arrangement is unreachable');
  if (msg.includes('edge arrangement')) return t('这组棱块摆不出来(排列或翻转不可能)', 'This edge arrangement is unreachable (impossible permutation or flip)');
  return msg;
}

/** 尖向量:4 个尖各自相对还原态转了几次(mod 3),编码成 3 进制 4 位 = 0..80。 */
function tipVectorOf(colors: Uint8Array): number {
  let vec = 0;
  PYRA_TIP_BLOCKS.forEach((block, axis) => {
    const k = TIP_TURNS_BY_COLOR[axis].get(colors[block[0]]) ?? 0;
    vec += k * 3 ** axis;
  });
  return vec;
}

const tipDigit = (vec: number, axis: number) => Math.floor(vec / 3 ** axis) % 3;

export interface PyraSolution {
  /** 总步数 = 核心步数 + 歪着的尖数(每个补 1 步)。 */
  length: number;
  solution: string;
  coreLength: number;
  tipLength: number;
}

/**
 * 沿距离表的全部最优核心路径做记忆化 DP,选「走完之后歪着的尖最少」的那条 —— 层转会带动同名尖,
 * 所以这一步才是真最优(先解核心再补尖可能多花 1-2 步)。
 */
function solveFrom(g: PyraGraph, axialIdx: number, edgeIdx: number, tipVec: number): PyraSolution {
  const nK = g.edge.n;
  const nMoves = CORE_PERMS.length;
  const memo = new Map<number, number>();

  const tipsOff = (vec: number) => {
    let n = 0;
    for (let a = 0; a < 4; a++) if (tipDigit(vec, a) !== 0) n++;
    return n;
  };

  // best = 走完剩余最优核心路径后,最少还要补几步尖。
  const best = (aIdx: number, eIdx: number, vec: number): number => {
    const idx = aIdx * nK + eIdx;
    const d = g.dist[idx];
    if (d === 0) return tipsOff(vec);
    const key = idx * 81 + vec;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let out = 5;
    for (let m = 0; m < nMoves; m++) {
      const na = g.axial.moveTable[aIdx * nMoves + m];
      const ne = g.edge.moveTable[eIdx * nMoves + m];
      if (g.dist[na * nK + ne] !== d - 1) continue;
      const nVec = vec + ((tipDigit(vec, g.tipAxis[m]) + g.tipDelta[m]) % 3 - tipDigit(vec, g.tipAxis[m])) * 3 ** g.tipAxis[m];
      const cand = best(na, ne, nVec);
      if (cand < out) out = cand;
      if (out === 0) break;
    }
    memo.set(key, out);
    return out;
  };

  const core: string[] = [];
  let a = axialIdx;
  let e = edgeIdx;
  let vec = tipVec;
  let d = g.dist[a * nK + e];
  const target = best(a, e, vec);
  while (d > 0) {
    let stepped = false;
    for (let m = 0; m < nMoves; m++) {
      const na = g.axial.moveTable[a * nMoves + m];
      const ne = g.edge.moveTable[e * nMoves + m];
      if (g.dist[na * nK + ne] !== d - 1) continue;
      const axis = g.tipAxis[m];
      const nVec = vec + ((tipDigit(vec, axis) + g.tipDelta[m]) % 3 - tipDigit(vec, axis)) * 3 ** axis;
      if (best(na, ne, nVec) !== target) continue;   // 只走能达到最优尖数的那条
      core.push(PYRA_CORE_MOVE_NAMES[m]);
      a = na; e = ne; vec = nVec; d--; stepped = true;
      break;
    }
    if (!stepped) throw new Error('pyraminx-solver: 梯度下降卡住(距离表坏了)');
  }

  // 剩下的尖各补一步:转了 1 格要补 2 格(= 带撇),转了 2 格补 1 格(= 裸)。
  const tips: string[] = [];
  for (let axis = 0; axis < 4; axis++) {
    const k = tipDigit(vec, axis);
    if (k === 0) continue;
    tips.push(AXIS_LETTERS[axis].toLowerCase() + (k === 1 ? "'" : ''));
  }

  return {
    length: core.length + tips.length,
    coreLength: core.length,
    tipLength: tips.length,
    solution: [...core, ...tips].join(' '),
  };
}

function faceletToCoords(facelet: string): { axialIdx: number; edgeIdx: number; tipVec: number } {
  const colors = faceletColors(facelet);
  if (!colors) throw new Error('pyraminx-solver: facelet 串不合法');
  const g = pyraGraph();
  const axialIdx = g.axial.index.get(coordKey(Uint8Array.from(PYRA_AXIAL_SLOTS, (s) => colors[s])));
  const edgeIdx = g.edge.index.get(coordKey(Uint8Array.from(PYRA_EDGE_SLOTS, (s) => colors[s])));
  if (axialIdx === undefined || edgeIdx === undefined) throw new Error('pyraminx-solver: 这个状态不可达');
  return { axialIdx, edgeIdx, tipVec: tipVectorOf(colors) };
}

/** 所画状态的最优解(含尖块)。 */
export function solvePyraFacelet(facelet: string): PyraSolution {
  const g = pyraGraph();
  const { axialIdx, edgeIdx, tipVec } = faceletToCoords(facelet);
  return solveFrom(g, axialIdx, edgeIdx, tipVec);
}

/** 取逆一段金字塔招式串(倒序 + 每步取逆);大小写保留(大写层转 / 小写只转尖)。 */
export function invertPyraAlg(text: string): string {
  const out: string[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const m = /^([ULRBulrb])(['2]?)$/.exec(raw);
    if (!m) continue;
    const letter = m[1];
    const turns = m[2] === "'" ? 2 : 1;   // tnoodle:撇 = 2 次,裸 / `2` = 1 次
    out.unshift(letter + (turns === 1 ? "'" : ''));
  }
  return out.join(' ');
}

/** 反推一条到达所画状态的打乱 = 最优解取逆。 */
export function derivePyraScramble(facelet: string): string {
  return invertPyraAlg(solvePyraFacelet(facelet).solution);
}

/**
 * 与 `scramble` **状态完全相同**、但绕了一段随机远路的等价打乱(≈10-15 步)。
 *
 * 公式库里的 setup 都是最少步(金字塔 L4E 多为 4-7 步),照着念一遍就等于把答案倒背了一遍 ——
 * 打乱完手还记得最后三步,练的是记忆不是识别(issue #64)。这里换一条到达同一状态的长路:
 * 先随机走 `detour` 步 R,再把「剩下要补的那个群元」= R⁻¹·S 解出来取逆接在后面。乘起来
 * 恰好还是 S,所以**摆出来的魔方一模一样**(连尖块朝向都一样),只是没法反推。
 *
 * 尾段走的是随机剩余态的最优解,不是 case 本身 —— 结构上与 case 无关,记不住。
 * 求解本身是本地精确表(建表 ~240ms 一次,之后每条 ~0.1ms),同步返回。
 */
export function equivalentPyraScramble(
  scramble: string,
  opts?: { detour?: number; rng?: () => number },
): string {
  const src = scramble.trim();
  // 一个认得的记号都没有(空串 / 别的拼图的记号):原样退回。tnoodle 的解析器对认不出的
  // token 是**静默跳过**,不是抛错 —— 不先拦一道的话,这里会给一段「什么都没做」的乱码
  // 编出一条 12 步的假打乱。
  if (!invertPyraAlg(src)) return src;
  const rand = opts?.rng ?? Math.random;
  const detour = Math.max(1, opts?.detour ?? 6);

  const randomHead = (n: number): string[] => {
    const head: string[] = [];
    let lastAxis = -1;
    for (let i = 0; i < n; i++) {
      let axis: number;
      do { axis = Math.floor(rand() * 4); } while (axis === lastAxis); // 同轴连出会自相抵消
      lastAxis = axis;
      head.push(AXIS_LETTERS[axis] + (rand() < 0.5 ? '' : "'"));
    }
    return head;
  };

  const tokens = (s: string) => (s ? s.split(/\s+/).length : 0);
  // 「明显更长」得是真的:尾段是残态的**最优**解,长度不受控,偶尔短到三步 —— detour 6 + 3
  // 就没比一条 7 步 setup 长多少,答案又快念出来了。所以给个下限,不够就把远路加长重来。
  const floor = tokens(src) + 3;

  try {
    const target = pyraFaceletFromMoves(src);
    let best = '';
    // 加长到远路自己就够 floor 为止(尾段只会再加长度),所以下限一定够得到;每轮重试
    // 只是一次查表求解(~0.1ms)。
    for (let len = detour; len <= Math.max(detour, floor); len++) {
      const head = randomHead(len).join(' ');
      const residual = pyraFaceletFromMoves(`${invertPyraAlg(head)} ${src}`);
      const out = `${head} ${derivePyraScramble(residual)}`.trim();
      // 兜底:算出来的东西必须真的摆成同一个状态,否则宁可用原打乱(错打乱 = 错练)
      if (pyraFaceletFromMoves(out) !== target) continue;
      if (tokens(out) >= floor) return out;
      if (tokens(out) > tokens(best)) best = out;
    }
    return best || src;
  } catch {
    return src;
  }
}

/** 随机合法状态:核心随机走 10 步(同轴不连出)+ 4 个尖各自随机。 */
export function randomLegalPyraFacelet(): string {
  const tokens: string[] = [];
  let lastAxis = -1;
  for (let i = 0; i < 10; i++) {
    let axis: number;
    do { axis = Math.floor(Math.random() * 4); } while (axis === lastAxis);
    lastAxis = axis;
    tokens.push(AXIS_LETTERS[axis] + (Math.random() < 0.5 ? '' : "'"));
  }
  for (let axis = 0; axis < 4; axis++) {
    const k = Math.floor(Math.random() * 3);
    if (k) tokens.push(AXIS_LETTERS[axis].toLowerCase() + (k === 1 ? '' : "'"));
  }
  return pyraFaceletFromMoves(tokens.join(' '));
}

/** 空闲时先把核心距离表建好。 */
export function prewarmPyraGraph(): void {
  pyraGraph();
}

/** 核心全空间统计(测试 / 分布视图用)。 */
export function pyraGraphStats(): { total: number; histogram: number[]; axials: number; edges: number } {
  const g = pyraGraph();
  const histogram: number[] = [];
  for (let i = 0; i < g.total; i++) {
    const d = g.dist[i];
    if (d === 255) continue;
    histogram[d] = (histogram[d] ?? 0) + 1;
  }
  for (let i = 0; i < histogram.length; i++) histogram[i] ??= 0;
  return { total: g.total, histogram, axials: g.axial.n, edges: g.edge.n };
}

/** 招式下标 → 逆招下标(测试用)。 */
export const PYRA_CORE_MOVE_INVERSE = CORE_MOVE_INVERSE;
