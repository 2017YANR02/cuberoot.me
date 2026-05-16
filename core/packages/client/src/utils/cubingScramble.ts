/**
 * WCA-spec scrambles via `cubing/scramble`. cubing.js's scramblers are
 * maintained by the same author as tnoodle (Lucas Garron) and produce the
 * same official WCA-compliant output for all 17 events — exposed here as a
 * single async entry point. Accepts either short keys ('3x3', 'pyra', 'mega'…)
 * or WCA ids ('333', 'pyram', 'minx'…).
 */
import { randomScrambleForEvent } from 'cubing/scramble';
import { toWcaEventId } from './wca_events';

export const TNOODLE_WCA_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '444bf', '555bf',
  '333fm', '333oh', '333mbf',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
] as const;

const SUPPORTED = new Set<string>(TNOODLE_WCA_EVENTS);

export function isTnoodleSupportedEvent(event: string): boolean {
  return SUPPORTED.has(toWcaEventId(event));
}

/**
 * NxN random-move scrambler for N>=8, modeled after cubing.js's 5/6/7
 * (which are also random-move per WCA, not random-state — there's no solver
 * for those sizes either).
 *
 * - Length: WCA arithmetic 60/80/100 for 5/6/7 → linear 20*(N-2) for N>=8.
 *   N=8 → 120, N=10 → 160, N=20 → 360, N=100 → 1960.
 * - Output: cubing.js / WCA wide notation (`R`, `Rw`, `3Rw'`, `5Rw2`).
 *   Compatible with cubing.js Alg parser AND huazhechen TwistNode parser.
 * - Reduction rules (same as tnoodle/cubing.js):
 *   - reject same face as previous (no `R R`)
 *   - reject same axis as previous *and* the one before (no `R L R` pattern,
 *     which is strictly equivalent to a shorter sequence)
 * - Depth uniform random 1..floor(N/2); suffix uniform '' / "'" / "2".
 */
const SCRAMBLE_FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const SCRAMBLE_AXIS_OF: Record<string, number> = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SCRAMBLE_SUFFIXES = ['', "'", '2'] as const;

export function randomMoveScrambleNxN(N: number): string {
  if (N < 2) return '';
  const length = N >= 5 ? 20 * (N - 2) : Math.max(20, 9 * N);
  const maxDepth = Math.max(1, Math.floor(N / 2));
  const moves: string[] = [];
  let prevAxis = -1;
  let prevPrevAxis = -1;
  let prevFace = '';
  while (moves.length < length) {
    const face = SCRAMBLE_FACES[Math.floor(Math.random() * 6)];
    const axis = SCRAMBLE_AXIS_OF[face];
    if (face === prevFace) continue;
    if (axis === prevAxis && axis === prevPrevAxis) continue;
    const depth = 1 + Math.floor(Math.random() * maxDepth);
    const suffix = SCRAMBLE_SUFFIXES[Math.floor(Math.random() * SCRAMBLE_SUFFIXES.length)];
    const prefix = depth >= 3 ? String(depth) : '';
    const wide = depth >= 2 ? 'w' : '';
    moves.push(`${prefix}${face}${wide}${suffix}`);
    prevPrevAxis = prevAxis;
    prevAxis = axis;
    prevFace = face;
  }
  return moves.join(' ');
}

export async function tnoodleRandomScramble(event: string): Promise<string | null> {
  const wcaId = toWcaEventId(event);
  if (!SUPPORTED.has(wcaId)) return null;
  const alg = await randomScrambleForEvent(wcaId);
  let str = alg.toString();
  // Megaminx: WCA-spec scrambles are 7 face cycles (~11 moves each) ending
  // with U or U'. Tnoodle prints one cycle per line. cubing.js's toString()
  // joins them with spaces, so we inject '\n' after each U-prefixed token to
  // restore the canonical layout. PDF + screen renderers honor '\n'.
  if (wcaId === 'minx' && !str.includes('\n')) {
    const tokens = str.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur: string[] = [];
    for (const tok of tokens) {
      cur.push(tok);
      if (/^U['+]?$/.test(tok)) {
        lines.push(cur.join(' '));
        cur = [];
      }
    }
    if (cur.length) lines.push(cur.join(' '));
    str = lines.join('\n');
  }
  return str;
}
