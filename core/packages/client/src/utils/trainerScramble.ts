/**
 * Trainer scramble generation.
 *
 * Strategy: prefer `case.setup` (forward scramble that produces the case state),
 * fall back to inverse(alg) when setup is missing. Optionally randomize so the
 * scramble isn't identical every time the same case is picked.
 *
 * Randomization rules per puzzle (kept conservative — only inject moves that
 * are valid notation for the puzzle):
 *   - 3x3 F2L sticker      → random y pre-rotation (cube is rotated, slot
 *                            doesn't have to be FR)
 *   - 3x3 last-layer / 2x2 → random U post-rotation (AUF; matches upstream
 *                            ZBLL/ZBLS trainer behavior)
 *   - sq1 / megaminx /     → setup as-is. U is meaningless / illegal in
 *     pyraminx / skewb       these notations; deterministic per case is fine
 *                            since speedcubedb's setup is already the user-
 *                            facing scramble.
 *   - 4x4 / 5x5            → setup as-is for now (parity sets only — small).
 */
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';

const AUF = ['', 'U', 'U2', "U'"];
const Y = ['', 'y', 'y2', "y'"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Reverse a WCA-notation alg (used as setup fallback when case.setup is empty). */
function inverseAlg(alg: string): string {
  return alg
    .split(/\s+/)
    .filter(Boolean)
    .map(m => {
      if (m.endsWith('2')) return m;
      if (m.endsWith("'")) return m.slice(0, -1);
      return m + "'";
    })
    .reverse()
    .join(' ');
}

export function generateScramble(c: AlgCase, puzzle: AlgPuzzle): string {
  const baseAlg = c.algs.flat()[0]?.alg ?? c.standard ?? '';
  const base = c.setup && c.setup.trim()
    ? c.setup.trim()
    : inverseAlg(baseAlg);
  if (!base) return '';

  if (puzzle === '3x3') {
    if (c.sticker.kind === 'f2l') {
      const yPre = pick(Y);
      return [yPre, base].filter(Boolean).join(' ');
    }
    const post = pick(AUF);
    return [base, post].filter(Boolean).join(' ').trim();
  }

  if (puzzle === '2x2') {
    // 2x2 LL-style sets (Ortega OLL/PBL, CLL, EG) — AUF safe
    const post = pick(AUF);
    return [base, post].filter(Boolean).join(' ').trim();
  }

  // sq1 / megaminx / pyraminx / skewb / 4x4 / 5x5 — leave setup verbatim
  return base;
}
