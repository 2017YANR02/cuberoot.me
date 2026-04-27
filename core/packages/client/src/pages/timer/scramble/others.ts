/**
 * Scramble generators for non-NxN puzzles. All random-move (not random-state).
 */

const SUFFIX2 = ['', "'"];

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Pyraminx — 8 random moves (U L R B faces) + tip moves (u l r b).
 */
export function scramblePyra(rng: () => number): string {
  const faces = ['U', 'L', 'R', 'B'] as const;
  const tips = ['u', 'l', 'r', 'b'] as const;
  const moves: string[] = [];
  let lastFace = '';
  for (let i = 0; i < 10; i++) {
    let f: string;
    let attempts = 0;
    do {
      f = pick(faces, rng);
      attempts++;
      if (attempts > 30) break;
    } while (f === lastFace);
    moves.push(f + pick(SUFFIX2, rng));
    lastFace = f;
  }
  // Random tips: each tip is included with 50% probability and a random direction.
  for (const t of tips) {
    if (rng() < 0.5) moves.push(t + pick(SUFFIX2, rng));
  }
  return moves.join(' ');
}

/**
 * Skewb — 11 random moves on 4 axes, alternating axis.
 */
export function scrambleSkewb(rng: () => number): string {
  const faces = ['U', 'L', 'R', 'B'] as const;
  const moves: string[] = [];
  let last = '';
  for (let i = 0; i < 11; i++) {
    let f: string;
    let attempts = 0;
    do {
      f = pick(faces, rng);
      attempts++;
      if (attempts > 30) break;
    } while (f === last);
    moves.push(f + pick(SUFFIX2, rng));
    last = f;
  }
  return moves.join(' ');
}

/**
 * Square-1 — random (top, bottom) twist pairs separated by '/'.
 * Top range: -5..6, Bottom range: -5..6, both nonzero (otherwise skip).
 * Length: ~12 slash-separated groups.
 */
export function scrambleSq1(rng: () => number): string {
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    const top = pickInt(-5, 6, rng, true);
    const bot = pickInt(-5, 6, rng, true);
    groups.push(`(${top},${bot})`);
  }
  return groups.join(' / ');
}

function pickInt(lo: number, hi: number, rng: () => number, nonzero: boolean): number {
  while (true) {
    const v = lo + Math.floor(rng() * (hi - lo + 1));
    if (!nonzero || v !== 0) return v;
  }
}

/**
 * Megaminx — Pochmann notation. 7 lines × 10 moves each:
 *   R++ D++ R-- D++ R++ D-- R++ D-- R++ D++   U
 * We just emit random direction (++/--) per move with the U tag at line end.
 */
export function scrambleMega(rng: () => number): string {
  const lines: string[] = [];
  for (let l = 0; l < 7; l++) {
    const tokens: string[] = [];
    for (let i = 0; i < 5; i++) {
      tokens.push('R' + (rng() < 0.5 ? '++' : '--'));
      tokens.push('D' + (rng() < 0.5 ? '++' : '--'));
    }
    tokens.push(rng() < 0.5 ? "U" : "U'");
    lines.push(tokens.join(' '));
  }
  return lines.join('\n');
}

/**
 * Clock — random pin states + dial twists, simplified WCA notation.
 * UR0+ DR0+ DL0+ UL0+ U0+ R0+ D0+ L0+ ALL0+ y2 ...
 */
export function scrambleClock(rng: () => number): string {
  const pins = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
  const tokens: string[] = [];
  for (const p of pins) {
    const n = -5 + Math.floor(rng() * 12); // -5..6
    tokens.push(`${p}${n >= 0 ? n + '+' : (-n) + '-'}`);
  }
  tokens.push('y2');
  for (const p of ['U', 'R', 'D', 'L', 'ALL']) {
    const n = -5 + Math.floor(rng() * 12);
    tokens.push(`${p}${n >= 0 ? n + '+' : (-n) + '-'}`);
  }
  // Random pin orientation suffix
  const pinFlags = ['UR', 'DR', 'DL', 'UL'];
  const flagged = pinFlags.filter(() => rng() < 0.5);
  if (flagged.length) tokens.push(flagged.join(''));
  return tokens.join(' ');
}
