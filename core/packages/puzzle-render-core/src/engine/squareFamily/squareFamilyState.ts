/**
 * Discrete state and notation for the equal-sector Square family used by
 * Square-2 and the ordinary pCubes Square-4. Unlike Square-1, every layer
 * sector has the same width, so a slash is valid after every outer turn.
 */
export type SquareFamilyKind = 'sq2' | 'sq4';

export interface SquareFamilySpec {
  kind: SquareFamilyKind;
  /** Number of equal sectors in one outer layer. */
  slotsPerLayer: 12 | 20;
  /** One notation unit in radians. */
  unitRadians: number;
  /** Horizontal angle of the slash rotation axis. */
  sliceAxisAngle: number;
  /** Random-move tuple count used by the simulator. */
  scrambleLength: number;
}

export const SQUARE_FAMILY_SPECS: Readonly<Record<SquareFamilyKind, SquareFamilySpec>> = {
  sq2: {
    kind: 'sq2',
    slotsPerLayer: 12,
    unitRadians: Math.PI / 6,
    sliceAxisAngle: Math.PI / 12,
    scrambleLength: 10,
  },
  sq4: {
    kind: 'sq4',
    slotsPerLayer: 20,
    unitRadians: Math.PI / 10,
    sliceAxisAngle: Math.PI / 20,
    scrambleLength: 20,
  },
};

export type SquareFamilyMove =
  | { kind: 'slice' }
  | { kind: 'turn'; top: number; bot: number };

export type SquareFamilyNotationFormat = 'compact' | 'wca';

export interface SquareFamilyState {
  /** Piece identity at each top slot, then each bottom slot. */
  pieces: number[];
  /** The two middle halves have their solved relative orientation. */
  sliceSolved: boolean;
}

export function solvedSquareFamily(spec: SquareFamilySpec): SquareFamilyState {
  return {
    pieces: Array.from({ length: spec.slotsPerLayer * 2 }, (_, i) => i),
    sliceSolved: true,
  };
}

/** Canonical representative in (-n/2, n/2], matching SQ1's [-5, 6]. */
export function normalizeSquareUnits(units: number, spec: SquareFamilySpec): number {
  if (!Number.isSafeInteger(units)) return 0;
  const n = spec.slotsPerLayer;
  const half = n / 2;
  let value = units % n;
  if (value <= -half) value += n;
  if (value > half) value -= n;
  return value;
}

export function isFiniteSquareMove(move: SquareFamilyMove): boolean {
  return move.kind === 'slice'
    || (Number.isSafeInteger(move.top) && Number.isSafeInteger(move.bot));
}

const SQUARE_FAMILY_TOKEN_SOURCE = String.raw`\s*(?:\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*\)|(\/))`;

/**
 * Strictly parse explicit `(u,d)` and `/` moves. Returning null instead of a
 * partial prefix keeps malformed input from moving the puzzle to a surprising
 * state (notably, bare `10` must never mean `(1,0)` on Square-4).
 */
export function tryParseSquareFamilyMoves(
  text: string,
  spec: SquareFamilySpec,
): SquareFamilyMove[] | null {
  const cleaned = text.replace(/\/\/[^\n]*/g, ' ');
  const tokenRe = new RegExp(SQUARE_FAMILY_TOKEN_SOURCE, 'y');
  const moves: SquareFamilyMove[] = [];
  let index = 0;

  while (index < cleaned.length) {
    tokenRe.lastIndex = index;
    const match = tokenRe.exec(cleaned);
    if (!match) return cleaned.slice(index).trim() ? null : moves;
    index = tokenRe.lastIndex;

    if (match[3]) {
      moves.push({ kind: 'slice' });
      continue;
    }
    const top = Number(match[1]);
    const bot = Number(match[2]);
    if (!Number.isSafeInteger(top) || !Number.isSafeInteger(bot)) return null;
    moves.push({
      kind: 'turn',
      top: normalizeSquareUnits(top, spec),
      bot: normalizeSquareUnits(bot, spec),
    });
  }
  return moves;
}

export function parseSquareFamilyMoves(text: string, spec: SquareFamilySpec): SquareFamilyMove[] {
  return tryParseSquareFamilyMoves(text, spec) ?? [];
}

export function squareFamilyMoveToString(move: SquareFamilyMove): string {
  return move.kind === 'slice' ? '/' : `(${move.top},${move.bot})`;
}

export function squareFamilyMovesToString(moves: readonly SquareFamilyMove[]): string {
  return moves.map(squareFamilyMoveToString).join(' ');
}

/**
 * Format equal-sector Square notation without borrowing SQ1's ambiguous
 * digit shorthand. Compact mode only removes safe whitespace: tuples keep
 * their parentheses and comma so Square-4 values such as 10 stay explicit.
 */
export function formatSquareFamilyMoves(
  moves: readonly SquareFamilyMove[],
  format: SquareFamilyNotationFormat,
): string {
  if (format === 'wca') {
    return moves.map((move) => (
      move.kind === 'slice' ? '/' : `(${move.top}, ${move.bot})`
    )).join(' ');
  }

  let text = '';
  for (let index = 0; index < moves.length; index++) {
    const move = moves[index];
    const previous = moves[index - 1];
    // Never emit `//`: the parser correctly treats it as a line comment.
    if (move.kind === 'slice' && previous?.kind === 'slice') text += ' ';
    text += squareFamilyMoveToString(move);
  }
  return text;
}

export function formatSquareFamilyAlg(
  text: string,
  spec: SquareFamilySpec,
  format: SquareFamilyNotationFormat,
): string {
  const parsed = tryParseSquareFamilyMoves(text, spec);
  return parsed ? formatSquareFamilyMoves(parsed, format) : text;
}

export function invertSquareFamilyMoves(
  moves: readonly SquareFamilyMove[],
  spec?: SquareFamilySpec,
): SquareFamilyMove[] {
  return moves.slice().reverse().map((move): SquareFamilyMove => {
    if (move.kind === 'slice') return move;
    const top = -move.top;
    const bot = -move.bot;
    return {
      kind: 'turn',
      top: spec ? normalizeSquareUnits(top, spec) : top,
      bot: spec ? normalizeSquareUnits(bot, spec) : bot,
    };
  });
}

function rotateLayer(layer: readonly number[], units: number): number[] {
  const n = layer.length;
  // Slot numbering follows the rendered sector positions: a positive notation
  // turn moves the piece at slot `units` into slot 0. Keep this sign aligned
  // with SquareFamilyCube's physical top/bottom rotations; the SQ1 engine has
  // a different shape-aware slot convention and intentionally stays separate.
  const shift = ((units % n) + n) % n;
  return layer.map((_, slot) => layer[(slot + shift) % n]);
}

export function applySquareFamilyMove(
  state: SquareFamilyState,
  rawMove: SquareFamilyMove,
  spec: SquareFamilySpec,
): SquareFamilyState {
  if (!isFiniteSquareMove(rawMove)) return state;
  const n = spec.slotsPerLayer;
  const half = n / 2;
  const pieces = state.pieces.slice();
  if (pieces.length !== n * 2) return state;

  if (rawMove.kind === 'turn') {
    const top = rotateLayer(pieces.slice(0, n), normalizeSquareUnits(rawMove.top, spec));
    const bottom = rotateLayer(pieces.slice(n), normalizeSquareUnits(rawMove.bot, spec));
    return { pieces: [...top, ...bottom], sliceSolved: state.sliceSolved };
  }

  // The positive half-space contains top slots n/2..n-1 and bottom slots 0..n/2-1.
  // Top indices run clockwise while bottom indices run counter-clockwise, so the
  // geometric reflection preserves the half-layer index while exchanging layers.
  const topEast = pieces.slice(half, n);
  const bottomEast = pieces.slice(n, n + half);
  for (let i = 0; i < half; i++) {
    pieces[half + i] = bottomEast[i];
    pieces[n + i] = topEast[i];
  }
  return { pieces, sliceSolved: !state.sliceSolved };
}

export function squareFamilyComplete(state: SquareFamilyState, spec: SquareFamilySpec): boolean {
  if (!state.sliceSolved || state.pieces.length !== spec.slotsPerLayer * 2) return false;
  return state.pieces.every((piece, slot) => piece === slot);
}

export function simplifySquareFamilyAlg(
  text: string,
  spec: SquareFamilySpec,
  format?: SquareFamilyNotationFormat,
): string {
  const parsed = tryParseSquareFamilyMoves(text, spec);
  if (!parsed) return text;
  const out: SquareFamilyMove[] = [];
  for (const move of parsed) {
    if (move.kind === 'slice') {
      if (out[out.length - 1]?.kind === 'slice') out.pop();
      else out.push(move);
      continue;
    }
    const top = normalizeSquareUnits(move.top, spec);
    const bot = normalizeSquareUnits(move.bot, spec);
    if (top === 0 && bot === 0) continue;
    const prev = out[out.length - 1];
    if (prev?.kind === 'turn') {
      prev.top = normalizeSquareUnits(prev.top + top, spec);
      prev.bot = normalizeSquareUnits(prev.bot + bot, spec);
      if (prev.top === 0 && prev.bot === 0) out.pop();
    } else {
      out.push({ kind: 'turn', top, bot });
    }
  }
  return format ? formatSquareFamilyMoves(out, format) : squareFamilyMovesToString(out);
}

export function randomSquareFamilyScramble(
  spec: SquareFamilySpec,
  random: () => number = Math.random,
): string {
  const half = spec.slotsPerLayer / 2;
  const moves: SquareFamilyMove[] = [];
  for (let i = 0; i < spec.scrambleLength; i++) {
    let top = 0;
    let bot = 0;
    while (top === 0 && bot === 0) {
      top = Math.floor(random() * spec.slotsPerLayer) - half + 1;
      bot = Math.floor(random() * spec.slotsPerLayer) - half + 1;
    }
    moves.push({ kind: 'turn', top, bot }, { kind: 'slice' });
  }
  return squareFamilyMovesToString(moves);
}
