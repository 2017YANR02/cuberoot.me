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
 * WCA / cubing.js notation (as the cubing.js skewb notation mapper resolves):
 *   F = UFR, U = ULB, L = DLF, R = DRB, B = DLB, D = DFR (6 corners directly)
 *   ULF and URB have no dedicated single letter — express via conjugates of F.
 *
 * Resolved direct mapping:
 *   Sarah F → F        (UFR ≡ UFR)
 *   Sarah B → U        (ULB ≡ ULB)
 *   Sarah r → R        (DRB ≡ DRB)
 *   Sarah l → L        (DLF ≡ DLF)
 *   Sarah b → B        (DLB ≡ DLB)
 *   Sarah d/f → D      (DFR ≡ DFR)
 *
 * Conjugated mapping (verified empirically against cubing.js, see comments):
 *   Sarah L (ULF) → y' F y
 *   Sarah R (URB) → y  F y'
 *
 * Macro expansion (per Sarah's PDF):
 *   S  → F' L F L'
 *   S' → L F' L' F   (= H)
 *   H  → L F' L' F
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
};

// Conjugate: Sarah_X = [pre] F [post]. X' = [pre] F' [post]. X2 = [pre] F2 [post].
const SARAH_CONJUGATE: Record<string, { pre: string; mid: string; post: string }> = {
  L: { pre: "y'", mid: 'F', post: 'y' },
  R: { pre: 'y',  mid: 'F', post: "y'" },
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

  if (SARAH_CONJUGATE[ch]) {
    const { pre, mid, post } = SARAH_CONJUGATE[ch];
    const midOut = suffix === "'" ? mid + "'" : suffix === '2' ? mid + '2' : mid;
    return [pre, midOut, post];
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
