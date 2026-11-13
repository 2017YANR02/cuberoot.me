/**
 * Skewb notation translation between Sarah's "Algorithm Notation" and the
 * WCA / cubing.js letter set (R/U/L/B/F/D + x/y/z).
 *
 * Sarah / Algorithm notation (used by speedcubedb's Sarah's Advanced set and
 * Sarah Strong's PDF):
 *   F = UFR (top-front-right corner)
 *   L = ULF (top-front-left corner)
 *   R = URB (top-back-right corner)
 *   B = ULB (top-back-left corner)
 *   r = DRB (bottom-back-right corner)
 *   l = DLF (bottom-front-left corner)
 *   b = DLB (bottom-back-left corner)
 *   d, f = DFR (bottom-front-right corner; both spellings used in the wild)
 *   S = sledgehammer = F' L F L' (Sarah)
 *   H = hedgeslammer  = L F' L' F (Sarah)
 *   x, y, z = standard whole-cube rotations
 *
 * WCA / cubing.js notation (as the cubing.js skewb KPuzzle names its 8 grips —
 * base moves `D U L UR R UL B F` verified via playwright probe):
 *   F = UFR, U = ULB, L = DLF, R = DRB, B = DLB, D = DFR, UL = ULF, UR = URB.
 *   All 8 corners have a single token — no conjugate/rotation needed.
 *
 * Resolved direct mapping:
 *   Sarah F → F        (UFR ≡ UFR)
 *   Sarah B → U        (ULB ≡ ULB)
 *   Sarah r → R        (DRB ≡ DRB)
 *   Sarah l → L        (DLF ≡ DLF)
 *   Sarah b → B        (DLB ≡ DLB)
 *   Sarah d/f → D      (DFR ≡ DFR)
 *   Sarah L → UL       (ULF ≡ ULF; UL ≡ y' F y, verified equal cube state)
 *   Sarah R → UR       (URB ≡ URB; UR ≡ y  F y', verified equal cube state)
 *
 * Emitting the single UL/UR tokens (instead of the y-conjugates the mapper used to
 * produce) keeps the cubing.js render identical AND makes the output parseable by
 * the /sim engine skewb, whose corner parser accepts UL/UR but not whole-cube
 * rotations. sr-puzzlegen (the /alg skewb thumbnail) reads only [LRUB] so it ignored
 * both forms alike — unchanged.
 *
 * Macro expansion (per Sarah's PDF; L now expands to UL via the direct map, so the
 * macros are rotation-free too):
 *   S  → F' L F L'   →  F' UL F UL'
 *   S' → L F' L' F   (= H)
 *   H  → L F' L' F   →  UL F' UL' F
 *   H' → F' L F L'   (= S)
 *
 * Token grammar accepts prime/double suffixes, including inverse doubles (2').
 */
import { lexCornerNotation, cornerTurnAmount } from './corner_notation';

const SARAH_DIRECT: Record<string, string> = {
  F: 'F',
  B: 'U',
  r: 'R',
  l: 'L',
  b: 'B',
  d: 'D',
  f: 'D',
  L: 'UL',
  R: 'UR',
};

const SARAH_MACRO: Record<string, { plain: string; prime: string; double: string }> = {
  S: {
    plain:  "F' L F L'",
    prime:  "L F' L' F",
    double: "F' L F L' F' L F L'",
  },
  H: {
    plain:  "L F' L' F",
    prime:  "F' L F L'",
    double: "L F' L' F L F' L' F",
  },
};

/**
 * Translate one Sarah-notation token to WCA/cubing.js notation. Returns an
 * array of output tokens (length ≥ 1). Unknown tokens are passed through.
 */
function translateToken(tok: string): string[] {
  const m = /^([A-Za-z])((?:2)?'?)$/.exec(tok);
  if (!m) return [tok];
  const ch = m[1];
  const suffix = m[2];

  if (SARAH_MACRO[ch]) {
    const macro = SARAH_MACRO[ch];
    const body = suffix === "2'" ? `${macro.prime} ${macro.prime}`
      : suffix === "'" ? macro.prime : suffix === '2' ? macro.double : macro.plain;
    return translate(body).split(/\s+/).filter(Boolean);
  }

  if (SARAH_DIRECT[ch] !== undefined) {
    return [SARAH_DIRECT[ch] + suffix];
  }

  // Rotations (x/y/z) and any other tokens (e.g. lowercase u — uncommon) pass through.
  return [tok];
}

/**
 * Translate a Sarah-notation alg string to WCA / cubing.js notation. Whitespace-
 * separated tokens. Unknown tokens (including raw WCA moves that happen to be
 * Sarah-equivalent like `x`, `y`, `z`) pass through unchanged.
 */
export function translate(alg: string): string {
  if (!alg) return alg;
  const out: string[] = [];
  for (const tok of alg.trim().split(/\s+/).filter(Boolean)) {
    for (const o of translateToken(tok)) out.push(o);
  }
  return out.join(' ');
}

/**
 * Invert one skewb token by negating its amount: flip the prime, keep the
 * repeat count. Works on the whole token grammar — corner twists (`R`↔`R'`,
 * `r2`↔`r2'`), macros (`S`↔`S'`, `H`↔`H'`, since the notation defines S' as the
 * hedge = inverse sledge) and rotations (`y2`↔`y2'`). Unknown tokens pass through.
 *
 * `X2'` (= X⁻²) is the exact inverse of `X2` (= X²) regardless of the move's
 * order — so this stays correct for skewb's 3-fold corner twists, where the
 * naive "keep the 2" rule (right for 3x3/rotations) would be wrong.
 */
function invertToken(tok: string): string {
  // `[A-Za-z]+` so WCA's two-letter grips (UL/UR) invert too, not just the
  // single-letter Sarah/WCA tokens.
  const m = /^([A-Za-z]+)(\d*)('?)$/.exec(tok);
  if (!m) return tok;
  const [, ch, digits, prime] = m;
  const repeat = digits && digits !== '1' ? digits : '';
  return ch + repeat + (prime ? '' : "'");
}

/**
 * Inverse of a skewb alg: reverse the token order and invert each token.
 *
 * Skewb's Sarah-Advanced algs are full solves (no AUF), so a case's scramble is
 * exactly the inverse of the alg that solves it. speedcubedb's scraped `setup`
 * strings are unreliable (buggy WCA-ified inverses — e.g. containing `R' R`
 * cancellations); {@link loadAlg} regenerates skewb setups from this instead.
 */
export function invert(alg: string): string {
  if (!alg || !alg.trim()) return alg;
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = toks.length - 1; i >= 0; i--) out.push(invertToken(toks[i]));
  return out.join(' ');
}

/**
 * The two skewb notation systems currently supported.
 *  - 'wca': WCA / cubing.js native (R/U/L/B/F/D)
 *  - 'sarah': Sarah / Algorithm notation (R/L/B/F uppercase = top corners;
 *             r/l/b/d/f lowercase = bottom corners; S/H macros)
 */
export type SkewbNotation = 'wca' | 'sarah';

/** Convert an alg in the given notation to WCA. No-op for 'wca'. */
export function toWca(alg: string, notation: SkewbNotation): string {
  return notation === 'sarah' ? translate(alg) : alg;
}

/**
 * Quarter-turn (bare, −90°) grip permutation for x / y / z: ROT_GRIP_TAU[axis][ℓ] = the
 * grip a WORLD-fixed letter ℓ drives after one bare rotation about that axis. Derived
 * offline (.tmp/skewb/derive_skewb_rot.mjs) by replicating SkewbCube.remapGrip's argmax
 * geometry — tau(ℓ) = argmax_g A_g·(R⁻¹·A_ℓ) over CORNER_AXIS — so this pure table cannot
 * drift from the engine's live geometric remap. The closed-loop bridge test re-certifies
 * table ≡ engine every run (a mismatch desyncs the PG mirror and the BSGS solve fails).
 * Each is order 4 (τ⁴ = id) and swaps the two corner orbits, as a 90° cube turn must.
 */
export const ROT_GRIP_TAU: ReadonlyArray<ReadonlyArray<number>> = [
  [4, 5, 0, 1, 6, 7, 2, 3], // x
  [2, 0, 3, 1, 6, 4, 7, 5], // y
  [1, 5, 3, 7, 0, 4, 2, 6], // z
];

/**
 * Advance a world-letter → physical-grip map across one whole-cube rotation. A bare turn
 * composes τ once, a prime three times (τ has order 4, so τ³ = τ⁻¹), a double twice; each
 * application is g2p'[ℓ] = g2p[τ[ℓ]]. This is the skewb analogue of the pyraminx's
 * rotateLetterMap — the PG bridge folds rotations through it so the group mirror stays
 * faithful across reorientations (`y R y' R'` correctly stays scrambled), instead of the
 * old shortcut that dropped rotations and falsely cancelled such sequences to solved.
 */
export function rotateGripMap(
  g2p: ReadonlyArray<number>, rot: 0 | 1 | 2, dir: 1 | -1 | 2,
): number[] {
  const t = ROT_GRIP_TAU[rot];
  const n = dir === 1 ? 1 : dir === -1 ? 3 : 2;
  let m = g2p.slice();
  for (let i = 0; i < n; i++) { const prev = m; m = prev.map((_, l) => prev[t[l]]); }
  return m;
}


export const SKEWB_WCA_TOKENS = ['F', 'UL', 'UR', 'U', 'D', 'L', 'R', 'B'] as const;
export type SkewbNotationMove = { corner: number; dir: 1 | -1 } | { rot: 0 | 1 | 2; dir: 1 | -1 | 2 };

export function parseSkewbAlgorithm(text: string): { moves: SkewbNotationMove[]; invalid: string[] } {
  const parsed = lexCornerNotation(text, /^(?:UL|UR|[UFDLRBxyzSHrlbfd])\d*'?/);
  const moves: SkewbNotationMove[] = [];
  for (const token of parsed.tokens) {
    const macro = /^([SH])(\d*)('?)$/.exec(token);
    if (macro) {
      const count = Number(macro[2] || 1);
      if (!Number.isSafeInteger(count) || count > 100) { parsed.invalid.push(token); continue; }
      // Use the site's existing Sarah macro definitions, converted to WCA grips.
      // Ordinary uppercase R/L/B keep their WCA meaning; never guess a dialect.
      const body = parseSkewbAlgorithm(translateToken(macro[1] + macro[3]).join(' ')).moves;
      for (let i = 0; i < count; i++) moves.push(...body);
      continue;
    }
    const lower = /^([rlbfd])(\d*)('?)$/.exec(token);
    if (lower) {
      moves.push(...parseSkewbAlgorithm(SARAH_DIRECT[lower[1]] + lower[2] + lower[3]).moves);
      continue;
    }
    const match = /^(UL|UR|[UFDLRBxyz])(\d*)('?)$/.exec(token)!;
    const rot = 'xyz'.indexOf(match[1]);
    const amount = cornerTurnAmount(match[2], match[3], rot < 0 ? 3 : 4);
    if (!amount) continue;
    if (rot >= 0) moves.push({ rot: rot as 0 | 1 | 2, dir: amount === 3 ? -1 : amount as 1 | 2 });
    else moves.push({ corner: SKEWB_WCA_TOKENS.indexOf(match[1] as typeof SKEWB_WCA_TOKENS[number]), dir: amount === 1 ? -1 : 1 });
  }
  return { moves, invalid: parsed.invalid };
}
