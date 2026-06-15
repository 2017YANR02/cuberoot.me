/**
 * Square-1 puzzle — TS port of tnoodle-lib `SquareOnePuzzle.java`.
 * Ported from packages/client-vite/src/pages/gen/sq1_svg.ts.
 *
 * The `formatScrambleForEvent` + `canonicalSq1Alg` exports are what the
 * alg subpages (CaseThumb / PuzzleSVG / AlgCategoryPage) consume.
 */

export const SQ1_FACE_KEYS = ['L', 'B', 'R', 'F', 'U', 'D'] as const;
export type Sq1FaceKey = typeof SQ1_FACE_KEYS[number];

export const DEFAULT_SQ1_COLORS: Record<Sq1FaceKey, string> = {
  L: '#0000FF',
  B: '#FF8000',
  R: '#00FF00',
  F: '#FF0000',
  U: '#FFFF00',
  D: '#FFFFFF',
};

export interface Sq1State {
  sliceSolved: boolean;
  pieces: number[];
}

const SOLVED_PIECES: number[] = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
  8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
];

export const SQ1_TOKEN_RE = /(\/)|\(?\s*(-?\d+)\s*(?:,\s*|\s+|(?=-?\d))(-?\d+)\s*\)?|\(?\s*(-?\d+)\s*\)?/g;

export type Sq1Token =
  | { kind: 'slice' }
  | { kind: 'turn'; top: number; bot: number };

export function parseSq1Tokens(alg: string): Sq1Token[] {
  // Strip `// …` line comments first so they don't parse as two `/` slices.
  const cleaned = alg.replace(/\/\/[^\n]*/g, ' ');
  const out: Sq1Token[] = [];
  const re = new RegExp(SQ1_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m[1] === '/') out.push({ kind: 'slice' });
    else if (m[2] !== undefined) out.push({ kind: 'turn', top: parseInt(m[2], 10), bot: parseInt(m[3]!, 10) });
    else out.push({ kind: 'turn', top: parseInt(m[4]!, 10), bot: 0 });
  }
  return out;
}

export function invertSq1Alg(alg: string): string {
  return parseSq1Tokens(alg).reverse().map((tok) =>
    tok.kind === 'slice' ? '/' : `(${-tok.top},${-tok.bot})`,
  ).join('');
}

export function canonicalSq1Alg(alg: string): string {
  return parseSq1Tokens(alg).map((tok) =>
    tok.kind === 'slice' ? '/' : `(${tok.top}, ${tok.bot})`,
  ).join(' ');
}

export function compactSq1Alg(alg: string): string {
  const toks = parseSq1Tokens(alg);
  return toks.map((tok, i) => {
    if (tok.kind === 'slice') return '/';
    const prev = toks[i - 1];
    const next = toks[i + 1];
    const leftBound = !prev || prev.kind === 'slice';
    const rightBound = !next || next.kind === 'slice';
    if (tok.bot === 0 && leftBound && rightBound) return `${tok.top}`;
    return `${tok.top}${tok.bot}`;
  }).join('');
}

/** Normalize a layer-turn amount to (-6, 6] (mod 12; 12 units = a full turn). */
function normSq1Turn(x: number): number {
  let v = ((x % 12) + 12) % 12;
  if (v > 6) v -= 12;
  return v;
}

/**
 * Cancel redundant Square-1 moves ("消步"): two adjacent slices annihilate, and
 * consecutive layer turns (no slice between) merge per layer mod 12, dropping
 * any that reduce to (0, 0). `// comments` are stripped (parseSq1Tokens drops
 * them), so e.g. `(0,-6) (0,6)//` collapses to the empty string.
 */
export function simplifySq1Alg(alg: string, format: 'compact' | 'wca' = 'compact'): string {
  const stack: Sq1Token[] = [];
  for (const tok of parseSq1Tokens(alg)) {
    const top = stack[stack.length - 1];
    if (tok.kind === 'slice') {
      if (top && top.kind === 'slice') stack.pop();
      else stack.push(tok);
    } else if (top && top.kind === 'turn') {
      const t = normSq1Turn(top.top + tok.top);
      const b = normSq1Turn(top.bot + tok.bot);
      if (t === 0 && b === 0) stack.pop();
      else stack[stack.length - 1] = { kind: 'turn', top: t, bot: b };
    } else {
      const t = normSq1Turn(tok.top);
      const b = normSq1Turn(tok.bot);
      if (t !== 0 || b !== 0) stack.push({ kind: 'turn', top: t, bot: b });
    }
  }
  const canonical = stack.map((tok) =>
    tok.kind === 'slice' ? '/' : `(${tok.top}, ${tok.bot})`,
  ).join(' ');
  return format === 'wca' ? canonicalSq1Alg(canonical) : compactSq1Alg(canonical);
}

export function formatScrambleForEvent(event: string, scramble: string): string {
  return event === 'sq1' ? compactSq1Alg(scramble) : scramble;
}

export function applySq1Scramble(scramble: string): Sq1State {
  let pieces = SOLVED_PIECES.slice();
  let sliceSolved = true;
  for (const tok of parseSq1Tokens(scramble)) {
    if (tok.kind === 'slice') {
      const next = pieces.slice();
      for (let i = 0; i < 6; i++) {
        const c = next[i + 12];
        next[i + 12] = next[i + 6];
        next[i + 6] = c;
      }
      pieces = next;
      sliceSolved = !sliceSolved;
    } else {
      const t = ((-tok.top % 12) + 12) % 12;
      const b = ((-tok.bot % 12) + 12) % 12;
      const next = pieces.slice();
      const oldTop = pieces.slice(0, 12);
      for (let i = 0; i < 12; i++) next[i] = oldTop[(t + i) % 12];
      const oldBot = pieces.slice(12, 24);
      for (let i = 0; i < 12; i++) next[i + 12] = oldBot[(b + i) % 12];
      pieces = next;
    }
  }
  return { pieces, sliceSolved };
}
