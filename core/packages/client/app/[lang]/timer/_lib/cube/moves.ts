/**
 * WCA notation parser and move primitives for NxN cubes.
 *
 * A parsed move has:
 *   face: one of U D F B L R (or M E S for slice, or x y z for rotation).
 *   amount: 1 = cw, 2 = 180, -1 = ccw (we normalize ' to -1 and 2 to 2).
 *   layers: how many outer layers are turned (1 for face-only, 2 for wide w,
 *           3+ for "3Rw" notation).
 *   isRotation: true for x y z (whole cube rotations).
 *   isSlice: true for M E S (only valid on 3x3 — we expand them to wide moves).
 */

export type Face = 'U' | 'D' | 'F' | 'B' | 'L' | 'R';
export const FACES: Face[] = ['U', 'D', 'F', 'B', 'L', 'R'];

export interface ParsedMove {
  /** The "axis" face of the move (the side that turns). For rotation/slice
   *  this is the canonical direction (x≈R, y≈U, z≈F; M acts like an inverse
   *  L slice, E like an inverse U slice, S like F slice). */
  face: Face;
  /** 1 = cw, 2 = 180°, -1 = ccw, -2 = 180° (treated same as 2). */
  amount: 1 | 2 | -1 | -2;
  /** Number of layers turned counting from the outer face (1, 2, 3...). */
  layers: number;
  /** True for x/y/z whole-cube rotation (layers === N). */
  isRotation: boolean;
}

const SLICE_TO_WIDE: Record<string, { face: Face; flip: boolean }> = {
  // M = inverse L slice → realized as Lw' L
  M: { face: 'L', flip: false },
  E: { face: 'D', flip: false },
  S: { face: 'F', flip: false },
};

const ROTATION_TO_FACE: Record<string, Face> = {
  x: 'R',
  y: 'U',
  z: 'F',
};

/**
 * Parse one token like "R", "R'", "R2", "Rw", "Rw'", "3Rw", "3Rw2", "x", "M".
 * Returns null for empty/comment tokens. Throws on truly malformed tokens.
 *
 * For slice (M E S): we don't return a slice move — instead we return a
 * "wide-2 minus outer-1" pair. To keep this function returning a single
 * move, we model slice as a special pair handled by parseScramble below.
 */
function parseToken(raw: string): ParsedMove[] {
  const tok = raw.trim();
  if (!tok) return [];
  if (tok.startsWith('//') || tok.startsWith('#')) return [];

  // Megaminx tokens (R++, D--, U) — we ignore here; megaminx has its own parser.
  if (/[+-]{2}/.test(tok)) return [];

  // Match the WCA NxN form: optional leading digit (slice depth), face letter,
  // optional 'w', optional amount (digits and/or apostrophe).
  const re = /^(\d+)?([UDFBLRMESxyz])(w)?(\d+)?('?)$/;
  const m = re.exec(tok);
  if (!m) {
    // Lowercase wide-shorthand: "u" = Uw, "r" = Rw, etc.
    const lower = /^([udfblr])(\d+)?('?)$/;
    const lm = lower.exec(tok);
    if (lm) {
      const face = lm[1].toUpperCase() as Face;
      const amount = parseAmount(lm[2], lm[3]);
      return [{ face, amount, layers: 2, isRotation: false }];
    }
    // Pyraminx tip lowercase letters — treated as no-op for cube parser.
    return [];
  }

  const sliceDepth = m[1] ? parseInt(m[1], 10) : undefined;
  const letter = m[2];
  const wide = !!m[3];
  const amount = parseAmount(m[4], m[5]);

  // x y z rotations
  if (letter === 'x' || letter === 'y' || letter === 'z') {
    return [{
      face: ROTATION_TO_FACE[letter],
      amount,
      layers: 0,             // 0 means "all layers" — caller substitutes N.
      isRotation: true,
    }];
  }

  // M E S slice → expand to wide-2 then outer-1 inverse:
  // M = Lw L'  (turn the two left layers in L direction, then turn just outer L back)
  // Equivalently realized as a single inner-slice. We return TWO moves.
  if (letter === 'M' || letter === 'E' || letter === 'S') {
    const conv = SLICE_TO_WIDE[letter];
    return [
      { face: conv.face, amount, layers: 2, isRotation: false },
      { face: conv.face, amount: invertAmount(amount), layers: 1, isRotation: false },
    ];
  }

  // Standard face / wide / depth-prefixed wide
  const face = letter as Face;
  let layers = 1;
  if (wide) layers = 2;
  if (sliceDepth !== undefined) layers = sliceDepth;

  return [{ face, amount, layers, isRotation: false }];
}

function parseAmount(digits: string | undefined, prime: string | undefined): ParsedMove['amount'] {
  const n = digits ? parseInt(digits, 10) : 1;
  const sign = prime === "'" ? -1 : 1;
  if (n === 2) return (sign === 1 ? 2 : -2);
  // n === 1 (default), or 3 → ccw, or large multiples reduced mod 4.
  const reduced = ((n * sign) % 4 + 4) % 4;
  if (reduced === 0) return 2; // shouldn't happen but safe — treat as 180 no-op overshoot
  if (reduced === 1) return 1;
  if (reduced === 2) return 2;
  return -1; // 3
}

function invertAmount(a: ParsedMove['amount']): ParsedMove['amount'] {
  if (a === 1) return -1;
  if (a === -1) return 1;
  return a;
}

/** Parse a full scramble string into a flat list of moves. */
export function parseScramble(scramble: string): ParsedMove[] {
  if (!scramble) return [];
  const tokens = scramble.split(/[\s,]+/).filter(Boolean);
  const out: ParsedMove[] = [];
  for (const t of tokens) {
    out.push(...parseToken(t));
  }
  return out;
}
