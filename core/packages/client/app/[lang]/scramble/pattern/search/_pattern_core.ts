/**
 * Cube Explorer "Pattern Editor" 搜索核心 — 忠实移植 hkociemba/CubeExplorer 的
 * PatternSearch.pas(+ FaceCube.pas 的 TwistOk/FlipOk、CubeDefs.pas 的常量表)。
 *
 * 语义(与上游逐行核对,2026-07):
 *  - 每个 pattern 是一面 9 格的抽象着色(至多 6 类,含"灰");匹配 = 在已填格上
 *    pattern 色类 ↔ 实际颜色构成双向一致映射(同类⇔同色、异类⇔异色)。
 *    灰不是通配符 —— 它与其余 5 色地位相同,都是色类;唯一特殊性:全灰 pattern
 *    视为"空",搜索开始时自动取消其所有面分配(上游 FindPatterns 同款)。
 *  - 每个 pattern 展开 8 个等价形式(4 旋转 × 2 镜像)。
 *  - DFS:固定中心,依次放 8 个角块(×3 扭转)+ 12 个棱块(×2 翻转);每步要求
 *    "刚触及的每个面的已填格,匹配某个分配到该面的 pattern 的某个等价形式"
 *    (CornerNotOk/EdgeNotOk 剪枝);放完角检查总扭转 ≡0 (mod 3),放完棱检查
 *    总翻转 ≡0 (mod 2) + 角棱置换奇偶一致(可解性)。
 *  - Continuous:每放一条棱,棱贴纸与两侧相邻角贴纸的图案连续性检查(IsContinuous)。
 *  - 结果按 48 阶魔方对称群做 isomorphic 去重(上游 AddCube 的 checkIsomorphics 默认开)。
 *
 * 纯计算、无 DOM —— 供 _search.worker.ts 与 tests/pattern_search_core.test.ts 共用。
 */

import { CORNER_FACELET, EDGE_FACELET } from '../../solver/facelet';

/** 色类/实际色:0..5 = U R F D L B;UI 层的"灰"= 5 号类之外单独的 GRAY。 */
export const GRAY = 5 as const; // UI pattern 色板里灰的类值(任意定,类值本身无语义)
export const EMPTY = 6 as const; // DFS 中未填充的 facelet

export type PatternFace = number[]; // 9 格,值 0..5(色类)
export type FaceAssign = boolean[][]; // [patternIdx 0..4][face 0..5 = U R F D L B]

/** 角块位置涉及的 3 个面(= 该位置原生色),floor(facelet/9)。 */
const CORNER_DIRS: number[][] = CORNER_FACELET.map((fs) => fs.map((f) => Math.floor(f / 9)));
/** 棱块位置涉及的 2 个面。 */
const EDGE_DIRS: number[][] = EDGE_FACELET.map((fs) => fs.map((f) => Math.floor(f / 9)));

/** CubeDefs.pas EN — 每条棱的 2 个相邻角(用于 Continuous 检查)。 */
const EDGE_NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [0, 3], // UR: URF,UBR
  [1, 0], // UF: UFL,URF
  [2, 1], // UL: ULB,UFL
  [3, 2], // UB: UBR,ULB
  [7, 4], // DR: DRB,DFR
  [4, 5], // DF: DFR,DLF
  [5, 6], // DL: DLF,DBL
  [6, 7], // DB: DBL,DRB
  [0, 4], // FR: URF,DFR
  [5, 1], // FL: DLF,UFL
  [6, 2], // BL: DBL,ULB
  [3, 7], // BR: UBR,DRB
];

//──────────────────────── pattern 的 8 个等价形式 ────────────────────────

/** 面内顺时针旋转 90°(PatternSearch.pas RotateSingleFace,0 基)。 */
export function rotatePattern(p: PatternFace): PatternFace {
  const r = new Array<number>(9);
  r[8] = p[2]; r[2] = p[0]; r[0] = p[6]; r[6] = p[8];
  r[7] = p[5]; r[5] = p[1]; r[1] = p[3]; r[3] = p[7];
  r[4] = p[4];
  return r;
}

/** 面内左右镜像(ReflectSingleFace,0 基)。 */
export function reflectPattern(p: PatternFace): PatternFace {
  const m = new Array<number>(9);
  m[0] = p[2]; m[2] = p[0];
  m[3] = p[5]; m[5] = p[3];
  m[6] = p[8]; m[8] = p[6];
  m[1] = p[1]; m[4] = p[4]; m[7] = p[7];
  return m;
}

/** 8 个等价形式:恒等 + 3 旋转,以及各自的镜像(去重后可能 <8)。 */
export function expandPattern(p: PatternFace): PatternFace[] {
  const forms: PatternFace[] = [p];
  for (let i = 0; i < 3; i++) forms.push(rotatePattern(forms[i]));
  for (let i = 0; i < 4; i++) forms.push(reflectPattern(forms[i]));
  const seen = new Set<string>();
  return forms.filter((f) => {
    const k = f.join('');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function isEmptyPattern(p: PatternFace): boolean {
  return p.every((c) => c === GRAY);
}

//──────────────────────── 匹配(色类双向映射) ────────────────────────

/**
 * PatternSearch.pas CornerMatch:只查面内 0,2,4,6,8(4 角 + 中心)。
 * state 里 EMPTY 的格跳过;已填格上要求 pattern 类 ↔ 实际色 是一致的双向映射。
 */
function cornerMatchFace(pat: PatternFace, state: Uint8Array, base: number): boolean {
  const tba = TBA; const tab = TAB;
  tba.fill(-1); tab.fill(-1);
  for (let i = 0; i < 9; i += 2) {
    const b = state[base + i];
    if (b !== EMPTY) { tba[b] = pat[i]; tab[pat[i]] = b; }
  }
  for (let i = 0; i < 9; i += 2) {
    const b = state[base + i];
    if (b !== EMPTY && (tba[b] !== pat[i] || tab[pat[i]] !== b)) return false;
  }
  return true;
}

/** EdgeMatch:查满 9 格(此时该面的角已放好)。 */
function edgeMatchFace(pat: PatternFace, state: Uint8Array, base: number): boolean {
  const tba = TBA; const tab = TAB;
  tba.fill(-1); tab.fill(-1);
  for (let i = 0; i < 9; i++) {
    const b = state[base + i];
    if (b !== EMPTY) { tba[b] = pat[i]; tab[pat[i]] = b; }
  }
  for (let i = 0; i < 9; i++) {
    const b = state[base + i];
    if (b !== EMPTY && (tba[b] !== pat[i] || tab[pat[i]] !== b)) return false;
  }
  return true;
}

// 匹配用的双向映射暂存(单线程 DFS,可安全复用)
const TBA = new Int8Array(7);
const TAB = new Int8Array(7);

//──────────────────────── 完整状态合法性 ────────────────────────

/** FaceCube.pas TwistOk:8 角的 U/D 贴纸朝向和 ≡ 0 (mod 3)。 */
export function twistOk(state: Uint8Array): boolean {
  let ori = 0;
  for (let c = 0; c < 8; c++) {
    for (let j = 0; j < 3; j++) {
      const col = state[CORNER_FACELET[c][j]];
      if (col === 0 || col === 3) { ori += j; break; }
    }
  }
  return ori % 3 === 0;
}

/** FaceCube.pas FlipOk:12 棱翻转和 ≡ 0 (mod 2)。 */
export function flipOk(state: Uint8Array): boolean {
  let ori = 0;
  for (let e = 0; e < 12; e++) {
    const a = state[EDGE_FACELET[e][0]];
    if (a === 0 || a === 3) continue;
    const b = state[EDGE_FACELET[e][1]];
    if (b === 0 || b === 3) ori++;
    else if (b === 2 || b === 5) ori++;
  }
  return ori % 2 === 0;
}

function permParityEven(p: number[]): boolean {
  let inv = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inv++;
  }
  return inv % 2 === 0;
}

/** 角置换与棱置换奇偶一致(否则不可解)。state 必须是完整合法块集合。 */
export function parityOk(state: Uint8Array): boolean {
  const cp = new Array<number>(8);
  for (let i = 0; i < 8; i++) {
    let ori = 0;
    for (; ori < 3; ori++) {
      const col = state[CORNER_FACELET[i][ori]];
      if (col === 0 || col === 3) break;
    }
    const col1 = state[CORNER_FACELET[i][(ori + 1) % 3]];
    const col2 = state[CORNER_FACELET[i][(ori + 2) % 3]];
    for (let j = 0; j < 8; j++) {
      if (col1 === CORNER_DIRS[j][1] && col2 === CORNER_DIRS[j][2]) { cp[i] = j; break; }
    }
  }
  const ep = new Array<number>(12);
  for (let i = 0; i < 12; i++) {
    const a = state[EDGE_FACELET[i][0]];
    const b = state[EDGE_FACELET[i][1]];
    for (let j = 0; j < 12; j++) {
      const a0 = EDGE_DIRS[j][0]; const a1 = EDGE_DIRS[j][1];
      if ((a === a0 && b === a1) || (a === a1 && b === a0)) { ep[i] = j; break; }
    }
  }
  return permParityEven(cp) === permParityEven(ep);
}

/** PatternSearch.pas IsContinuous:棱贴纸与相邻角贴纸的图案连续性。 */
export function edgeContinuous(state: Uint8Array, e: number): boolean {
  for (let i = 0; i < 2; i++) {
    const c = EDGE_NEIGHBOURS[e][i];
    const d0 = EDGE_DIRS[e][0];
    const j0 = CORNER_DIRS[c].indexOf(d0);
    const ef0 = EDGE_FACELET[e][0]; const cf0 = CORNER_FACELET[c][j0];
    const d1 = EDGE_DIRS[e][1];
    const j1 = CORNER_DIRS[c].indexOf(d1);
    const ef1 = EDGE_FACELET[e][1]; const cf1 = CORNER_FACELET[c][j1];
    if ((state[ef0] === state[cf0]) !== (state[ef1] === state[cf1])) return false;
  }
  return true;
}

//──────────────────────── 48 对称 isomorphic 去重 ────────────────────────

// CubeDefs.pas FaceletSym 的 4 个基本对称(0 基 facelet 置换)。
const SYM_URF3 = [
  17, 16, 15, 14, 13, 12, 11, 10, 9, 20, 23, 26, 19, 22, 25, 18, 21, 24,
  2, 5, 8, 1, 4, 7, 0, 3, 6, 36, 37, 38, 39, 40, 41, 42, 43, 44,
  51, 48, 45, 52, 49, 46, 53, 50, 47, 29, 32, 35, 28, 31, 34, 27, 30, 33,
];
const SYM_F2 = [
  35, 34, 33, 32, 31, 30, 29, 28, 27, 44, 43, 42, 41, 40, 39, 38, 37, 36,
  26, 25, 24, 23, 22, 21, 20, 19, 18, 8, 7, 6, 5, 4, 3, 2, 1, 0,
  17, 16, 15, 14, 13, 12, 11, 10, 9, 53, 52, 51, 50, 49, 48, 47, 46, 45,
];
const SYM_U4 = [
  2, 5, 8, 1, 4, 7, 0, 3, 6, 18, 19, 20, 21, 22, 23, 24, 25, 26,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 33, 30, 27, 34, 31, 28, 35, 32, 29,
  45, 46, 47, 48, 49, 50, 51, 52, 53, 9, 10, 11, 12, 13, 14, 15, 16, 17,
];
const SYM_LR2 = [
  2, 1, 0, 5, 4, 3, 8, 7, 6, 38, 37, 36, 41, 40, 39, 44, 43, 42,
  20, 19, 18, 23, 22, 21, 26, 25, 24, 29, 28, 27, 32, 31, 30, 35, 34, 33,
  11, 10, 9, 14, 13, 12, 17, 16, 15, 47, 46, 45, 50, 49, 48, 53, 52, 51,
];

function composePerm(a: number[], b: number[]): number[] {
  const out = new Array<number>(54);
  for (let i = 0; i < 54; i++) out[i] = a[b[i]];
  return out;
}

/** 48 个对称置换:URF3^a · F2^b · U4^c · LR2^d。 */
export const SYM_PERMS: number[][] = (() => {
  const id = Array.from({ length: 54 }, (_, i) => i);
  const pow = (p: number[], n: number) => {
    let out = id;
    for (let i = 0; i < n; i++) out = composePerm(out, p);
    return out;
  };
  const perms: number[][] = [];
  for (let a = 0; a < 3; a++) {
    const pa = pow(SYM_URF3, a);
    for (let b = 0; b < 2; b++) {
      const pb = composePerm(pa, pow(SYM_F2, b));
      for (let c = 0; c < 4; c++) {
        const pc = composePerm(pb, pow(SYM_U4, c));
        for (let d = 0; d < 2; d++) {
          perms.push(composePerm(pc, pow(SYM_LR2, d)));
        }
      }
    }
  }
  return perms;
})();

const FACE_CHARS = 'URFDLB';

export function faceletString(state: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 54; i++) s += FACE_CHARS[state[i]];
  return s;
}

/**
 * 状态在全部 48 对称下变换(位置置换 + 按中心归一重命色)后的最小字符串。
 * 两状态 isomorphic ⟺ canonicalKey 相同(对应上游 IsIsomorphic 去重)。
 */
export function canonicalKey(state: Uint8Array): string {
  let best: string | null = null;
  const tmp = new Uint8Array(54);
  const cmap = new Uint8Array(6);
  for (const perm of SYM_PERMS) {
    for (let i = 0; i < 54; i++) tmp[i] = state[perm[i]];
    for (let f = 0; f < 6; f++) cmap[tmp[4 + 9 * f]] = f;
    let s = '';
    for (let i = 0; i < 54; i++) s += FACE_CHARS[cmap[tmp[i]]];
    if (best === null || s < best) best = s;
  }
  return best!;
}

//──────────────────────── DFS 搜索 ────────────────────────

export interface SearchOptions {
  /** 5 个 pattern,各 9 格色类(0..5,GRAY=5)。 */
  patterns: PatternFace[];
  /** [patternIdx][face U..B] 是否分配。空 pattern 的行会被自动清空(上游行为)。 */
  faceAssign: FaceAssign;
  /** 图案连续性检查(上游 Continuous checkbox)。 */
  continuous: boolean;
  /** 找到多少个(去重后)结果就停。 */
  maxResults: number;
}

export interface SearchCallbacks {
  /** 每个去重后的结果(54 位 URFDLB facelet 串)。 */
  onResult(facelet: string): void;
  /** 大约每 2^21 次放置尝试回调一次。 */
  onProgress?(nodes: number, found: number): void;
}

export interface SearchStats {
  nodes: number;
  found: number;
  /** true = 因 maxResults 截断,否则空间已搜尽。 */
  truncated: boolean;
}

const PROGRESS_MASK = (1 << 21) - 1;

export function searchPatterns(opts: SearchOptions, cb: SearchCallbacks): SearchStats {
  // 空 pattern 自动摘除(上游 FindPatterns:全灰 → uncheck All)
  const assign = opts.faceAssign.map((row, i) =>
    isEmptyPattern(opts.patterns[i]) ? row.map(() => false) : row.slice());
  const forms: PatternFace[][] = opts.patterns.map((p) => expandPattern(p));
  // 每面参与的 pattern 序号(剪枝内层免扫全表)
  const byFace: number[][] = Array.from({ length: 6 }, (_, f) =>
    [0, 1, 2, 3, 4].filter((j) => assign[j][f]));

  const state = new Uint8Array(54).fill(EMPTY);
  for (let f = 0; f < 6; f++) state[4 + 9 * f] = f; // 中心固定(上游 Empty 保留中心)

  const cornerUsed = new Array<boolean>(8).fill(false);
  const edgeUsed = new Array<boolean>(12).fill(false);
  const seen = new Set<string>();
  const stats: SearchStats = { nodes: 0, found: 0, truncated: false };
  let stop = false;

  const bumpNode = () => {
    stats.nodes++;
    if ((stats.nodes & PROGRESS_MASK) === 0) cb.onProgress?.(stats.nodes, stats.found);
  };

  const faceOk = (dirs: number[], match: (pat: PatternFace, s: Uint8Array, base: number) => boolean): boolean => {
    for (const dir of dirs) {
      const base = dir * 9;
      let ok = false;
      outer: for (const j of byFace[dir]) {
        for (const form of forms[j]) {
          if (match(form, state, base)) { ok = true; break outer; }
        }
      }
      if (!ok) return false;
    }
    return true;
  };

  const emit = () => {
    const key = canonicalKey(state);
    if (seen.has(key)) return;
    seen.add(key);
    stats.found++;
    cb.onResult(faceletString(state));
    if (stats.found >= opts.maxResults) { stats.truncated = true; stop = true; }
  };

  const setEdges = (place: number): void => {
    if (stop) return;
    const [f0, f1] = EDGE_FACELET[place];
    for (let e = 0; e < 12 && !stop; e++) {
      if (edgeUsed[e]) continue;
      edgeUsed[e] = true;
      for (let i = 0; i < 2 && !stop; i++) {
        bumpNode();
        state[f0] = EDGE_DIRS[e][i];
        state[f1] = EDGE_DIRS[e][i ^ 1];
        if (!faceOk(EDGE_DIRS[place], edgeMatchFace)) continue;
        if (opts.continuous && !edgeContinuous(state, place)) continue;
        if (place === 11) {
          if (!flipOk(state)) continue;
          if (!parityOk(state)) continue;
          emit();
        } else setEdges(place + 1);
      }
      edgeUsed[e] = false;
      state[f0] = EMPTY;
      state[f1] = EMPTY;
    }
  };

  const setCorners = (place: number): void => {
    if (stop) return;
    const fs = CORNER_FACELET[place];
    for (let c = 0; c < 8 && !stop; c++) {
      if (cornerUsed[c]) continue;
      cornerUsed[c] = true;
      for (let i = 0; i < 3 && !stop; i++) {
        bumpNode();
        for (let j = 0; j < 3; j++) state[fs[(j + i) % 3]] = CORNER_DIRS[c][j];
        if (!faceOk(CORNER_DIRS[place], cornerMatchFace)) continue;
        if (place === 7) {
          if (twistOk(state)) setEdges(0);
        } else setCorners(place + 1);
      }
      cornerUsed[c] = false;
      for (let j = 0; j < 3; j++) state[fs[j]] = EMPTY;
    }
  };

  setCorners(0);
  cb.onProgress?.(stats.nodes, stats.found);
  return stats;
}
