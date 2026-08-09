/**
 * Reconstruction end-state validation shared by the submit UI and the API.
 *
 * The text cleaner intentionally mirrors the reconstruction player: comments,
 * stage markers and cosmetic annotations do not become puzzle moves. Cube
 * notation additionally accepts crowded text such as `ULB2LD'`.
 */
import { canonicalSq1Alg } from './sq1_notation';

export const RECON_COSMETIC_ANNOTATION_CHARS = '.·↑↓⅓⅔​‌‍﻿';

const COSMETIC_ANNOTATION_STRIP_RE = new RegExp(`[${RECON_COSMETIC_ANNOTATION_CHARS}]`, 'g');
const COMMENT_LINE_RE = /^\/\/.*/;
const STRIP_TOKENS = new Set([
  '[regrip]', '[lockup]', '[freePair]', '[free_pair]',
  '[yRot]', '[y_rot]', '[sMove]', '[s_move]',
]);

const SCRAMBLE_PLACEHOLDERS = new Set([
  '?', '??', '???', '-', '--', '.', 'n/a', 'na', 'tbd', 'none', 'unknown',
]);

const EVENT_PUZZLE = {
  '2x2': '2x2x2',
  '3x3': '3x3x3',
  '4x4': '4x4x4',
  '5x5': '5x5x5',
  '6x6': '6x6x6',
  '7x7': '7x7x7',
  '3bld': '3x3x3',
  '4bld': '4x4x4',
  '5bld': '5x5x5',
  oh: '3x3x3',
  fmc: '3x3x3',
  mbld: '3x3x3',
  sq1: 'square1',
  pyra: 'pyraminx',
  mega: 'megaminx',
  clock: 'clock',
  skewb: 'skewb',
} as const;

export type ReconPuzzleKey = (typeof EVENT_PUZZLE)[keyof typeof EVENT_PUZZLE];

export function reconPuzzleKey(event: string): ReconPuzzleKey | null {
  return EVENT_PUZZLE[event as keyof typeof EVENT_PUZZLE] ?? null;
}

export function expandReconGroupRepeats(alg: string): string {
  if (!alg) return alg;
  let expanded = alg;
  let previous: string;
  do {
    previous = expanded;
    expanded = expanded.replace(/\(([^()]*)\)(\d+)/g, (_, body: string, n: string) => {
      return Array(parseInt(n, 10)).fill(body.trim()).join(' ');
    });
  } while (expanded !== previous);
  return expanded;
}

/** Strip reconstruction-only text without rewriting the puzzle's move grammar. */
export function cleanReconAlgText(text: string): string {
  if (!text) return '';
  const cleaned: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (COMMENT_LINE_RE.test(trimmed)) continue;
    const commentIdx = trimmed.indexOf('//');
    const effective = commentIdx >= 0 ? trimmed.slice(0, commentIdx).trim() : trimmed;
    if (!effective) continue;
    const tokens = effective.split(/\s+/).filter((token) => !STRIP_TOKENS.has(token));
    if (tokens.length > 0) cleaned.push(tokens.join(' '));
  }
  return expandReconGroupRepeats(cleaned.join('\n').replace(COSMETIC_ANNOTATION_STRIP_RE, ''));
}

export function cleanReconAlgForPlayer(text: string): string {
  let alg = cleanReconAlgText(text);
  alg = alg.replace(/\(([^)]*)\)(?!\d)/g, '$1');
  alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?2?'?)(?=[RULDFBMESruldfbmesxyz])/g, '$1 ');
  return alg;
}

// One whitespace chunk must consist entirely of cube moves. This keeps compact
// `ULB2LD'` valid while dropping prose labels such as `pl` as a whole instead
// of accidentally extracting the trailing `l` as a move.
const CUBE_MOVE_AT_START = /^(?:(?:[2-9]\d*)?[URFDLB]w?|[MESxyzXYZrufdlb])(?:2'?|')?/;

export function cleanReconCubeStateMoves(text: string): string {
  const out: string[] = [];
  for (const chunk of cleanReconAlgForPlayer(text).split(/\s+/).filter(Boolean)) {
    const moves: string[] = [];
    let rest = chunk;
    while (rest) {
      const match = rest.match(CUBE_MOVE_AT_START);
      if (!match) {
        moves.length = 0;
        break;
      }
      moves.push(match[0].replace(/^([XYZ])/, (rotation) => rotation.toLowerCase()));
      rest = rest.slice(match[0].length);
    }
    out.push(...moves);
  }
  return out.join(' ').replace(/2'/g, '2');
}

export type ReconCompletionResult =
  | { status: 'solved' }
  | { status: 'unsolved' }
  | { status: 'invalid' }
  | { status: 'unchecked' };

const CUBE_ORIENTATIONS = (() => {
  const out: string[] = [];
  for (const tilt of ['', 'x', 'x2', "x'", 'z', "z'"]) {
    for (const spin of ['', 'y', 'y2', "y'"]) {
      out.push([tilt, spin].filter(Boolean).join(' '));
    }
  }
  return out;
})();

function hasRealScramble(scramble: string): boolean {
  const value = scramble.trim().toLowerCase();
  return value.length > 0 && !SCRAMBLE_PLACEHOLDERS.has(value);
}

/** Check whether scramble followed by solution reaches a solved visual state. */
export async function checkReconCompletion(input: {
  event: string;
  scramble: string;
  solution: string;
}): Promise<ReconCompletionResult> {
  const puzzle = reconPuzzleKey(input.event);
  if (!puzzle || !hasRealScramble(input.scramble)) return { status: 'unchecked' };

  const isCube = /^(?:[2-7]x[2-7]x[2-7])$/.test(puzzle);
  const scramble = input.event === 'sq1'
    ? canonicalSq1Alg(input.scramble)
    : isCube ? cleanReconCubeStateMoves(input.scramble)
      : puzzle === 'clock' || puzzle === 'megaminx' ? cleanReconAlgText(input.scramble)
        : cleanReconAlgForPlayer(input.scramble);
  const solution = input.event === 'sq1'
    ? canonicalSq1Alg(input.solution)
    : isCube ? cleanReconCubeStateMoves(input.solution)
      : puzzle === 'clock' || puzzle === 'megaminx' ? cleanReconAlgText(input.solution)
        : cleanReconAlgForPlayer(input.solution);

  let kpuzzle;
  try {
    const { puzzles } = await import('cubing/puzzles');
    kpuzzle = await puzzles[puzzle].kpuzzle();
  } catch {
    // A client chunk/network failure must not masquerade as bad user notation;
    // the API will still run the authoritative check.
    return { status: 'unchecked' };
  }

  let solved;
  let state;
  try {
    solved = kpuzzle.defaultPattern();
    state = solved.applyAlg(`${scramble} ${solution}`.trim().replace(/2'/g, '2'));
  } catch {
    return { status: 'invalid' };
  }

  try {
    if (state.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    })) return { status: 'solved' };
    return { status: 'unsolved' };
  } catch {
    if (state.isIdentical(solved)) return { status: 'solved' };
    if (isCube || puzzle === 'skewb') {
      for (const rotation of CUBE_ORIENTATIONS) {
        if (rotation && state.applyAlg(rotation).isIdentical(solved)) return { status: 'solved' };
      }
    } else if (puzzle === 'megaminx' || puzzle === 'pyraminx') {
      const order = puzzle === 'megaminx' ? 5 : 3;
      let rotated = state;
      for (let i = 1; i < order; i++) {
        rotated = rotated.applyAlg('y');
        if (rotated.isIdentical(solved)) return { status: 'solved' };
      }
    }
    return { status: 'unsolved' };
  }
}
