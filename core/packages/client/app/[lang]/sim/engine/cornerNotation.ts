/**
 * Shared corner-twist notation helpers for the corner-turning puzzles (Dino, Redi).
 *
 * Both puzzles share the exact same move shape — a corner index + a ±120° direction
 * — and the exact same notation grammar: whitespace-separated tokens, each a corner
 * name optionally suffixed with `'`. They differ only in their corner NAMES (Dino:
 * 3-letter UFR-style; Redi: F L B R / f l b r) and the regex that matches them, so
 * each state module passes its own `tokenRe` + `names`. Bare = the clockwise twist
 * (dir −1, −120°); primed = its CCW inverse (dir +1) — see each module's notation
 * comment. Pure TS, no three.js, so the state models stay render-free.
 */

/** Move shape both corner-turners use (DinoMove / RediMove are structurally this). */
export interface CornerMove {
  corner: number;
  dir: 1 | -1;
}

/**
 * Tokenize a scramble / alg string into corner moves. `tokenRe` must capture the
 * corner name in group 1 and the optional prime in group 2 (e.g.
 * `/^(UFR|...)('?)$/`). `names` maps a captured name → its corner index. Unknown
 * tokens are skipped. Bare token → dir −1, primed → dir +1.
 */
export function parseCornerMoves(
  text: string,
  tokenRe: RegExp,
  names: ReadonlyArray<string>,
): CornerMove[] {
  const index = new Map<string, number>(names.map((n, i) => [n, i]));
  const out: CornerMove[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const m = tokenRe.exec(raw);
    if (!m) continue;
    const corner = index.get(m[1]);
    if (corner === undefined) continue;
    out.push({ corner, dir: m[2] ? 1 : -1 });
  }
  return out;
}

/** Render one move to its canonical token: bare = clockwise (dir −1), primed = CCW
 *  inverse (dir +1). Exact inverse of parseCornerMoves. */
export function cornerMoveToString(move: CornerMove, names: ReadonlyArray<string>): string {
  return names[move.corner] + (move.dir === 1 ? "'" : '');
}

export function cornerMovesToString(moves: CornerMove[], names: ReadonlyArray<string>): string {
  return moves.map((m) => cornerMoveToString(m, names)).join(' ');
}

/**
 * Random legal scramble: `n` twists over `cornerCount` corners, never the same
 * corner twice in a row (a repeat just composes into one move, wasting length).
 */
export function randomCornerScramble(n: number, cornerCount = 8): CornerMove[] {
  const out: CornerMove[] = [];
  let last = -1;
  for (let i = 0; i < n; i++) {
    let corner: number;
    do { corner = Math.floor(Math.random() * cornerCount); } while (corner === last);
    last = corner;
    out.push({ corner, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  return out;
}
