import { scramble444RandomState } from './scramble_444_rs';
import { get222Mode } from '@/lib/scramble-222-mode';
import { wcaPocketScramble, optimalPocketScramble } from '@/lib/pocket-scramble';

/**
 * Random-move scrambles for NxN cubes (WCA-style face filtering).
 *
 * Rule: no two consecutive moves on the same face, and at most two
 * consecutive moves on the same axis (i.e. R then L is OK, but R then L then R
 * is filtered to avoid trivially canceling sequences). For 4x4+ wide moves
 * (Rw, Uw, etc.) are interleaved.
 *
 * Lengths follow WCA scramble length conventions:
 *   2x2 = 11, 3x3 = 25 (we use 20 — modern WCA uses random-state with avg ~19),
 *   4x4 = 45, 5x5 = 60, 6x6 = 80, 7x7 = 100.
 *
 * Output is space-separated string, e.g. "R U R' F2 L".
 */

const FACES_3 = ['U', 'D', 'L', 'R', 'F', 'B'] as const;

// Axis groups: same-axis moves cancel/commute (R&L, U&D, F&B).
const AXIS: Record<string, number> = {
  U: 0, D: 0,
  L: 1, R: 1,
  F: 2, B: 2,
};

const SUFFIX = ['', "'", '2'];

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function genFaceMoves(faces: readonly string[], len: number, rng: () => number): string {
  const out: string[] = [];
  let lastFace = '';
  let prevAxisFace = ''; // face before lastFace (only relevant if same axis)
  for (let i = 0; i < len; i++) {
    let face: string;
    let attempts = 0;
    do {
      face = pick(faces, rng);
      attempts++;
      if (attempts > 50) break; // safety, should never trigger with 6 faces
    } while (
      face === lastFace ||
      // forbid R L R or U D U (same axis sandwich would just be 2 layers' worth)
      (AXIS[face] === AXIS[lastFace] && face === prevAxisFace)
    );
    out.push(face + pick(SUFFIX, rng));
    prevAxisFace = AXIS[face] === AXIS[lastFace] ? lastFace : '';
    lastFace = face;
  }
  return out.join(' ');
}

export function scramble222(rng: () => number): string {
  // WCA 二阶 = 随机态求解(不是 random-move):走站内 TNoodle 移植(lib/pocket-scramble),与
  // /scramble/gen 同源。口径由全站 2x2 设置(Scramble222ModePicker)决定 —— wca = 恰好 11 步、
  // 握位代价最小(与赛场一致);optimal = HTM 最短 + Q|H(均 ~8.8 步)。二者都只含 U/R/F。
  return get222Mode() === 'optimal' ? optimalPocketScramble(rng) : wcaPocketScramble(rng);
}

export function scramble333(rng: () => number): string {
  return genFaceMoves(FACES_3, 20, rng);
}

/**
 * NxN with wide moves. wideThreshold = 1 means single-layer; wideThreshold = 2
 * means we allow Uw/Rw/Fw etc.; Bigger cubes (5x5+) have multi-layer wide
 * (3Uw, 3Rw...). For simplicity we emit 1- and 2-layer wide on 4x4, plus 3-layer
 * starting at 6x6.
 */
function genBigMoves(len: number, maxWide: number, rng: () => number): string {
  const out: string[] = [];
  let lastFace = '';
  let lastWide = 0;
  for (let i = 0; i < len; i++) {
    let face: string;
    let wide: number;
    let attempts = 0;
    do {
      face = pick(FACES_3, rng);
      wide = 1 + Math.floor(rng() * maxWide);
      attempts++;
      if (attempts > 50) break;
    } while (face === lastFace && wide === lastWide);
    let token: string;
    if (wide === 1) {
      token = face;
    } else if (wide === 2) {
      token = face + 'w';
    } else {
      token = wide + face + 'w';
    }
    out.push(token + pick(SUFFIX, rng));
    lastFace = face;
    lastWide = wide;
  }
  return out.join(' ');
}

export function scramble444(rng: () => number): string {
  // Prefer true random-state (cstimer port). Fall back to random-move on error.
  try {
    return scramble444RandomState(rng);
  } catch {
    return genBigMoves(45, 2, rng);
  }
}

export function scramble555(rng: () => number): string {
  return genBigMoves(60, 2, rng);
}

export function scramble666(rng: () => number): string {
  return genBigMoves(80, 3, rng);
}

export function scramble777(rng: () => number): string {
  return genBigMoves(100, 3, rng);
}
