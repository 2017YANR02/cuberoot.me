/**
 * Reconstruction end-state validation shared by the submit UI and the API.
 *
 * The text cleaner intentionally mirrors the reconstruction player: comments,
 * stage markers and cosmetic annotations do not become puzzle moves. Cube
 * notation additionally accepts crowded text such as `ULB2LD'`.
 */
import { MOVE_RE } from './alg_notation';
import { isFtoEifSolved, parseFtoEifAlgorithm } from './fto_notation';
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
  '3x3 robot': '3x3x3',
  '3x3 smart': '3x3x3',
  mirror: '3x3x3',
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
  pyraminx: 'pyraminx',
  mega: 'megaminx',
  clock: 'clock',
  skewb: 'skewb',
  fto: 'fto',
} as const;

export type ReconPuzzleKey = (typeof EVENT_PUZZLE)[keyof typeof EVENT_PUZZLE];

export function reconPuzzleKey(event: string): ReconPuzzleKey | null {
  return EVENT_PUZZLE[event.trim().toLowerCase() as keyof typeof EVENT_PUZZLE] ?? null;
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

// People sometimes type the prime before a numeric turn amount (`U'2`,
// `R'3`). cubing.js only accepts the canonical amount-then-prime order (`U2'`,
// `R3'`). Keep comments byte-identical so examples and stage labels are not
// rewritten as moves.
const PRIME_BEFORE_AMOUNT_RE = /((?:\d+(?:-\d+)?)?[RLUDFBMSExyzXYZrludfbmse]w?\d*)'(\d+)/g;

export function normalizeReconMoveSuffixOrder(text: string): string {
  if (!text) return text;
  return text.split(/\r?\n/).map((line) => {
    const commentIdx = line.indexOf('//');
    const moves = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';
    return moves.replace(PRIME_BEFORE_AMOUNT_RE, "$1$2'") + comment;
  }).join('\n');
}

/** Strip reconstruction-only text without rewriting the puzzle's move grammar. */
export function cleanReconAlgText(text: string): string {
  if (!text) return '';
  const cleaned: string[] = [];
  for (const line of normalizeReconMoveSuffixOrder(text).split(/\r?\n/)) {
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
  alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?\d*'?)(?=[RULDFBMESruldfbmesxyz])/g, '$1 ');
  return alg;
}

/** FTO keeps multi-letter EIF roots intact, so only remove recon grouping syntax. */
export function cleanFtoReconAlgForPlayer(text: string): string {
  return cleanReconAlgText(text).replace(/\(([^)]*)\)(?!\d)/g, '$1');
}

// One whitespace chunk must consist entirely of cube moves. This keeps compact
// `ULB2LD'` valid while dropping prose labels such as `pl` as a whole instead
// of accidentally extracting the trailing `l` as a move.
const UPPERCASE_ROTATION_AT_START = /^([XYZ])(\d*)('?)/;

function splitCubeMoveChunk(chunk: string): string[] | null {
  const moves: string[] = [];
  let rest = chunk;
  while (rest) {
    const match = MOVE_RE.exec(rest) ?? UPPERCASE_ROTATION_AT_START.exec(rest);
    if (!match) return null;
    moves.push(match[0]);
    rest = rest.slice(match[0].length);
  }
  return moves;
}

/**
 * Add one space between compact cube moves without deleting unknown text.
 * `ULB2LD'` becomes `U L B2 L D'`; an unrecognised chunk stays byte-identical.
 */
export function spaceReconCubeMoves(text: string): string {
  return text.split(/\r?\n/).map((line) => {
    const commentIdx = line.indexOf('//');
    const movePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    const comment = commentIdx >= 0 ? line.slice(commentIdx).trim() : '';
    const spaced = movePart.trim().split(/\s+/).filter(Boolean)
      .flatMap((chunk) => splitCubeMoveChunk(chunk) ?? [chunk])
      .join(' ');
    return [spaced, comment].filter(Boolean).join(' ');
  }).join('\n').trim();
}

function normalizeReconCommentSpacing(line: string): string {
  const commentIdx = line.indexOf('//');
  if (commentIdx < 0) return line;
  const moves = line.slice(0, commentIdx).replace(/[ \t]+$/, '');
  const comment = line.slice(commentIdx + 2).replace(/^[ \t]+/, '');
  return moves === '' ? `// ${comment}` : `${moves} // ${comment}`;
}

/**
 * Canonicalise persisted reconstruction text. A standalone AUF stage belongs
 * to the preceding algorithm stage, so append its moves before that stage's
 * comment instead of storing a separate `// AUF` line.
 */
export function normalizeReconSolution(text: string): string {
  const normalized: string[] = [];

  for (const rawLine of normalizeReconMoveSuffixOrder(text).split(/\r?\n/)) {
    const line = normalizeReconCommentSpacing(rawLine);
    const commentIdx = line.indexOf('//');
    const moves = commentIdx >= 0 ? line.slice(0, commentIdx).trim() : '';
    const comment = commentIdx >= 0 ? line.slice(commentIdx + 2).trim() : '';

    if (moves && /^AUF$/i.test(comment)) {
      let previousIdx = normalized.length - 1;
      while (previousIdx >= 0 && normalized[previousIdx].trim() === '') previousIdx -= 1;

      if (previousIdx >= 0) {
        const previous = normalized[previousIdx];
        const previousCommentIdx = previous.indexOf('//');
        if (previousCommentIdx >= 0) {
          const previousMoves = previous.slice(0, previousCommentIdx).trim();
          const previousComment = previous.slice(previousCommentIdx + 2).trim();
          if (previousMoves) {
            normalized[previousIdx] = previousComment
              ? `${previousMoves} ${moves} // ${previousComment}`
              : `${previousMoves} ${moves} //`;
            continue;
          }
        }
      }
    }

    normalized.push(line);
  }

  return normalized.join('\n');
}

/** Normalize submit-form scramble spacing for puzzles whose moves use cube-like tokens. */
export function normalizeReconScrambleSpacing(event: string, text: string): string {
  const puzzle = reconPuzzleKey(event);
  if (!puzzle || !text) return text.trim();
  if (/^[2-7]x[2-7]x[2-7]$/.test(puzzle) || puzzle === 'skewb' || puzzle === 'pyraminx') {
    return spaceReconCubeMoves(text);
  }
  return text.trim();
}

export interface ReconScrambleFields {
  optimalScramble?: string | null;
  wcaScramble?: string | null;
  scramble?: string | null;
}

/** Pick the scramble that defines the reconstruction state. */
export function getReconScramble(fields: ReconScrambleFields): string {
  return fields.optimalScramble || fields.wcaScramble || fields.scramble || '';
}

export function cleanReconCubeStateMoves(text: string): string {
  const out: string[] = [];
  for (const chunk of cleanReconAlgForPlayer(text).split(/\s+/).filter(Boolean)) {
    const moves = splitCubeMoveChunk(chunk);
    if (moves) out.push(...moves.map((move) => move.replace(/^([XYZ])/, (rotation) => rotation.toLowerCase())));
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

const PYRAMINX_ORIENTATIONS = ['', 'y', 'y2', 'Lv', 'Lv y', 'Lv y2', "Lv'", "Lv' y", "Lv' y2", 'Rv', 'Rv y', 'Rv y2'];

function hasRealScramble(scramble: string): boolean {
  const value = scramble.trim().toLowerCase();
  return value.length > 0 && !SCRAMBLE_PLACEHOLDERS.has(value);
}

const PYRA_VERTICES = ['U', 'L', 'R', 'B'] as const;
const PYRA_ROT_SIGMA: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 2, 3, 1], [3, 1, 0, 2], [1, 3, 2, 0], [2, 0, 1, 3],
];
const PYRA_ROT_VERTEX: Record<string, number> = { y: 0, Uv: 0, Lv: 1, Rv: 2, Bv: 3, z: 3 };

function rotatePyraLetterMap(map: ReadonlyArray<number>, axis: number, dir: 1 | -1): number[] {
  const sigma = PYRA_ROT_SIGMA[axis];
  const inverse = dir === 1 ? -1 : 1;
  return map.map((physical) => inverse === 1 ? sigma[physical] : sigma[sigma[physical]]);
}

/** Fold site Pyraminx re-holds into subsequent world-fixed move letters. */
function cleanReconPyraminxMoves(text: string): string {
  let letterToPhysical: ReadonlyArray<number> = [0, 1, 2, 3];
  const out: string[] = [];
  for (const token of cleanReconAlgForPlayer(text).split(/\s+/).filter(Boolean)) {
    const rotation = /^(y|Uv|Lv|Rv|Bv|z)(')?$/.exec(token);
    if (rotation) {
      const bareDir = rotation[1] === 'z' ? 1 : -1;
      const dir = (rotation[2] ? -bareDir : bareDir) as 1 | -1;
      const physicalAxis = letterToPhysical[PYRA_ROT_VERTEX[rotation[1]]];
      letterToPhysical = rotatePyraLetterMap(letterToPhysical, physicalAxis, dir);
      continue;
    }
    const move = /^([ULRBulrb])(')?$/.exec(token);
    if (!move) continue;
    const logical = PYRA_VERTICES.indexOf(move[1].toUpperCase() as typeof PYRA_VERTICES[number]);
    const physical = letterToPhysical[logical];
    const letter = move[1] === move[1].toLowerCase()
      ? PYRA_VERTICES[physical].toLowerCase()
      : PYRA_VERTICES[physical];
    out.push(letter + (move[2] ?? ''));
  }
  return out.join(' ');
}

const SKEWB_TOKENS = ['F', 'UL', 'UR', 'U', 'D', 'L', 'R', 'B'] as const;
const SKEWB_ROT_GRIP: ReadonlyArray<ReadonlyArray<number>> = [
  [4, 5, 0, 1, 6, 7, 2, 3],
  [2, 0, 3, 1, 6, 4, 7, 5],
  [1, 5, 3, 7, 0, 4, 2, 6],
];

function rotateSkewbGripMap(map: ReadonlyArray<number>, axis: number, suffix: string): number[] {
  const turns = suffix === '2' ? 2 : suffix === "'" ? 3 : 1;
  let next = map.slice();
  for (let i = 0; i < turns; i++) {
    const previous = next;
    next = previous.map((_, logical) => previous[SKEWB_ROT_GRIP[axis][logical]]);
  }
  return next;
}

/** Fold x/y/z re-holds into subsequent Skewb grip letters. */
function cleanReconSkewbMoves(text: string): string {
  let gripToPhysical: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6, 7];
  const out: string[] = [];
  for (const token of cleanReconAlgText(text).split(/\s+/).filter(Boolean)) {
    const rotation = /^([xyz])(['2]?)$/.exec(token);
    if (rotation) {
      gripToPhysical = rotateSkewbGripMap(gripToPhysical, 'xyz'.indexOf(rotation[1]), rotation[2]);
      continue;
    }
    const move = /^(UL|UR|U|F|D|L|R|B)('?)$/.exec(token);
    if (!move) continue;
    const logical = SKEWB_TOKENS.indexOf(move[1] as typeof SKEWB_TOKENS[number]);
    out.push(SKEWB_TOKENS[gripToPhysical[logical]] + move[2]);
  }
  return out.join(' ');
}

/** Check whether scramble followed by solution reaches a solved visual state. */
export async function checkReconCompletion(input: {
  event: string;
  scramble: string;
  solution: string;
}): Promise<ReconCompletionResult> {
  const puzzle = reconPuzzleKey(input.event);
  if (!puzzle || !hasRealScramble(input.scramble)) return { status: 'unchecked' };

  if (puzzle === 'fto') {
    const scramble = cleanFtoReconAlgForPlayer(input.scramble);
    const solution = cleanFtoReconAlgForPlayer(input.solution);
    const parsedScramble = parseFtoEifAlgorithm(scramble);
    const parsedSolution = parseFtoEifAlgorithm(solution);
    if (parsedScramble.invalid.length > 0 || parsedSolution.invalid.length > 0) {
      return { status: 'invalid' };
    }
    return isFtoEifSolved(`${parsedScramble.tokens.join(' ')} ${parsedSolution.tokens.join(' ')}`.trim())
      ? { status: 'solved' }
      : { status: 'unsolved' };
  }

  const isCube = /^(?:[2-7]x[2-7]x[2-7])$/.test(puzzle);
  const scramble = puzzle === 'square1'
    ? canonicalSq1Alg(input.scramble)
    : isCube ? cleanReconCubeStateMoves(input.scramble)
      : puzzle === 'clock' || puzzle === 'megaminx' ? cleanReconAlgText(input.scramble)
        : cleanReconAlgForPlayer(input.scramble);
  const solution = puzzle === 'square1'
    ? canonicalSq1Alg(input.solution)
    : isCube ? cleanReconCubeStateMoves(input.solution)
      : puzzle === 'clock' || puzzle === 'megaminx' ? cleanReconAlgText(input.solution)
        : cleanReconAlgForPlayer(input.solution);

  const stateScramble = puzzle === 'pyraminx' ? cleanReconPyraminxMoves(input.scramble)
    : puzzle === 'skewb' ? cleanReconSkewbMoves(input.scramble)
      : scramble;
  const stateSolution = puzzle === 'pyraminx' ? cleanReconPyraminxMoves(input.solution)
    : puzzle === 'skewb' ? cleanReconSkewbMoves(input.solution)
      : solution;

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
    state = solved.applyAlg(`${stateScramble} ${stateSolution}`.trim().replace(/2'/g, '2'));
  } catch {
    return { status: 'invalid' };
  }

  try {
    if (state.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    })) return { status: 'solved' };
  } catch {
    // Some KPuzzles do not implement the experimental predicate; exact
    // orientation enumeration below is the authoritative fallback.
  }
  if (state.isIdentical(solved)) return { status: 'solved' };
  if (isCube || puzzle === 'skewb') {
    for (const rotation of CUBE_ORIENTATIONS) {
      if (rotation && state.applyAlg(rotation).isIdentical(solved)) return { status: 'solved' };
    }
  } else if (puzzle === 'pyraminx') {
    for (const rotation of PYRAMINX_ORIENTATIONS) {
      if (rotation && state.applyAlg(rotation).isIdentical(solved)) return { status: 'solved' };
    }
  } else if (puzzle === 'megaminx') {
    let rotated = state;
    for (let i = 1; i < 5; i++) {
      rotated = rotated.applyAlg('y');
      if (rotated.isIdentical(solved)) return { status: 'solved' };
    }
  }
  return { status: 'unsolved' };
}
