/**
 * 3x3 facelet-string ↔ CubieCube (Kociemba 标准约定)。
 *
 * 54-char URFDLB facelet 字符串 — 行主序、字符为面字母:
 *   U: 0..8   R: 9..17   F: 18..26   D: 27..35   L: 36..44   B: 45..53
 *
 * Port of cstimer min2phase 的 cornerFacelet/edgeFacelet 表 + fromFacelet/toFacelet
 * 算法。CubieCube 形状与 pages/timer/scramble/kociemba/cube.ts 一致。
 */

import type { CubieCube } from './_kociemba/cube';

// 8 个角块,每个对应 [U/D 面 sticker idx, side1, side2] (cstimer 顺序)
const CORNER_FACELET: ReadonlyArray<readonly [number, number, number]> = [
  [8, 9, 20],   // URF
  [6, 18, 38],  // UFL
  [0, 36, 47],  // ULB
  [2, 45, 11],  // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
];

// 12 个棱块,每个对应 [primary, secondary] sticker idx
const EDGE_FACELET: ReadonlyArray<readonly [number, number]> = [
  [5, 10],   // UR
  [7, 19],   // UF
  [3, 37],   // UL
  [1, 46],   // UB
  [32, 16],  // DR
  [28, 25],  // DF
  [30, 43],  // DL
  [34, 52],  // DB
  [23, 12],  // FR
  [21, 41],  // FL
  [50, 39],  // BL
  [48, 14],  // BR
];

const FACES = 'URFDLB';

export const SOLVED_FACELET =
  'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * 每个 sticker idx 的同块伙伴 idx:
 *   - 中心(idx % 9 === 4):无伙伴
 *   - 棱:1 个伙伴
 *   - 角:2 个伙伴
 * 用于 painting 时拒绝同块重复色 / 相对面色。
 */
export const STICKER_SIBLINGS: ReadonlyArray<readonly number[]> = (() => {
  const out: number[][] = Array.from({ length: 54 }, () => []);
  for (const [a, b, c] of CORNER_FACELET) {
    out[a] = [b, c];
    out[b] = [a, c];
    out[c] = [a, b];
  }
  for (const [a, b] of EDGE_FACELET) {
    out[a] = [b];
    out[b] = [a];
  }
  return out;
})();

/** 标准化为 54 大写字母,并校验长度。失败抛错。 */
export function normalizeFacelet(s: string): string {
  const cleaned = s.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length !== 54) {
    throw new Error(`facelet length ${cleaned.length}, expected 54`);
  }
  return cleaned;
}

/**
 * Facelet 字符串 → CubieCube。失败抛错(如颜色数量不对、片段不存在)。
 *
 * 算法:每个角/棱位置从 facelet 读 sticker 颜色 → 找匹配的角/棱片段 → 写 cp+co/ep+eo。
 */
export function faceletToCubie(facelet: string): CubieCube {
  const s = normalizeFacelet(facelet);
  // 6 个中心字符 → 颜色 idx (URFDLB → 0..5)。允许任意字符方案,只看相对身份。
  const centers = s[4] + s[13] + s[22] + s[31] + s[40] + s[49];
  const f = new Array<number>(54);
  let count = 0;
  for (let i = 0; i < 54; i++) {
    const idx = centers.indexOf(s[i]);
    if (idx === -1) throw new Error(`facelet ${i} char '${s[i]}' not in centers '${centers}'`);
    f[i] = idx;
    count += 1 << (idx * 4);
  }
  if (count !== 0x999999) {
    throw new Error('facelet color counts != 9 each');
  }

  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);

  for (let i = 0; i < 8; i++) {
    let ori = 0;
    for (; ori < 3; ori++) {
      // U=0 / D=3 sticker 在哪个 ori 位置
      if (f[CORNER_FACELET[i][ori]] === 0 || f[CORNER_FACELET[i][ori]] === 3) break;
    }
    if (ori === 3) throw new Error(`corner ${i}: no U/D sticker found`);
    const col1 = f[CORNER_FACELET[i][(ori + 1) % 3]];
    const col2 = f[CORNER_FACELET[i][(ori + 2) % 3]];
    let found = false;
    for (let j = 0; j < 8; j++) {
      if (col1 === Math.floor(CORNER_FACELET[j][1] / 9) &&
          col2 === Math.floor(CORNER_FACELET[j][2] / 9)) {
        cp[i] = j;
        co[i] = ori;
        found = true;
        break;
      }
    }
    if (!found) throw new Error(`corner ${i}: no matching piece for colors (${col1},${col2})`);
  }

  for (let i = 0; i < 12; i++) {
    let found = false;
    for (let j = 0; j < 12; j++) {
      const a0 = Math.floor(EDGE_FACELET[j][0] / 9);
      const a1 = Math.floor(EDGE_FACELET[j][1] / 9);
      if (f[EDGE_FACELET[i][0]] === a0 && f[EDGE_FACELET[i][1]] === a1) {
        ep[i] = j; eo[i] = 0; found = true; break;
      }
      if (f[EDGE_FACELET[i][0]] === a1 && f[EDGE_FACELET[i][1]] === a0) {
        ep[i] = j; eo[i] = 1; found = true; break;
      }
    }
    if (!found) throw new Error(`edge ${i}: no matching piece`);
  }

  return { cp, co, ep, eo };
}

/** CubieCube → facelet 字符串(URFDLB)。 */
export function cubieToFacelet(c: CubieCube): string {
  const f = new Array<string>(54);
  for (let i = 0; i < 54; i++) f[i] = FACES[Math.floor(i / 9)];
  for (let pos = 0; pos < 8; pos++) {
    const piece = c.cp[pos];
    const ori = c.co[pos];
    for (let n = 0; n < 3; n++) {
      const slotFacelet = CORNER_FACELET[pos][(n + ori) % 3];
      const colorFace = Math.floor(CORNER_FACELET[piece][n] / 9);
      f[slotFacelet] = FACES[colorFace];
    }
  }
  for (let pos = 0; pos < 12; pos++) {
    const piece = c.ep[pos];
    const ori = c.eo[pos];
    for (let n = 0; n < 2; n++) {
      const slotFacelet = EDGE_FACELET[pos][(n + ori) % 2];
      const colorFace = Math.floor(EDGE_FACELET[piece][n] / 9);
      f[slotFacelet] = FACES[colorFace];
    }
  }
  return f.join('');
}

/**
 * 校验 CubieCube 物理合法性。颜色数对 + 角棱片段都能识别还不够 — 还有
 * 三个不变量:
 *   - cp / ep 是 0..7 / 0..11 的排列(每个片段恰好一份)
 *   - sum(co) ≡ 0 (mod 3) — 全 8 角扭转角和必须 ≡0
 *   - sum(eo) ≡ 0 (mod 2) — 全 12 棱翻转和必须 ≡0
 *   - sgn(cp 排列) === sgn(ep 排列) — 角棱排列奇偶性必须相同
 *
 * 用户随便涂的状态大概率违反其中之一 → kociemba two-phase 搜不到解会无限
 * 搜下去。在送到 worker 前提前判掉。
 */
export function validateCubie(c: import('./_kociemba/cube').CubieCube): string | null {
  const seenC = new Set(c.cp);
  if (seenC.size !== 8) return 'corner permutation not bijective (some piece appears twice)';
  const seenE = new Set(c.ep);
  if (seenE.size !== 12) return 'edge permutation not bijective (some piece appears twice)';

  let coSum = 0;
  for (const v of c.co) coSum += v;
  if (coSum % 3 !== 0) return `corner orientation sum ${coSum} not divisible by 3 (one corner is twisted)`;

  let eoSum = 0;
  for (const v of c.eo) eoSum += v;
  if (eoSum % 2 !== 0) return `edge orientation sum ${eoSum} not divisible by 2 (one edge is flipped)`;

  if (permParity(c.cp) !== permParity(c.ep)) {
    return 'corner/edge permutation parity mismatch (single 2-cycle swap is impossible)';
  }
  return null;
}

function permParity(p: number[]): number {
  let parity = 0;
  const visited = new Array<boolean>(p.length).fill(false);
  for (let i = 0; i < p.length; i++) {
    if (visited[i]) continue;
    let j = i;
    let cycleLen = 0;
    while (!visited[j]) {
      visited[j] = true;
      j = p[j];
      cycleLen++;
    }
    if (cycleLen > 0) parity ^= (cycleLen - 1) & 1;
  }
  return parity;
}

/** 校验合法性 — 不抛错,返回 null 表示合法,否则错误信息。 */
export function validateFacelet(s: string): string | null {
  let cube;
  try {
    cube = faceletToCubie(s);
  } catch (e) {
    return (e as Error).message;
  }
  return validateCubie(cube);
}
