/**
 * Blindfolded scramble generators.
 *
 * Conventions follow cstimer:
 *   - 3BLD / 3NI: 3x3 scramble prefixed with a random orientation
 *     (0-2 of [x, x', x2, y, y', y2, z, z', z2]).
 *   - MBLD: N independent 3x3 scrambles separated by newlines, prefixed with
 *     "Solve i of N:" markers. Default N = 3.
 *   - 4BLD/5BLD/6BLD/7BLD: NxN scramble with a "Rw Uw" suffix (matches cstimer's
 *     reorientation suffix; user blindfolds with stickers in standard position).
 */

import {
  scramble333,
  scramble444,
  scramble555,
  scramble666,
  scramble777,
} from './nxnxn';

const ROTATIONS = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'] as const;

function pickRotationPrefix(rng: () => number): string {
  // 0-2 random rotations, no two consecutive on same axis (loose).
  const n = Math.floor(rng() * 3); // 0, 1, or 2
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(ROTATIONS[Math.floor(rng() * ROTATIONS.length)]);
  }
  return out.join(' ');
}

export function scramble333Bld(rng: () => number): string {
  const rot = pickRotationPrefix(rng);
  const scr = scramble333(rng);
  return rot ? `${rot} ${scr}` : scr;
}

export function scramble333Ni(rng: () => number): string {
  // NI = "Number Indexed" — same shape as 3BLD: rotation prefix + 3x3 scramble.
  return scramble333Bld(rng);
}

const MBLD_DEFAULT_N = 3;

export function scrambleMbld(rng: () => number, n: number = MBLD_DEFAULT_N): string {
  const lines: string[] = [];
  for (let i = 1; i <= n; i++) {
    lines.push(`Solve ${i} of ${n}: ${scramble333(rng)}`);
  }
  return lines.join('\n');
}

export function scramble444Bld(rng: () => number): string {
  return `${scramble444(rng)} Rw Uw`;
}

export function scramble555Bld(rng: () => number): string {
  return `${scramble555(rng)} Rw Uw`;
}

export function scramble666Bld(rng: () => number): string {
  return `${scramble666(rng)} 3Rw Uw`;
}

export function scramble777Bld(rng: () => number): string {
  return `${scramble777(rng)} 3Rw 3Uw`;
}
