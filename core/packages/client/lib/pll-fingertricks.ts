// Shared move parsing for CubeShorthand and the paint canvas. No DOM or 3D dependencies.

const DECORATORS = /[·↑↓←→]/g;
/** Grouping brackets some DB algs wrap around triggers — not real moves. */
const BRACKETS = /[()[\]]/g;

/** Strip notation decorators and grouping brackets before splitting move tokens. */
export function tokenizeAlg(alg: string): string[] {
  return alg
    .replace(DECORATORS, ' ')
    .replace(BRACKETS, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export type MoveFamily =
  | 'R'
  | 'L'
  | 'U'
  | 'F'
  | 'B'
  | 'D'
  | 'M' // M/E/S middle slices
  | 'wide' // Rw/Uw/Lw/... any wide turn
  | 'x'
  | 'y'
  | 'z';

/** Parsed view of a token: family + modifiers (matches TwistAction semantics). */
export interface ParsedMove {
  /** Original token (decorators already stripped). */
  token: string;
  /** Base move family. */
  family: MoveFamily;
  /** Base face, slice, or rotation letter. */
  base: string;
  /** true = prime (`'`). */
  reverse: boolean;
  /** Turn count. */
  times: number;
  /** true = wide (Rw / r / Uw …). */
  wide: boolean;
}

/**
 * Classify a single move token into its base family + modifiers. Self-contained
 * (does NOT import the THREE-dependent TwistAction) but applies the SAME notation
 * rules: trailing `'`, trailing digit count, `w`/lowercase = wide.
 */
export function parseMove(token: string): ParsedMove | null {
  const t = token.trim();
  if (!t) return null;
  const m = t.match(/^([0-9]*)([bsfdeulmrxyzBSFDEULMRXYZ])(w?)('?)(\d*)('?)$/);
  if (!m) return null;
  const letter = m[2];
  const isWideMark = m[3] === 'w';
  // Lowercase face letter (r/u/f/l/d/b) is also a wide turn in SiGN-ish notation,
  // but lowercase x/y/z are whole-cube rotations (NOT wide).
  const lower = letter.toLowerCase();
  const isRotation = lower === 'x' || lower === 'y' || lower === 'z';
  const isSliceM = lower === 'm' || lower === 'e' || lower === 's';
  const lowerFaceWide = !isRotation && !isSliceM && letter === lower;
  const wide = isWideMark || lowerFaceWide;

  const reverse = (m[4] + m[6]).length === 1;
  const times = m[5].length === 0 ? 1 : parseInt(m[5], 10);

  const base = isRotation ? lower : letter.toUpperCase();

  let family: MoveFamily;
  if (isRotation) family = lower as MoveFamily; // x | y | z
  else if (wide) family = 'wide';
  else if (isSliceM) family = 'M'; // M/E/S share one slice family
  else family = base as MoveFamily; // R | L | U | F | B | D

  return { token: t, family, base, reverse, times, wide };
}
