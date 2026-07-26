/**
 * skewb-solver —— 斜转(Skewb)的「画状态」模型 + 任意所画状态的最优解,纯 TS、零下载表、零 worker。
 *
 * 与二阶 `pocket-facelet` 同一条路子:`/scramble/solver?event=skewb` 的打乱框走 Rust WASM 精确表,
 * 而画板这条路本地即时算 —— 涂满就出解,不用点按钮。上帝之数 11(每 120° 转一步),全空间 3,149,280 态。
 *
 * **状态 = 30 格颜色本身**(face×5,面序 U R F D L B,格序 0=中心菱形,1..4 = 四个角三角)。斜转的
 * 每个角块由 3 个**互不相同**的颜色唯一确定、每个中心由 1 个颜色确定,所以「看到的颜色」就是完整状态,
 * 不需要另建一层 piece/orientation 模型 —— 也就不存在两套坐标系对不上的风险(斜转和金字塔的展开图各面
 * 朝向不同,手抄「哪三格是一个角」几乎必错)。
 *
 * 招式语义**单一源 = tnoodle**:`SkewbState.turnOnce` 就是 WCA 打乱器自己的置换表,本文件运行时把它
 * 读成 30 元置换(`axisPerm`),所以画板、预览图、tnoodle PDF 三者永远同一个魔方。4 个轴 R U L B ×
 * {1 转, 2 转} = 8 个生成元(`R'` 在 tnoodle 里就是转两次),恰是 WCA 打乱用的那 4 个把手。
 *
 * 坐标分解(全部**运行时枚举**,不誊抄常数):角的 24 格与中心的 6 格在任何招式下互不混合,于是
 *   idx = cornerIdx · nCenter + centerIdx
 * 是全空间的完美索引。两个坐标各自 BFS 枚举可达集(角 52,488 / 中心 60),再在乘积上 BFS 出精确
 * 距离表(Uint8Array,~3.1MB),求解 = 沿距离递减梯度下降 ⇒ **可证最优**,没有搜索也没有启发式。
 * 「乘积恰好全可达」「表最大值 == 11」「可达总数 == 3,149,280」三条都在 tests/skewb_solver.test.ts
 * 里当 oracle 锁着 —— 任何一条崩了都说明置换表读错了。
 */

import { SkewbState } from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { derivePieceBlocks } from './piece-blocks';

/** 面序 = tnoodle 的 U R F D L B(与三阶 facelet 同序,故对面表也同款)。 */
export const SKEWB_FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type SkewbFace = (typeof SKEWB_FACES)[number];

export const SKEWB_SLOTS_PER_FACE = 5;
export const SKEWB_STICKERS = 30;
/** 一种颜色最多 5 格(一整面)。 */
export const SKEWB_STICKERS_PER_COLOR = 5;
/** 上帝之数(120° 转 = 1 步)。 */
export const SKEWB_GODS_NUMBER = 11;
/** 全空间态数(Jaap / WCA 通用值);建表时会实测校验。 */
export const SKEWB_STATE_COUNT = 3_149_280;

/** 对面色(下标即面序):U↔D、R↔L、F↔B。 */
const OPPOSITE: readonly number[] = [3, 4, 5, 0, 1, 2];

/** 6 个中心格(每面的 slot 0)。 */
export const SKEWB_CENTER_SLOTS: readonly number[] =
  Array.from({ length: 6 }, (_, f) => f * SKEWB_SLOTS_PER_FACE);
/** 24 个角格(每面的 slot 1..4)。 */
export const SKEWB_CORNER_SLOTS: readonly number[] = (() => {
  const out: number[] = [];
  for (let f = 0; f < 6; f++) for (let s = 1; s < SKEWB_SLOTS_PER_FACE; s++) out.push(f * SKEWB_SLOTS_PER_FACE + s);
  return out;
})();

/** tnoodle 的轴序(`SkewbState.applyMove` 里 `'RULB'.indexOf`)。 */
const AXIS_LETTERS = 'RULB';

/** 8 个生成元的记号:裸字母 = 转 1 次,带撇 = 转 2 次(与 tnoodle 的解析一致)。 */
export const SKEWB_MOVE_NAMES: readonly string[] = (() => {
  const out: string[] = [];
  for (let a = 0; a < 4; a++) for (const turns of [1, 2]) out.push(AXIS_LETTERS[a] + (turns === 2 ? "'" : ''));
  return out;
})();

/** 招式 mi 的逆(同轴、另一个转数)。 */
const MOVE_INVERSE: readonly number[] = SKEWB_MOVE_NAMES.map((_, mi) => (mi % 2 === 0 ? mi + 1 : mi - 1));

/**
 * 轴 `axis` 转一次的 30 元置换:`perm[i]` = 转完之后 slot i 上的东西原来在哪个 slot。
 * 直接从 tnoodle 的 `turnOnce` 读出来(初始 `image[f][s] = f*5+s`,所以转完读到的就是来源 slot)。
 */
function axisPerm(axis: number): Uint8Array {
  const st = new SkewbState();
  st.turnOnce(axis);
  const p = new Uint8Array(SKEWB_STICKERS);
  for (let f = 0; f < 6; f++) {
    for (let s = 0; s < SKEWB_SLOTS_PER_FACE; s++) p[f * SKEWB_SLOTS_PER_FACE + s] = st.image[f][s];
  }
  return p;
}

/** 8 个生成元的 30 元置换。 */
const MOVE_PERMS: readonly Uint8Array[] = (() => {
  const out: Uint8Array[] = [];
  for (let a = 0; a < 4; a++) {
    const p1 = axisPerm(a);
    const p2 = new Uint8Array(SKEWB_STICKERS);
    for (let i = 0; i < SKEWB_STICKERS; i++) p2[i] = p1[p1[i]];
    out.push(p1, p2);
  }
  return out;
})();

/**
 * 同块伙伴:角格各 2 个、中心格 0 个。块划分由 `derivePieceBlocks` 从置换群**自动**推出
 * (谓词:同块 3 色不得含对面色),不手抄。
 */
export const SKEWB_CORNER_BLOCKS: ReadonlyArray<readonly number[]> = derivePieceBlocks(
  MOVE_PERMS, SKEWB_STICKERS,
  {
    slots: SKEWB_CORNER_SLOTS,
    blockSize: 3,
    // 一个角块 = 3 个**互不相同且互不为对面**的面上的 3 张贴纸(还原态下贴纸颜色 = 所在面)。
    acceptBlock: (block) => {
      const cols = block.map((s) => Math.floor(s / SKEWB_SLOTS_PER_FACE));
      if (new Set(cols).size !== cols.length) return false;
      return !cols.some((c, i) => cols.some((d, j) => i !== j && OPPOSITE[c] === d));
    },
  },
);

export const SKEWB_STICKER_SIBLINGS: ReadonlyArray<readonly number[]> = (() => {
  const out: number[][] = Array.from({ length: SKEWB_STICKERS }, () => []);
  for (const block of SKEWB_CORNER_BLOCKS) {
    for (const s of block) out[s] = block.filter((o) => o !== s);
  }
  return out;
})();

// ─── facelet 串(30 字符,与三阶 / 二阶画板同一种表示,可直接喂 paintSticker) ───

export const SOLVED_SKEWB_FACELET = SKEWB_FACES.map((f) => f.repeat(SKEWB_SLOTS_PER_FACE)).join('');
export const EMPTY_SKEWB_FACELET = 'X'.repeat(SKEWB_STICKERS);

function faceIdx(ch: string): number {
  return (SKEWB_FACES as readonly string[]).indexOf(ch);
}

/** facelet → 颜色下标数组;有空缺 / 不认识的字符返回 null。 */
function faceletColors(facelet: string): Uint8Array | null {
  if (facelet.length !== SKEWB_STICKERS) return null;
  const out = new Uint8Array(SKEWB_STICKERS);
  for (let i = 0; i < SKEWB_STICKERS; i++) {
    const c = faceIdx(facelet[i]);
    if (c < 0) return null;
    out[i] = c;
  }
  return out;
}

/** 把一段打乱作用到还原态,返回 facelet —— 语义走 tnoodle 自己的解析器,和预览图零偏差。 */
export function skewbFaceletFromMoves(scramble: string): string {
  const st = new SkewbState();
  st.applyAlgorithm(scramble);
  const out: string[] = [];
  for (let f = 0; f < 6; f++) {
    for (let s = 0; s < SKEWB_SLOTS_PER_FACE; s++) {
      out.push(SKEWB_FACES[Math.floor(st.image[f][s] / SKEWB_SLOTS_PER_FACE)]);
    }
  }
  return out.join('');
}

// ─── 坐标枚举 + 精确距离表 ───

interface Coord {
  slots: readonly number[];
  /** [招式][局部下标] → 局部下标 */
  localPerm: Int32Array[];
  index: Map<string, number>;
  states: Uint8Array[];
  /** n × 8 */
  moveTable: Int32Array;
  n: number;
}

const coordKey = (a: Uint8Array): string => String.fromCharCode(...a);

function buildCoord(slots: readonly number[]): Coord {
  const loc = new Map<number, number>();
  slots.forEach((s, i) => loc.set(s, i));
  const localPerm = MOVE_PERMS.map((p) => Int32Array.from(slots, (s) => {
    const src = loc.get(p[s]);
    if (src === undefined) throw new Error('skewb-solver: 招式把角格换到了中心格(置换表读错了)');
    return src;
  }));

  const n = slots.length;
  const solved = Uint8Array.from(slots, (s) => Math.floor(s / SKEWB_SLOTS_PER_FACE));
  const index = new Map<string, number>([[coordKey(solved), 0]]);
  const states: Uint8Array[] = [solved];
  const moves: number[] = [];

  for (let qi = 0; qi < states.length; qi++) {
    const cur = states[qi];
    for (let m = 0; m < MOVE_PERMS.length; m++) {
      const lp = localPerm[m];
      const nxt = new Uint8Array(n);
      for (let i = 0; i < n; i++) nxt[i] = cur[lp[i]];
      const k = coordKey(nxt);
      let id = index.get(k);
      if (id === undefined) { id = states.length; index.set(k, id); states.push(nxt); }
      moves[qi * MOVE_PERMS.length + m] = id;
    }
  }

  return { slots, localPerm, index, states, moveTable: Int32Array.from(moves), n: states.length };
}

export interface SkewbGraph {
  corner: Coord;
  center: Coord;
  /** 精确最优步数表,idx = cornerIdx · center.n + centerIdx。 */
  dist: Uint8Array;
  total: number;
}

let cached: SkewbGraph | null = null;

/** 判「某坐标状态的每一面都单色」——用来找出全部「看着已还原」的态(含整体旋转的那些)。 */
function uniformFaceCandidates(c: Coord): number[] {
  const out: number[] = [];
  for (let i = 0; i < c.n; i++) {
    const st = c.states[i];
    let ok = true;
    const byFace = new Map<number, number>();
    for (let li = 0; li < st.length && ok; li++) {
      const face = Math.floor(c.slots[li] / SKEWB_SLOTS_PER_FACE);
      const seen = byFace.get(face);
      if (seen === undefined) byFace.set(face, st[li]);
      else if (seen !== st[li]) ok = false;
    }
    if (ok) out.push(i);
  }
  return out;
}

export function skewbGraph(): SkewbGraph {
  if (cached) return cached;

  const corner = buildCoord(SKEWB_CORNER_SLOTS);
  const center = buildCoord(SKEWB_CENTER_SLOTS);
  const total = corner.n * center.n;
  const nMoves = MOVE_PERMS.length;

  // 目标 = 全部「六面各自单色」的态。斜转的中心块会动,整体朝向没有固定参照,所以「还原」必须按
  // 颜色判(哪个色朝上都算) —— 与二阶画板同一口径。若群里只有唯一一个单色态,这里自然退化成单目标。
  const cornerUniform = uniformFaceCandidates(corner);
  const centerUniform = uniformFaceCandidates(center);
  const goals: number[] = [];
  for (const ci of cornerUniform) {
    // 角格给出每面的颜色,中心必须同色才算整面单色。
    const faceColor = new Map<number, number>();
    corner.states[ci].forEach((col, li) => faceColor.set(Math.floor(corner.slots[li] / SKEWB_SLOTS_PER_FACE), col));
    for (const ki of centerUniform) {
      const cst = center.states[ki];
      const match = cst.every((col, li) => faceColor.get(Math.floor(center.slots[li] / SKEWB_SLOTS_PER_FACE)) === col);
      if (match) goals.push(ci * center.n + ki);
    }
  }
  if (goals.length === 0) throw new Error('skewb-solver: 找不到还原态(枚举出错)');

  // 队列存 (cornerIdx, centerIdx) 两条并行数组,而不是乘出来的 idx —— 3 百万次 BFS 展开里
  // 除法/取模是最贵的一项,拆开就没有了(实测建表 ~820ms → ~500ms)。
  const dist = new Uint8Array(total).fill(255);
  const nK = center.n;
  const qc = new Int32Array(total);
  const qk = new Int32Array(total);
  const cmt = corner.moveTable;
  const kmt = center.moveTable;
  let head = 0;
  let tail = 0;
  for (const g of goals) {
    dist[g] = 0;
    qc[tail] = Math.floor(g / nK);
    qk[tail] = g % nK;
    tail++;
  }

  while (head < tail) {
    const c = qc[head];
    const k = qk[head];
    head++;
    const d = dist[c * nK + k] + 1;
    const cRow = c * nMoves;
    const kRow = k * nMoves;
    for (let m = 0; m < nMoves; m++) {
      const nc = cmt[cRow + m];
      const nk = kmt[kRow + m];
      const nIdx = nc * nK + nk;
      if (dist[nIdx] === 255) { dist[nIdx] = d; qc[tail] = nc; qk[tail] = nk; tail++; }
    }
  }

  cached = { corner, center, dist, total };
  return cached;
}

// ─── 校验 / 求解 ───

/** null = 物理合法;否则返回原始理由(交给 `friendlySkewbErr` 翻成人话)。 */
export function validateSkewbFacelet(facelet: string): string | null {
  const colors = faceletColors(facelet);
  if (!colors) return 'bad facelet string';

  const counts = new Array<number>(6).fill(0);
  for (const c of colors) counts[c]++;
  if (counts.some((n) => n !== SKEWB_STICKERS_PER_COLOR)) return `color counts != ${SKEWB_STICKERS_PER_COLOR}`;

  for (const block of SKEWB_CORNER_BLOCKS) {
    const cols = block.map((s) => colors[s]);
    if (new Set(cols).size !== 3) return 'corner has duplicate colors';
    if (cols.some((c, i) => cols.some((d, j) => i !== j && OPPOSITE[c] === d))) return 'corner has opposite colors';
  }

  const g = skewbGraph();
  const cKey = coordKey(Uint8Array.from(SKEWB_CORNER_SLOTS, (s) => colors[s]));
  if (!g.corner.index.has(cKey)) return 'corner arrangement unreachable';
  const kKey = coordKey(Uint8Array.from(SKEWB_CENTER_SLOTS, (s) => colors[s]));
  if (!g.center.index.has(kKey)) return 'center arrangement unreachable';
  return null;
}

export function friendlySkewbErr(msg: string, isZh: boolean): string {
  const t = (z: string, e: string) => (isZh ? z : e);
  if (msg.includes('color counts')) return t('每种颜色必须正好 5 格', 'Each color must appear exactly 5 times');
  if (msg.includes('duplicate colors')) return t('一个角块上不能有重复颜色', 'A corner cannot have two stickers of the same color');
  if (msg.includes('opposite colors')) return t('一个角块上不能同时含相对面颜色', 'A corner cannot have opposite-face colors');
  if (msg.includes('corner arrangement')) return t('这组角块摆不出来(排列或朝向不可能)', 'This corner arrangement is unreachable (impossible permutation or twist)');
  if (msg.includes('center arrangement')) return t('这组中心块摆不出来(中心排列不可能)', 'This centre arrangement is unreachable');
  return msg;
}

/** facelet → 距离表下标;非法则抛(先跑 `validateSkewbFacelet` 拿人话理由)。 */
function faceletToIndex(facelet: string): number {
  const colors = faceletColors(facelet);
  if (!colors) throw new Error('skewb-solver: facelet 串不合法');
  const g = skewbGraph();
  const c = g.corner.index.get(coordKey(Uint8Array.from(SKEWB_CORNER_SLOTS, (s) => colors[s])));
  const k = g.center.index.get(coordKey(Uint8Array.from(SKEWB_CENTER_SLOTS, (s) => colors[s])));
  if (c === undefined || k === undefined) throw new Error('skewb-solver: 这个状态不可达');
  return c * g.center.n + k;
}

export interface SkewbSolution {
  /** 步数(120° 转 = 1 步),0 = 已还原。 */
  length: number;
  solution: string;
  /** 招式下标序列(内部用 / 测试用)。 */
  moves: number[];
}

/** 沿精确距离表梯度下降 —— 每步都踩在最优路径上,故结果**可证最优**。 */
function descend(g: SkewbGraph, start: number): number[] {
  const nMoves = MOVE_PERMS.length;
  const out: number[] = [];
  let idx = start;
  let d = g.dist[idx];
  if (d === 255) throw new Error('skewb-solver: 状态不可达');
  while (d > 0) {
    const c = Math.floor(idx / g.center.n);
    const k = idx % g.center.n;
    let stepped = false;
    for (let m = 0; m < nMoves; m++) {
      const nIdx = g.corner.moveTable[c * nMoves + m] * g.center.n + g.center.moveTable[k * nMoves + m];
      if (g.dist[nIdx] === d - 1) { out.push(m); idx = nIdx; d--; stepped = true; break; }
    }
    if (!stepped) throw new Error('skewb-solver: 梯度下降卡住(距离表坏了)');
  }
  return out;
}

/** 所画状态的最优解。 */
export function solveSkewbFacelet(facelet: string): SkewbSolution {
  const g = skewbGraph();
  const moves = descend(g, faceletToIndex(facelet));
  return { length: moves.length, solution: moves.map((m) => SKEWB_MOVE_NAMES[m]).join(' '), moves };
}

/** 反推一条到达所画状态的打乱 = 最优解取逆(逐步反序取逆招)。 */
export function deriveSkewbScramble(facelet: string): string {
  const { moves } = solveSkewbFacelet(facelet);
  return moves.slice().reverse().map((m) => SKEWB_MOVE_NAMES[MOVE_INVERSE[m]]).join(' ');
}

/**
 * 取逆一段斜转招式串:倒序 + 每步取逆。记号只有 4 个字母 + 可选撇,`X2` 按 tnoodle 的口径
 * 等于转一次(它的解析器把 `2` 当 1 次),所以这里也照它处理 —— 别让复盘框与预览图打岔。
 */
export function invertSkewbAlg(text: string): string {
  const out: string[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const m = /^([RULBrulb])(['2]?)$/.exec(raw);
    if (!m) continue;
    const axis = AXIS_LETTERS.indexOf(m[1].toUpperCase());
    if (axis < 0) continue;
    // tnoodle: 裸 = 转 1 次、撇 = 转 2 次、`2` = 转 1 次。取逆 = 补到 3 次。
    const turns = m[2] === "'" ? 2 : 1;
    out.unshift(AXIS_LETTERS[axis] + (turns === 1 ? "'" : ''));
  }
  return out.join(' ');
}

/** 空闲时先把距离表建好(建表 ~0.5s,别卡在用户涂最后一格的时候)。 */
export function prewarmSkewbGraph(): void {
  skewbGraph();
}

/** 随机合法状态:从还原态起随机走 12 步(同轴不连出,和真打乱一个口径)。 */
export function randomLegalSkewbFacelet(): string {
  const tokens: string[] = [];
  let lastAxis = -1;
  for (let i = 0; i < 12; i++) {
    let axis: number;
    do { axis = Math.floor(Math.random() * 4); } while (axis === lastAxis);
    lastAxis = axis;
    tokens.push(AXIS_LETTERS[axis] + (Math.random() < 0.5 ? '' : "'"));
  }
  return skewbFaceletFromMoves(tokens.join(' '));
}

/**
 * 全空间精确统计(测试 / 分布视图用)。直方图是**全 3,149,280 态**的精确分布,不是抽样 ——
 * 因为距离表本身就是精确的,数一遍即可(3 百万次扫描,~30ms,故不进 `skewbGraph` 的热路径)。
 */
export function skewbGraphStats(): { total: number; histogram: number[]; corners: number; centers: number } {
  const g = skewbGraph();
  const histogram: number[] = [];
  for (let i = 0; i < g.total; i++) {
    const d = g.dist[i];
    if (d === 255) continue;      // 乘积全可达时不会发生;不可达档由测试断言为 0
    histogram[d] = (histogram[d] ?? 0) + 1;
  }
  for (let i = 0; i < histogram.length; i++) histogram[i] ??= 0;
  return { total: g.total, histogram, corners: g.corner.n, centers: g.center.n };
}
