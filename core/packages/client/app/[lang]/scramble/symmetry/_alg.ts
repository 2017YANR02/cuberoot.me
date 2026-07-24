/**
 * 宽松的 3×3 记号解析:在 kociemba 的 6 个基本面转之外,再收下宽层(Rw / r)、
 * 中层(M E S)和整体旋转(x y z)。
 *
 * 约定与 cstimer / cubing.js 一致 —— 整体旋转不进状态,而是记在"当前朝向"里,
 * 后续面转按当前朝向折算到固定坐标系的那个面。也就是说结果 = 把魔方转回标准
 * 朝向之后看到的状态。宽层与中层按恒等式展开成 (旋转 + 面转):
 *     Rw = x L      Lw = x' R      Uw = y D      Dw = y' U
 *     Fw = z B      Bw = z' F
 *     M  = L' x' R  E  = D' y' U   S  = F' z B
 * 于是 M ≡ R L'、E ≡ U D'、S ≡ F' B,都是众所周知的"差一个整体旋转"的等价。
 *
 * 整体旋转只把状态共轭一下,对称型不变,所以对本页的分析没有影响。
 */

import {
  type CubieCube, BASIC_MOVES, multiply, solvedCubie,
} from '../solver/_kociemba/cube';

/** 面在 URFDLB 里的下标。 */
const FACE_IDX: Record<string, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

/** 旋转后各个"屏幕位置"由原来哪个位置的面顶上:newFm[p] = fm[SRC[p]]。 */
const SRC_X = [2, 1, 3, 5, 4, 0];
const SRC_Y = [0, 5, 1, 3, 2, 4];
const SRC_Z = [4, 0, 2, 1, 3, 5];
const ROT_SRC = [SRC_X, SRC_Y, SRC_Z];

interface Prim {
  /** 'f' = 面转(idx 为 URFDLB 下标),'r' = 整体旋转(idx 0/1/2 = x/y/z)。 */
  kind: 'f' | 'r';
  idx: number;
  /** 1..3 */
  pow: number;
}

const f = (name: string, pow = 1): Prim => ({ kind: 'f', idx: FACE_IDX[name], pow });
const r = (axis: number, pow = 1): Prim => ({ kind: 'r', idx: axis, pow });

/** 每个"扩展记号"展开成基本操作序列(按施加顺序)。 */
const EXPAND: Record<string, Prim[]> = {
  Rw: [r(0), f('L')],
  Lw: [r(0, 3), f('R')],
  Uw: [r(1), f('D')],
  Dw: [r(1, 3), f('U')],
  Fw: [r(2), f('B')],
  Bw: [r(2, 3), f('F')],
  M: [f('L', 3), r(0, 3), f('R')],
  E: [f('D', 3), r(1, 3), f('U')],
  S: [f('F', 3), r(2), f('B')],
  x: [r(0)],
  y: [r(1)],
  z: [r(2)],
};
for (const name of ['U', 'R', 'F', 'D', 'L', 'B']) EXPAND[name] = [f(name)];

const invertPrims = (ps: Prim[]): Prim[] =>
  ps.slice().reverse().map((p) => ({ ...p, pow: 4 - p.pow }));

const WIDE_ALIAS: Record<string, string> = {
  u: 'Uw', r: 'Rw', f: 'Fw', d: 'Dw', l: 'Lw', b: 'Bw',
};

// 后缀只认 空 / 2 / ' / 2' / 3(3 是 Cube Explorer 写逆时针的方式);'' 之类直接判错。
const TOKEN_RE = /^(?:\d+)?([URFDLB]w|[urfdlb]|[URFDLBMESxyz])(2?['’]?|3)$/;

/** 解析结果:状态 + 剩余朝向(fm[p] = 位置 p 上现在是原来的哪个面)。 */
export interface AlgResult {
  cube: CubieCube;
  faceMap: number[];
  /** 用到过整体旋转 / 宽层 / 中层。 */
  reoriented: boolean;
}

/** 施加一段公式;遇到不认识的记号抛错。 */
export function applyAlgExtended(alg: string): AlgResult {
  const parts = alg.trim().split(/[\s,]+/).filter(Boolean);
  let cube = solvedCubie();
  let fm = [0, 1, 2, 3, 4, 5];
  let reoriented = false;
  for (const raw of parts) {
    const tok = raw.replace(/’/g, "'");
    const m = TOKEN_RE.exec(tok);
    if (!m) throw new Error(tok);
    const base = WIDE_ALIAS[m[1]] ?? m[1];
    let prims = EXPAND[base];
    if (!prims) throw new Error(tok);
    if (base.length > 1 || 'MESxyz'.includes(base)) reoriented = true;
    const sfx = m[2];
    let times = sfx.includes('2') ? 2 : 1;
    if (sfx.includes("'") || sfx.includes('’') || sfx === '3') prims = invertPrims(prims);
    while (times-- > 0) {
      for (const p of prims) {
        if (p.kind === 'f') {
          const face = fm[p.idx];
          for (let k = 0; k < p.pow; k++) cube = multiply(cube, BASIC_MOVES[face]);
        } else {
          const src = ROT_SRC[p.idx];
          for (let k = 0; k < p.pow; k++) fm = src.map((s) => fm[s]);
        }
      }
    }
  }
  return { cube, faceMap: fm, reoriented };
}
