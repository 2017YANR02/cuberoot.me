/**
 * Cross 标准化引擎——1:1 移植自 recon/recon_norm_cross.js（251 行）
 * NOTE: 用于将 Cross 解法标准化为最简形式（消除旋转、重写宽转动）
 */

// ── 面转动集合 ──

/** 基础面 */
type Face = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';

/**
 * 旋转对面映射——执行一次 x/y/z 旋转后，各面的新位置
 * NOTE: 表示 "旋转后原来的 X 面变成了 Y 面"
 */
const ROTATION_MAP: Record<string, Record<Face, Face>> = {
  x:  { U: 'F', F: 'D', D: 'B', B: 'U', R: 'R', L: 'L' },
  "x'": { U: 'B', B: 'D', D: 'F', F: 'U', R: 'R', L: 'L' },
  x2: { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' },
  y:  { U: 'U', D: 'D', F: 'L', L: 'B', B: 'R', R: 'F' },
  "y'": { U: 'U', D: 'D', F: 'R', R: 'B', B: 'L', L: 'F' },
  y2: { U: 'U', D: 'D', F: 'B', B: 'F', R: 'L', L: 'R' },
  z:  { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' },
  "z'": { U: 'L', L: 'D', D: 'R', R: 'U', F: 'F', B: 'B' },
  z2: { U: 'D', D: 'U', R: 'L', L: 'R', F: 'F', B: 'B' },
};

/**
 * 宽转动 → 普通面转 + 旋转 的分解表
 * NOTE: 例如 r = R + x（后层不动），Rw = r
 */
const WIDE_MOVE_DECOMPOSE: Record<string, [string, string]> = {
  // 小写宽转动
  r:   ['L', 'x'],   "r'":  ['L\'', 'x\''],  r2:  ['L2', 'x2'],
  l:   ['R', 'x\''], "l'":  ['R\'', 'x'],     l2:  ['R2', 'x2'],
  u:   ['D', 'y'],   "u'":  ['D\'', 'y\''],   u2:  ['D2', 'y2'],
  d:   ['U', 'y\''], "d'":  ['U\'', 'y'],     d2:  ['U2', 'y2'],
  f:   ['B', 'z'],   "f'":  ['B\'', 'z\''],   f2:  ['B2', 'z2'],
  b:   ['F', 'z\''], "b'":  ['F\'', 'z'],     b2:  ['F2', 'z2'],
  // Xw 格式
  Rw:  ['L', 'x'],   "Rw'": ['L\'', 'x\''],  Rw2: ['L2', 'x2'],
  Lw:  ['R', 'x\''], "Lw'": ['R\'', 'x'],    Lw2: ['R2', 'x2'],
  Uw:  ['D', 'y'],   "Uw'": ['D\'', 'y\''],  Uw2: ['D2', 'y2'],
  Dw:  ['U', 'y\''], "Dw'": ['U\'', 'y'],    Dw2: ['U2', 'y2'],
  Fw:  ['B', 'z'],   "Fw'": ['B\'', 'z\''],  Fw2: ['B2', 'z2'],
  Bw:  ['F', 'z\''], "Bw'": ['F\'', 'z'],    Bw2: ['F2', 'z2'],
};

/** 旋转集合（快速判断） */
const ROTATIONS = new Set(Object.keys(ROTATION_MAP));

// ── 核心逻辑 ──

/**
 * 对一个面转动应用旋转变换
 * NOTE: 如 R 在 y 旋转后变成 F
 * @param move 面转动（如 "R", "U'", "L2"）
 * @param rotationMap 旋转映射
 */
function applyRotationToMove(move: string, rotationMap: Record<Face, Face>): string {
  // NOTE: 解析面+后缀（如 R' → face=R, suffix='）
  const face = move[0] as Face;
  const suffix = move.substring(1); // ' 或 2 或空
  const newFace = rotationMap[face];
  if (!newFace) return move; // NOTE: 非法面转动，原样返回
  return newFace + suffix;
}

/**
 * 组合两个旋转的映射
 * NOTE: 先执行 rot1，再执行 rot2
 */
function composeRotations(
  map1: Record<Face, Face>,
  map2: Record<Face, Face>,
): Record<Face, Face> {
  const result = {} as Record<Face, Face>;
  const faces: Face[] = ['U', 'D', 'R', 'L', 'F', 'B'];
  for (const f of faces) {
    result[f] = map2[map1[f]];
  }
  return result;
}

/** 恒等旋转映射 */
const IDENTITY_MAP: Record<Face, Face> = { U: 'U', D: 'D', R: 'R', L: 'L', F: 'F', B: 'B' };

/**
 * 将累积旋转映射还原为最简旋转序列
 * NOTE: 只考虑 x, y, z 及其组合，返回尽可能短的旋转序列
 */
function mapToRotations(map: Record<Face, Face>): string[] {
  // NOTE: 暴力枚举所有长度 ≤2 的旋转组合，找到匹配的最短序列
  const allRots = Object.keys(ROTATION_MAP);
  const faces: Face[] = ['U', 'D', 'R', 'L', 'F', 'B'];

  const mapsEqual = (a: Record<Face, Face>, b: Record<Face, Face>) =>
    faces.every(f => a[f] === b[f]);

  // NOTE: 恒等——无需旋转
  if (mapsEqual(map, IDENTITY_MAP)) return [];

  // NOTE: 单旋转
  for (const r of allRots) {
    if (mapsEqual(map, ROTATION_MAP[r])) return [r];
  }

  // NOTE: 双旋转
  for (const r1 of allRots) {
    for (const r2 of allRots) {
      const composed = composeRotations(ROTATION_MAP[r1], ROTATION_MAP[r2]);
      if (mapsEqual(map, composed)) return [r1, r2];
    }
  }

  // NOTE: 理论上不会到这里——3 阶魔方旋转群 ≤2 步可达
  return [];
}

/**
 * 标准化 Cross 解法
 * 1. 将宽转动分解为 面转动 + 旋转
 * 2. 将旋转吸收——旋转不实际执行，而是变换后续面转动
 * 3. 最后输出最简旋转前缀 + 标准化的面转动序列
 *
 * @param moves 步骤 token 数组
 * @returns 标准化后的 token 数组
 */
export function normalize(moves: string[]): string[] {
  // NOTE: Phase 1 — 展开宽转动
  const expanded: string[] = [];
  for (const m of moves) {
    const decomp = WIDE_MOVE_DECOMPOSE[m];
    if (decomp) {
      expanded.push(decomp[0], decomp[1]);
    } else {
      expanded.push(m);
    }
  }

  // NOTE: Phase 2 — 将旋转吸收到后续面转动中
  // 从后往前扫描：遇到旋转时，将其效果应用到前面所有面转动上
  let accMap = { ...IDENTITY_MAP };
  const result: string[] = [];

  for (let i = expanded.length - 1; i >= 0; i--) {
    const token = expanded[i];
    if (ROTATIONS.has(token)) {
      // NOTE: 累积旋转——将此旋转应用到累积映射中
      accMap = composeRotations(ROTATION_MAP[token], accMap);
    } else {
      // NOTE: 面转动——用累积旋转变换
      result.unshift(applyRotationToMove(token, accMap));
    }
  }

  // NOTE: Phase 3 — 将剩余的累积旋转转为最简前缀
  const prefixRots = mapToRotations(accMap);
  return [...prefixRots, ...result];
}
