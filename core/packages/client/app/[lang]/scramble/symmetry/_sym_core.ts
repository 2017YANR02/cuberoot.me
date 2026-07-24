/**
 * 三阶魔方 48 元对称群 O_h 的引擎 —— 忠实移植 hkociemba/CubeExplorer 的
 * Symmetries.pas + CubeDefs.pas(CornerCubieSym / EdgeCubieSym / ImageSym)。
 *
 * 约定(与上游、与本仓 solver/facelet.ts 完全一致):
 *  - 角 0..7 = URF UFL ULB UBR DFR DLF DBL DRB;棱 0..11 = UR UF UL UB DR DF
 *    DL DB FR FL BL BR。cp[i]=j 表示"位置 i 上放着块 j"。
 *  - 对称元素的角朝向取值 0..5:≥3 表示"先转 (o-3) 再做一次镜射"(上游注释),
 *    因此乘法要用 addCOris 而不是 mod 3。
 *  - 48 个对称元素的编号 = 上游生成顺序 S_URF3^a · S_F2^b · S_U4^c · S_LR2^d,
 *    下标 n = 16a + 8b + 2c + d。ImageSym 里的 33 个子群位掩码就按这个编号,
 *    所以本文件的编号绝不能改。
 *
 * 位置 p 的对称群 = { S : S·p·S⁻¹ = p };反对称群 = { S : S·p·S⁻¹ = p⁻¹ }。
 * 掩码用 bigint(48 位超出 JS 位运算的 32 位)。
 */

import { CORNER_FACELET, EDGE_FACELET } from '../solver/facelet';
import type { CubieCube } from '../solver/_kociemba/cube';

export const N_SYM = 48;

/** 角/棱块所在面(0..5 = U R F D L B),由 facelet 表推导。 */
export const CORNER_AXIS: number[][] = CORNER_FACELET.map((fs) => fs.map((f) => Math.floor(f / 9)));
export const EDGE_AXIS: number[][] = EDGE_FACELET.map((fs) => fs.map((f) => Math.floor(f / 9)));

//──────────────────────── 48 个对称元素 ────────────────────────

export interface SymCubie {
  cp: number[]; // 8
  co: number[]; // 8,取值 0..5
  ep: number[]; // 12
  eo: number[]; // 12
}

const ID_SYM: SymCubie = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

/** CubeDefs.pas CornerCubieSym / EdgeCubieSym 的 4 个基本对称。 */
const GEN_URF3: SymCubie = {
  cp: [0, 4, 5, 1, 3, 7, 6, 2],
  co: [1, 2, 1, 2, 2, 1, 2, 1],
  ep: [1, 8, 5, 9, 3, 11, 7, 10, 0, 4, 6, 2],
  eo: [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1],
};
const GEN_F2: SymCubie = {
  cp: [5, 4, 7, 6, 1, 0, 3, 2],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [6, 5, 4, 7, 2, 1, 0, 3, 9, 8, 11, 10],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const GEN_U4: SymCubie = {
  cp: [3, 0, 1, 2, 7, 4, 5, 6],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [3, 0, 1, 2, 7, 4, 5, 6, 11, 8, 9, 10],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
};
const GEN_LR2: SymCubie = {
  cp: [1, 0, 3, 2, 5, 4, 7, 6],
  co: [3, 3, 3, 3, 3, 3, 3, 3],
  ep: [2, 1, 0, 3, 6, 5, 4, 7, 9, 8, 11, 10],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

/** CubeDefs.pas 的 6 值角朝向加法(含镜射位)。 */
export function addCOri(oriA: number, oriB: number): number {
  if (oriA < 3) {
    if (oriB < 3) return (oriA + oriB) % 3;
    return oriA + oriB >= 6 ? oriA + oriB - 3 : oriA + oriB; // 3..5
  }
  if (oriB < 3) {
    const o = oriA - oriB;
    return o < 3 ? o + 3 : o; // 3..5
  }
  const o = oriA - oriB;
  return o < 0 ? o + 3 : o; // 0..2
}

/** prod = a ∘ b(先 b 后 a),对应上游 CornMult / EdgeMult。 */
export function symMul(a: SymCubie, b: SymCubie): SymCubie {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  for (let i = 0; i < 8; i++) {
    cp[i] = a.cp[b.cp[i]];
    co[i] = addCOri(a.co[b.cp[i]], b.co[i]);
  }
  for (let i = 0; i < 12; i++) {
    ep[i] = a.ep[b.ep[i]];
    eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
  }
  return { cp, co, ep, eo };
}

/** 48 个对称元素,顺序 = Symmetries.pas CreateSymmetries。 */
export const SYMS: SymCubie[] = (() => {
  const out: SymCubie[] = [];
  let c: SymCubie = ID_SYM;
  for (let urf3 = 0; urf3 < 3; urf3++) {
    for (let f2 = 0; f2 < 2; f2++) {
      for (let u4 = 0; u4 < 4; u4++) {
        for (let lr2 = 0; lr2 < 2; lr2++) {
          out.push({ cp: c.cp.slice(), co: c.co.slice(), ep: c.ep.slice(), eo: c.eo.slice() });
          c = symMul(c, GEN_LR2);
        }
        c = symMul(c, GEN_U4);
      }
      c = symMul(c, GEN_F2);
    }
    c = symMul(c, GEN_URF3);
  }
  return out;
})();

const isIdCorn = (s: SymCubie) => s.cp.every((v, i) => v === i && s.co[i] === 0);

/** SYMS[i] · SYMS[SYM_INV[i]] = E。 */
export const SYM_INV: number[] = (() => {
  const inv = new Array<number>(N_SYM).fill(-1);
  for (let i = 0; i < N_SYM; i++) {
    for (let j = 0; j < N_SYM; j++) {
      if (isIdCorn(symMul(SYMS[i], SYMS[j]))) { inv[i] = j; break; }
    }
  }
  return inv;
})();

/** SYM_MULT[i][j] = SYMS[i] · SYMS[j] 的下标。 */
export const SYM_MULT: number[][] = (() => {
  const key = (s: SymCubie) => s.cp.join(',') + '|' + s.co.join(',');
  const lookup = new Map<string, number>();
  for (let i = 0; i < N_SYM; i++) lookup.set(key(SYMS[i]), i);
  return SYMS.map((a) => SYMS.map((b) => lookup.get(key(symMul(a, b)))!));
})();

//──────────────────────── 位置(CubieCube)的共轭与对称 ────────────────────────

const asSym = (p: CubieCube): SymCubie => ({ cp: p.cp, co: p.co, ep: p.ep, eo: p.eo });

/** S_s · p · S_s⁻¹ —— 把位置 p 按空间对称 s 共轭。 */
export function conjugate(p: CubieCube, s: number): CubieCube {
  const r = symMul(symMul(SYMS[s], asSym(p)), SYMS[SYM_INV[s]]);
  return { cp: r.cp, co: r.co, ep: r.ep, eo: r.eo };
}

/** p⁻¹ */
export function invertCubie(p: CubieCube): CubieCube {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  for (let i = 0; i < 8; i++) { cp[p.cp[i]] = i; co[p.cp[i]] = (3 - p.co[i]) % 3; }
  for (let i = 0; i < 12; i++) { ep[p.ep[i]] = i; eo[p.ep[i]] = p.eo[i]; }
  return { cp, co, ep, eo };
}

function cubieEq(a: CubieCube, b: CubieCube): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}

/** 对称群掩码:bit s 置位 ⟺ S_s·p·S_s⁻¹ = p。 */
export function symMask(p: CubieCube): bigint {
  let m = 0n;
  for (let s = 0; s < N_SYM; s++) if (cubieEq(conjugate(p, s), p)) m |= 1n << BigInt(s);
  return m;
}

/** 反对称群掩码:bit s 置位 ⟺ S_s·p·S_s⁻¹ = p⁻¹(bit 0 置位 = 自逆)。 */
export function antisymMask(p: CubieCube): bigint {
  const inv = invertCubie(p);
  let m = 0n;
  for (let s = 0; s < N_SYM; s++) if (cubieEq(conjugate(p, s), inv)) m |= 1n << BigInt(s);
  return m;
}

/** 序列化(去重键用)。 */
export function cubieKey(p: CubieCube): string {
  return p.cp.join('') + '.' + p.co.join('') + '.' + p.ep.map((v) => v.toString(36)).join('') + '.' + p.eo.join('');
}

/** 在给定对称子集下取最小键;withInverse 时同时考虑 p⁻¹(上游 alsoInverse)。 */
export function canonicalKey(p: CubieCube, syms: number[], withInverse: boolean): string {
  let best: string | null = null;
  const cands = withInverse ? [p, invertCubie(p)] : [p];
  for (const q of cands) {
    for (const s of syms) {
      const k = cubieKey(conjugate(q, s));
      if (best === null || k < best) best = k;
    }
  }
  return best!;
}

/** 只看角块的最小键(上游 checkIsoCorner 的剪枝用)。 */
export function cornerCanonicalKey(p: CubieCube, syms: number[]): string {
  let best: string | null = null;
  for (const s of syms) {
    const r = symMul(symMul(SYMS[s], asSym(p)), SYMS[SYM_INV[s]]);
    const k = r.cp.join('') + '.' + r.co.join('');
    if (best === null || k < best) best = k;
  }
  return best!;
}

//──────────────────────── 子群工具 ────────────────────────

export function maskToList(mask: bigint): number[] {
  const out: number[] = [];
  for (let s = 0; s < N_SYM; s++) if ((mask >> BigInt(s)) & 1n) out.push(s);
  return out;
}

export function listToMask(list: Iterable<number>): bigint {
  let m = 0n;
  for (const s of list) m |= 1n << BigInt(s);
  return m;
}

export function maskOrder(mask: bigint): number {
  let n = 0;
  for (let s = 0; s < N_SYM; s++) if ((mask >> BigInt(s)) & 1n) n++;
  return n;
}

/** 生成闭包(含恒等)。上游 SymButtonClick 每次点击后都会做同样的闭包。 */
export function closure(seed: Iterable<number>): bigint {
  const has = new Array<boolean>(N_SYM).fill(false);
  has[0] = true;
  for (const s of seed) has[s] = true;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < N_SYM; i++) {
      if (!has[i]) continue;
      for (let j = 0; j < N_SYM; j++) {
        if (!has[j]) continue;
        const k = SYM_MULT[i][j];
        if (!has[k]) { has[k] = true; changed = true; }
      }
    }
  }
  let m = 0n;
  for (let s = 0; s < N_SYM; s++) if (has[s]) m |= 1n << BigInt(s);
  return m;
}

/**
 * 带反对称的闭包 —— 上游 RubikMain.pas 的规则:
 *   sym·sym → sym,asym·asym → sym,sym·asym / asym·sym → asym。
 * (H 与陪集 gH 合起来是一个群,H 是指数 2 的正规子群。)
 */
export function closureWithAnti(symSeed: Iterable<number>, asymSeed: Iterable<number>): {
  sym: bigint; asym: bigint;
} {
  const sym = new Array<boolean>(N_SYM).fill(false);
  const asym = new Array<boolean>(N_SYM).fill(false);
  sym[0] = true;
  for (const s of symSeed) sym[s] = true;
  for (const s of asymSeed) asym[s] = true;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < N_SYM; i++) {
      for (let j = 0; j < N_SYM; j++) {
        const k = SYM_MULT[i][j];
        if (sym[i] && sym[j] && !sym[k]) { sym[k] = true; changed = true; }
        if (asym[i] && asym[j] && !sym[k]) { sym[k] = true; changed = true; }
        if (asym[i] && sym[j] && !asym[k]) { asym[k] = true; changed = true; }
        if (sym[i] && asym[j] && !asym[k]) { asym[k] = true; changed = true; }
      }
    }
  }
  return { sym: listToMask(sym.flatMap((v, i) => (v ? [i] : []))), asym: listToMask(asym.flatMap((v, i) => (v ? [i] : []))) };
}

/** 正规化子 N(H) = { g : gHg⁻¹ = H }(上游 curSymNormal)。 */
export function normalizer(mask: bigint): bigint {
  const has = maskToList(mask);
  const set = new Set(has);
  let m = 0n;
  for (let g = 0; g < N_SYM; g++) {
    let ok = true;
    for (const h of has) {
      if (!set.has(SYM_MULT[SYM_MULT[g][h]][SYM_INV[g]])) { ok = false; break; }
    }
    if (ok) m |= 1n << BigInt(g);
  }
  return m;
}

/** 该子群在 O_h 里的共轭个数 = 48 / |N(H)|。 */
export function conjugateCount(mask: bigint): number {
  return N_SYM / maskOrder(normalizer(mask));
}

/** 极小生成元组(贪心,只用于展示)。 */
export function generatorsOf(mask: bigint): number[] {
  const target = maskOrder(mask);
  if (target <= 1) return [];
  const elems = maskToList(mask).filter((s) => s !== 0);
  const gens: number[] = [];
  let cur = closure([]);
  for (const cand of elems.slice().sort((a, b) => elementOrder(b) - elementOrder(a))) {
    if ((cur >> BigInt(cand)) & 1n) continue;
    gens.push(cand);
    cur = closure(gens);
    if (maskOrder(cur) === target) break;
  }
  return gens;
}

export function elementOrder(s: number): number {
  let n = 1;
  let cur = s;
  while (cur !== 0) { cur = SYM_MULT[cur][s]; n++; }
  return n;
}

//──────────────────────── 几何:矩阵、轴、类别 ────────────────────────

/** 角块几何坐标(x=R+, y=U+, z=F+)。 */
const CORNER_XYZ: [number, number, number][] = [
  [1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1],
  [1, -1, 1], [-1, -1, 1], [-1, -1, -1], [1, -1, -1],
];

export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** 每个对称元素对应的 3×3 有向置换矩阵(列主序 m[r*3+c])。 */
export const SYM_MATRIX: Mat3[] = (() => {
  const out: Mat3[] = new Array(N_SYM);
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const cornerIdx = new Map<string, number>();
  CORNER_XYZ.forEach((v, i) => cornerIdx.set(v.join(','), i));
  const symCpKey = SYMS.map((s) => s.cp.join(','));
  for (const p of perms) {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
          const m: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
          m[0 * 3 + p[0]] = sx;
          m[1 * 3 + p[1]] = sy;
          m[2 * 3 + p[2]] = sz;
          // 矩阵诱导的角置换:M·v_j = v_i ⟹ cp[i] = j
          const cp = new Array<number>(8);
          for (let j = 0; j < 8; j++) {
            const v = CORNER_XYZ[j];
            const w = [
              m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
              m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
              m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
            ];
            cp[cornerIdx.get(w.join(','))!] = j;
          }
          const key = cp.join(',');
          const idx = symCpKey.indexOf(key);
          if (idx >= 0) out[idx] = m;
        }
      }
    }
  }
  return out;
})();

export type SymClass = 'E' | 'C3' | 'C2f' | 'C4' | 'C2e' | 'i' | 'S4' | 'S6' | 'sh' | 'sd';

export interface SymElement {
  idx: number;
  cls: SymClass;
  /** 轴/法向的名字:面轴 U/R/F、体对角 URF…、棱轴 UR…;E 与 i 为空。 */
  axis: string;
  /** 3 维轴向量(单位化前)。 */
  axisVec: [number, number, number];
  det: 1 | -1;
  /** 旋转/瑕旋转的转角符号:+1 / -1 / 0(二次元素与镜面)。 */
  sense: 0 | 1 | -1;
  /** Schoenflies 记号,如 C₄(U)、σ_d(UR)。 */
  label: string;
  /** 元素阶。 */
  order: number;
}

const FACE_AXES: { name: string; v: [number, number, number] }[] = [
  { name: 'U', v: [0, 1, 0] },
  { name: 'R', v: [1, 0, 0] },
  { name: 'F', v: [0, 0, 1] },
];
const CORNER_AXES: { name: string; v: [number, number, number] }[] = [
  { name: 'URF', v: [1, 1, 1] },
  { name: 'UFL', v: [-1, 1, 1] },
  { name: 'ULB', v: [-1, 1, -1] },
  { name: 'UBR', v: [1, 1, -1] },
];
const EDGE_AXES: { name: string; v: [number, number, number] }[] = [
  { name: 'UR', v: [1, 1, 0] },
  { name: 'UF', v: [0, 1, 1] },
  { name: 'UL', v: [-1, 1, 0] },
  { name: 'UB', v: [0, 1, -1] },
  { name: 'FR', v: [1, 0, 1] },
  { name: 'FL', v: [-1, 0, 1] },
];

function det3(m: Mat3): number {
  return m[0] * (m[4] * m[8] - m[5] * m[7])
    - m[1] * (m[3] * m[8] - m[5] * m[6])
    + m[2] * (m[3] * m[7] - m[4] * m[6]);
}

function apply(m: Mat3, v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

const SUB = { 2: '₂', 3: '₃', 4: '₄', 6: '₆' } as const;

/** 48 个元素的几何分类与记号。 */
export const SYM_ELEMENTS: SymElement[] = SYM_MATRIX.map((m, idx) => {
  const d = det3(m) as 1 | -1;
  const tr = m[0] + m[4] + m[8];
  // 旋转部分 R = det<0 ? -M : M(把 -I 提出去),用 R 找轴与转角
  const r: Mat3 = (d < 0 ? m.map((x) => -x) : m.slice()) as Mat3;
  const rTr = r[0] + r[4] + r[8];
  const allAxes = [...FACE_AXES, ...CORNER_AXES, ...EDGE_AXES];
  let axis = '';
  let axisVec: [number, number, number] = [0, 1, 0];
  let sense: 0 | 1 | -1 = 0;
  if (rTr !== 3) {
    for (const a of allAxes) {
      const w = apply(r, a.v);
      if (w[0] === a.v[0] && w[1] === a.v[1] && w[2] === a.v[2]) { axis = a.name; axisVec = a.v; break; }
    }
    if (axis) {
      // 用一个与轴不平行的向量算叉积定符号
      const probe: [number, number, number] = Math.abs(axisVec[0]) !== 1 || axisVec[1] !== 0 || axisVec[2] !== 0
        ? [1, 0, 0] : [0, 1, 0];
      const q = apply(r, probe);
      const cross: [number, number, number] = [
        probe[1] * q[2] - probe[2] * q[1],
        probe[2] * q[0] - probe[0] * q[2],
        probe[0] * q[1] - probe[1] * q[0],
      ];
      const dot = cross[0] * axisVec[0] + cross[1] * axisVec[1] + cross[2] * axisVec[2];
      sense = dot > 0 ? 1 : dot < 0 ? -1 : 0;
    }
  }
  let cls: SymClass;
  if (d > 0) {
    if (tr === 3) cls = 'E';
    else if (tr === 0) cls = 'C3';
    else if (tr === 1) cls = 'C4';
    else cls = axis.length === 1 ? 'C2f' : 'C2e'; // tr === -1
  } else {
    if (tr === -3) cls = 'i';
    else if (tr === 1) cls = axis.length === 1 ? 'sh' : 'sd';
    else if (tr === 0) cls = 'S6';
    else cls = 'S4'; // tr === -1
  }
  const ord = (() => {
    let n = 1;
    let cur = idx;
    while (cur !== 0) { cur = SYM_MULT[cur][idx]; n++; }
    return n;
  })();
  const sgn = sense < 0 ? '⁻' : '';
  let label: string;
  switch (cls) {
    case 'E': label = 'E'; break;
    case 'i': label = 'i'; break;
    case 'C3': label = `C${SUB[3]}${sgn}(${axis})`; break;
    case 'C4': label = `C${SUB[4]}${sgn}(${axis})`; break;
    case 'C2f': label = `C${SUB[2]}(${axis})`; break;
    case 'C2e': label = `C${SUB[2]}′(${axis})`; break;
    case 'S4': label = `S${SUB[4]}${sgn}(${axis})`; break;
    case 'S6': label = `S${SUB[6]}${sgn}(${axis})`; break;
    case 'sh': label = `σ_h(${axis})`; break;
    case 'sd': label = `σ_d(${axis})`; break;
  }
  // 镜面用法向记轴,轴向量即法向
  return { idx, cls, axis, axisVec, det: d, sense, label, order: ord };
});

/** 10 个共轭类的展示分组(Oh 的类结构:E, 8C₃, 6C₂′, 6C₄, 3C₂, i, 6S₄, 8S₆, 3σ_h, 6σ_d)。 */
export const SYM_CLASS_ORDER: SymClass[] = ['E', 'C4', 'C2f', 'C3', 'C2e', 'i', 'S4', 'S6', 'sh', 'sd'];

export const SYM_CLASS_INFO: Record<SymClass, { zh: string; en: string; note_zh: string; note_en: string }> = {
  E: { zh: '恒等', en: 'Identity', note_zh: '不动', note_en: 'does nothing' },
  C4: { zh: '面轴 90°', en: 'Face axis 90°', note_zh: '绕 U/R/F 轴转 ±90°', note_en: '±90° about a face axis' },
  C2f: { zh: '面轴 180°', en: 'Face axis 180°', note_zh: '绕 U/R/F 轴转 180°', note_en: '180° about a face axis' },
  C3: { zh: '体对角 120°', en: 'Body diagonal 120°', note_zh: '绕角-角对角线转 ±120°', note_en: '±120° about a corner diagonal' },
  C2e: { zh: '棱轴 180°', en: 'Edge axis 180°', note_zh: '绕棱-棱轴转 180°', note_en: '180° about an edge axis' },
  i: { zh: '中心反演', en: 'Inversion', note_zh: '关于中心点反演', note_en: 'point inversion through the centre' },
  S4: { zh: '4 次瑕旋转', en: 'Improper 4-fold', note_zh: '面轴 ±90° 后镜射', note_en: '±90° about a face axis, then reflect' },
  S6: { zh: '6 次瑕旋转', en: 'Improper 6-fold', note_zh: '体对角 ±60° 后镜射', note_en: '±60° about a corner diagonal, then reflect' },
  sh: { zh: '面平行镜面', en: 'Face mirror plane', note_zh: '与某个面平行的镜面(M/E/S 层)', note_en: 'mirror plane parallel to a face' },
  sd: { zh: '对角镜面', en: 'Diagonal mirror plane', note_zh: '过两条对棱的镜面', note_en: 'mirror plane through two opposite edges' },
};

//──────────────────────── 33 种对称类型 ────────────────────────

export interface SymType {
  /** 上游 ImageSymNames 里的名字。 */
  name: string;
  /** 该类型的代表子群掩码(上游 ImageSym)。 */
  mask: bigint;
  /** 群阶 |H|(上游 symInfo2)。 */
  order: number;
  /** 对称群 ⊇ 这个代表子群的状态数(上游 symInfo1 —— 含更高对称的状态)。 */
  atLeast: bigint;
  /** 对称群恰好等于这个代表子群的状态数(由 O_h 的 98 个子群做 Möbius 反演得出)。 */
  exact: bigint;
  /** 该子群在 O_h 里的共轭个数。 */
  conjugates: number;
  /** 对称型属于这一类的状态数 = exact × conjugates;33 类之和 = 状态总数。 */
  classCount: bigint;
}

/** CubeDefs.pas ImageSym[0..32] + SymSearch.pas symInfo2 —— 顺序即上游下拉框顺序。 */
const RAW_TYPES: [string, bigint, number][] = [
  ['Oh', 281474976710655n, 48],
  ['O', 93824992236885n, 24],
  ['Td', 168884986026393n, 24],
  ['D3d', 39621677884425n, 12],
  ['Th', 56294995342131n, 24],
  ['C3v', 38655295497n, 6],
  ['T', 18764998447377n, 12],
  ['D4h', 65535n, 16],
  ['D3', 4402408653825n, 6],
  ['D4', 21845n, 8],
  ['D2d(face)', 39321n, 8],
  ['C4v', 255n, 8],
  ['C4h', 43605n, 8],
  ['D2h(edge)', 26265n, 8],
  ['D2d(edge)', 52275n, 8],
  ['S6', 35189204000769n, 6],
  ['D2h(face)', 13107n, 8],
  ['C2v(a1)', 153n, 4],
  ['C2v(b)', 1665n, 4],
  ['C2h(b)', 9225n, 4],
  ['D2(edge)', 17425n, 4],
  ['C4', 85n, 4],
  ['D2(face)', 4369n, 4],
  ['S4', 34833n, 4],
  ['C2h(a)', 8721n, 4],
  ['C2v(a2)', 51n, 4],
  ['C3', 4295032833n, 3],
  ['Cs(b)', 129n, 2],
  ['C2(b)', 1025n, 2],
  ['C2(a)', 17n, 2],
  ['Cs(a)', 513n, 2],
  ['Ci', 8193n, 2],
  ['C1', 1n, 1],
];

/** 魔方状态总数。 */
export const TOTAL_POSITIONS = 43252003274489856000n;

/**
 * SymSearch.pas symInfo1 —— "对称群 ⊇ 该代表子群"的状态数(含更高对称的状态;
 * 最后一格上游写作 4.3252*10^19,就是全部状态,因为人人都 ⊇ 平凡群)。
 */
const RAW_AT_LEAST: bigint[] = [
  4n, 4n, 4n, 16n, 24n, 48n, 72n, 128n, 432n, 512n, 512n, 1024n, 1536n,
  2048n, 3072n, 7776n, 12288n, 65536n, 98304n, 98304n, 98304n, 147456n,
  294912n, 442368n, 589824n, 1179648n, 3779136n, 424673280n, 2548039680n,
  15288238080n, 18345885696n, 45864714240n, TOTAL_POSITIONS,
];

/**
 * "对称群恰好等于该代表子群"的状态数 —— 对 O_h 的全部 98 个子群做 Möbius 反演:
 *   exact(H) = atLeast(H) − Σ_{K ⊋ H} exact(K)
 * 反演过程在 tests/symmetry_core.test.ts 里重算并逐项核对(枚举 98 个子群较慢,
 * 不放在模块加载期)。搜索引擎的穷尽结果条数也独立验证了前 16 项。
 */
const RAW_EXACT: bigint[] = [
  4n, 0n, 0n, 12n, 20n, 32n, 48n, 124n, 416n, 384n, 384n, 896n, 1408n,
  1920n, 2944n, 7740n, 11892n, 62208n, 96256n, 96232n, 92928n, 144640n,
  280272n, 437504n, 574208n, 1163520n, 3770864n, 424415168n, 2547748032n,
  15285460992n, 18342768640n, 45862360944n, 43252003109885814336n,
];

export const SYM_TYPES: SymType[] = RAW_TYPES.map(([name, mask, order], i) => {
  const conjugates = conjugateCount(mask);
  return {
    name,
    mask,
    order,
    atLeast: RAW_AT_LEAST[i],
    exact: RAW_EXACT[i],
    conjugates,
    classCount: RAW_EXACT[i] * BigInt(conjugates),
  };
});

/** 有非平凡对称的状态数(= 总数 − C1 那一类)。 */
export const SYMMETRIC_POSITIONS = SYM_TYPES.slice(0, 32).reduce((a, t) => a + t.classCount, 0n);

const TYPE_BY_MASK = new Map<string, number>();
for (let g = 0; g < N_SYM; g++) {
  const gi = SYM_INV[g];
  SYM_TYPES.forEach((t, i) => {
    let conj = 0n;
    for (const h of maskToList(t.mask)) conj |= 1n << BigInt(SYM_MULT[SYM_MULT[g][h]][gi]);
    const k = conj.toString(36);
    if (!TYPE_BY_MASK.has(k)) TYPE_BY_MASK.set(k, i);
  });
}

/** 掩码 → 33 种类型的下标;-1 表示不是子群(理论上不会发生)。 */
export function classifyMask(mask: bigint): number {
  const idx = TYPE_BY_MASK.get(mask.toString(36));
  return idx === undefined ? -1 : idx;
}

/** 位置 → 对称类型下标。 */
export function classifyCube(p: CubieCube): number {
  return classifyMask(symMask(p));
}

/** 中文名(点群的中文习惯叫法不统一,这里给「结构说明」而不是硬译)。 */
export const TYPE_DESC: Record<string, { zh: string; en: string }> = {
  Oh: { zh: '完整立方体对称群,48 个元素全在', en: 'the full cube symmetry group, all 48 elements' },
  O: { zh: '24 个纯旋转,不含任何镜射', en: 'the 24 pure rotations, no reflections' },
  Td: { zh: '正四面体的完整对称群', en: 'the full symmetry group of a tetrahedron' },
  Th: { zh: '正四面体旋转群加中心反演', en: 'tetrahedral rotations plus inversion' },
  T: { zh: '正四面体的 12 个旋转', en: 'the 12 tetrahedral rotations' },
  D4h: { zh: '绕一条面轴的完整二面体对称', en: 'full dihedral symmetry about one face axis' },
  D4: { zh: '绕一条面轴的旋转二面体群', en: 'dihedral rotations about one face axis' },
  C4v: { zh: '一条 4 次轴 + 4 个含轴镜面', en: 'one 4-fold axis with four mirror planes' },
  C4h: { zh: '一条 4 次轴 + 垂直镜面', en: 'one 4-fold axis with a perpendicular mirror' },
  C4: { zh: '只有一条 4 次旋转轴', en: 'a single 4-fold rotation axis' },
  S4: { zh: '一条 4 次瑕旋转轴', en: 'a single 4-fold improper axis' },
  D3d: { zh: '绕体对角线的 3 次轴 + 对角镜面', en: '3-fold body-diagonal axis with diagonal mirrors' },
  D3: { zh: '绕体对角线的 3 次轴 + 3 条 2 次轴', en: '3-fold body-diagonal axis with three 2-fold axes' },
  C3v: { zh: '一条 3 次轴 + 3 个含轴镜面', en: 'one 3-fold axis with three mirror planes' },
  S6: { zh: '一条 3 次轴 + 中心反演', en: 'one 3-fold axis plus inversion' },
  C3: { zh: '只有一条 3 次旋转轴', en: 'a single 3-fold rotation axis' },
  'D2d(face)': { zh: '面轴 2 次 + 对角镜面', en: '2-fold face axis with diagonal mirrors' },
  'D2d(edge)': { zh: '棱轴 2 次 + 对角镜面', en: '2-fold edge axis with diagonal mirrors' },
  'D2h(face)': { zh: '三条互相垂直的面轴 + 三个镜面', en: 'three perpendicular face axes with mirrors' },
  'D2h(edge)': { zh: '含棱轴的三条 2 次轴 + 三个镜面', en: 'three 2-fold axes including edge axes, with mirrors' },
  'D2(face)': { zh: '三条互相垂直的面轴旋转', en: 'rotations about three perpendicular face axes' },
  'D2(edge)': { zh: '含棱轴的三条 2 次轴旋转', en: 'rotations about three 2-fold axes including edge axes' },
  'C2v(a1)': { zh: '一条面轴 2 次 + 两个面平行镜面', en: 'a 2-fold face axis with two face mirrors' },
  'C2v(a2)': { zh: '一条面轴 2 次 + 两个对角镜面', en: 'a 2-fold face axis with two diagonal mirrors' },
  'C2v(b)': { zh: '一条棱轴 2 次 + 两个镜面', en: 'a 2-fold edge axis with two mirrors' },
  'C2h(a)': { zh: '一条面轴 2 次 + 垂直镜面 + 反演', en: 'a 2-fold face axis, perpendicular mirror and inversion' },
  'C2h(b)': { zh: '一条棱轴 2 次 + 垂直镜面 + 反演', en: 'a 2-fold edge axis, perpendicular mirror and inversion' },
  'C2(a)': { zh: '只有一条面轴 2 次旋转', en: 'a single 2-fold face axis' },
  'C2(b)': { zh: '只有一条棱轴 2 次旋转', en: 'a single 2-fold edge axis' },
  'Cs(a)': { zh: '只有一个面平行镜面', en: 'a single mirror plane parallel to a face' },
  'Cs(b)': { zh: '只有一个对角镜面', en: 'a single diagonal mirror plane' },
  Ci: { zh: '只有中心反演', en: 'only the central inversion' },
  C1: { zh: '没有任何对称', en: 'no symmetry at all' },
};
