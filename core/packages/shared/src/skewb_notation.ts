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
 * Token grammar accepts the standard prime/double suffixes ('/2).
 */

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
  const m = /^([A-Za-z])(['2]?)$/.exec(tok);
  if (!m) return [tok];
  const ch = m[1];
  const suffix = m[2];

  if (SARAH_MACRO[ch]) {
    const macro = SARAH_MACRO[ch];
    const body = suffix === "'" ? macro.prime : suffix === '2' ? macro.double : macro.plain;
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
