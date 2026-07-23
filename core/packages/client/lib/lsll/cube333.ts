/**
 * 极简 3x3 cubie 模型(kociemba 编号)+ LSLL(最后槽 = FR)投影/嵌入。
 *
 * 校准来源(tests/lsll_model.test.ts 锁定):
 *  - 与 cubing.js KPattern 逐块一致(位置映射 CUBING_CORNER_INDEX/CUBING_EDGE_INDEX,ori 约定 identity);
 *  - toFacelets 输出与 visualcube 的 fd 渲染字节一致。
 */

export interface Cube333 {
  cp: number[]; co: number[]; // 8 corners: URF UFL ULB UBR DFR DLF DBL DRB
  ep: number[]; eo: number[]; // 12 edges: UR UF UL UB DR DF DL DB FR FL BL BR
}

export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const;
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'] as const;

/** 我的 corner/edge 序号 i ↔ cubing.js patternData 序号 [i](探针实证)。 */
export const CUBING_CORNER_INDEX = [0, 3, 2, 1, 4, 5, 6, 7] as const;
export const CUBING_EDGE_INDEX = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10] as const;

const Z8 = Array(8).fill(0);
const Z12 = Array(12).fill(0);

const MOVES: Record<string, { cp: number[]; co: number[]; ep: number[]; eo: number[] }> = {
  U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: Z8, ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: Z12 },
  R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: Z12 },
  F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
  D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: Z8, ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: Z12 },
  L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: Z12 },
  B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
};

export function solvedCube(): Cube333 {
  return { cp: [...Array(8).keys()], co: [...Z8], ep: [...Array(12).keys()], eo: [...Z12] };
}

export function isSolved(s: Cube333): boolean {
  return s.cp.every((v, i) => v === i) && s.co.every((v) => v === 0)
    && s.ep.every((v, i) => v === i) && s.eo.every((v) => v === 0);
}

export function applyMove(s: Cube333, face: string, times: number): Cube333 {
  const m = MOVES[face];
  for (let t = 0; t < times; t++) {
    const cp = Array<number>(8), co = Array<number>(8), ep = Array<number>(12), eo = Array<number>(12);
    for (let i = 0; i < 8; i++) { cp[i] = s.cp[m.cp[i]]; co[i] = (s.co[m.cp[i]] + m.co[i]) % 3; }
    for (let i = 0; i < 12; i++) { ep[i] = s.ep[m.ep[i]]; eo[i] = (s.eo[m.ep[i]] + m.eo[i]) % 2; }
    s = { cp, co, ep, eo };
  }
  return s;
}

/** 仅支持 U R F D L B(+ 2 / ' / 2')。非法 token 抛错,错误信息含该 token。 */
export function applyAlg(s: Cube333, alg: string): Cube333 {
  for (const tok of alg.trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^([URFDLB])(2'?|'|3)?$/);
    if (!m) throw new Error(tok);
    const n = m[2] === '2' || m[2] === "2'" ? 2 : m[2] === "'" || m[2] === '3' ? 3 : 1;
    s = applyMove(s, m[1], n);
  }
  return s;
}

// ---- facelets(visualcube fd 序:U0-8 R9-17 F18-26 D27-35 L36-44 B45-53) ----
const CF = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const CCOL = [[0, 1, 2], [0, 2, 4], [0, 4, 5], [0, 5, 1], [3, 2, 1], [3, 4, 2], [3, 5, 4], [3, 1, 5]];
const EF = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
const ECOL = [[0, 1], [0, 2], [0, 4], [0, 5], [3, 1], [3, 2], [3, 4], [3, 5], [2, 1], [2, 4], [5, 4], [5, 1]];
const FACE_CH = ['u', 'r', 'f', 'd', 'l', 'b'];

export function toFacelets(s: Cube333): string {
  const f = Array<string>(54).fill('?');
  [4, 13, 22, 31, 40, 49].forEach((idx, i) => { f[idx] = FACE_CH[i]; });
  for (let i = 0; i < 8; i++) {
    const p = s.cp[i], o = s.co[i];
    for (let k = 0; k < 3; k++) f[CF[i][(k + o) % 3]] = FACE_CH[CCOL[p][k]];
  }
  for (let i = 0; i < 12; i++) {
    const p = s.ep[i], o = s.eo[i];
    for (let k = 0; k < 2; k++) f[EF[i][(k + o) % 2]] = FACE_CH[ECOL[p][k]];
  }
  return f.join('');
}

/** LSLL 域外必须还原的块(角 DLF DBL DRB;棱 DR DF DL DB FL BL BR)。 */
const FIXED_CORNERS = [5, 6, 7];
const FIXED_EDGES = [4, 5, 6, 7, 9, 10, 11];
/** LSLL 域位置(与 LsllState 的 5 位序一一对应)。 */
export const LSLL_CORNER_POS = [0, 1, 2, 3, 4] as const; // URF UFL ULB UBR + DFR(槽)
export const LSLL_EDGE_POS = [0, 1, 2, 3, 8] as const;   // UR UF UL UB + FR(槽)

export interface LsllState {
  cp: number[]; co: number[]; // 5 位:顶 4(U 转进位序)+ 槽;piece 4 = 槽块
  ep: number[]; eo: number[];
}

/** 整魔方 → LSLL 状态;域外有块未还原时返回坏块名单。 */
export function extractLsll(s: Cube333): { state: LsllState } | { broken: string[] } {
  const broken: string[] = [];
  for (const i of FIXED_CORNERS) if (s.cp[i] !== i || s.co[i] !== 0) broken.push(CORNER_NAMES[i]);
  for (const i of FIXED_EDGES) if (s.ep[i] !== i || s.eo[i] !== 0) broken.push(EDGE_NAMES[i]);
  if (broken.length) return { broken };
  const cp: number[] = [], co: number[] = [], ep: number[] = [], eo: number[] = [];
  for (let i = 0; i < 5; i++) {
    const pc = s.cp[LSLL_CORNER_POS[i]];
    cp.push(pc === 4 ? 4 : pc);
    co.push(s.co[LSLL_CORNER_POS[i]]);
    const pe = s.ep[LSLL_EDGE_POS[i]];
    ep.push(pe === 8 ? 4 : pe);
    eo.push(s.eo[LSLL_EDGE_POS[i]]);
  }
  return { state: { cp, co, ep, eo } };
}

export function embedLsll(t: LsllState): Cube333 {
  const s = solvedCube();
  for (let i = 0; i < 5; i++) {
    s.cp[LSLL_CORNER_POS[i]] = t.cp[i] === 4 ? 4 : t.cp[i];
    s.co[LSLL_CORNER_POS[i]] = t.co[i];
    s.ep[LSLL_EDGE_POS[i]] = t.ep[i] === 4 ? 8 : t.ep[i];
    s.eo[LSLL_EDGE_POS[i]] = t.eo[i];
  }
  return s;
}

/** 类别卡片示意图用:角块 piece 在角位 pos(ori o)的贴纸写进 fd 数组。 */
export function paintCorner(f: string[], pos: number, piece: number, o: number): void {
  for (let k = 0; k < 3; k++) f[CF[pos][(k + o) % 3]] = FACE_CH[CCOL[piece][k]];
}
export function paintEdge(f: string[], pos: number, piece: number, o: number): void {
  for (let k = 0; k < 2; k++) f[EF[pos][(k + o) % 2]] = FACE_CH[ECOL[piece][k]];
}
export function cornerFaceletIdx(pos: number): number[] { return CF[pos]; }
export function edgeFaceletIdx(pos: number): number[] { return EF[pos]; }
