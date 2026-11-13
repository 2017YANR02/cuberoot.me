/**
 * Reconstruction end-state validation shared by the submit UI and the API.
 *
 * The text cleaner intentionally mirrors the reconstruction player: comments,
 * stage markers and cosmetic annotations do not become puzzle moves. Cube
 * notation additionally accepts crowded text such as `ULB2LD'`.
 */
import { parseClockAlgorithm } from './clock_notation';
export { parseClockAlgorithm } from './clock_notation';
import { parsePyraAlgorithm, rotateLetterMap, VERTEX_NAMES } from './pyra_notation';
import { parseSkewbAlgorithm, rotateGripMap, SKEWB_WCA_TOKENS } from './skewb_notation';
import { MOVE_RE } from './alg_notation';
import type { KPattern } from 'cubing/kpuzzle';
import type { StickerDat } from 'cubing/puzzle-geometry';
import { isFtoEifSolved, parseFtoEifAlgorithm } from './fto_notation';
import { applySq1Move, applySq1Scramble, isSq1Solved, parseSq1Algorithm } from './sq1_notation';

export function validateReconTiming(input: {
  recordType?: unknown; pickupTime?: unknown; putdownTime?: unknown; solution?: unknown;
}): { zh: string; en: string } | null {
  if (input.recordType !== undefined && input.recordType !== 'timing' && input.recordType !== 'reconstruction') {
    return { zh: '请选择录入内容。', en: 'Choose a valid record type.' };
  }
  if (input.recordType !== 'timing' && input.pickupTime == null && input.putdownTime == null) return null;
  if ([input.pickupTime, input.putdownTime].some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 359999.999 || Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001)) {
    return { zh: '请填写起表和拍表，单位为秒，范围为 0–359999.999，最多三位小数。', en: 'Enter both pickup and putdown durations in seconds, from 0 to 359999.999, with up to three decimals.' };
  }
  if (input.recordType === 'timing' && typeof input.solution === 'string' && input.solution.trim()) {
    return { zh: '已有解法，请使用完整复盘模式保存。', en: 'A solution is present. Save in full reconstruction mode.' };
  }
  return null;
}

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
// Consume unmatched digit runs once instead of retrying each possible numeric prefix.
const PRIME_BEFORE_AMOUNT_RE = /((?:\d+(?:-\d+)?)?[RLUDFBMSExyzXYZrludfbmse]w?\d*)'(\d+)|\d+/g;

export function normalizeReconMoveSuffixOrder(text: string): string {
  if (!text) return text;
  return text.split(/\r?\n/).map((line) => {
    const commentIdx = line.indexOf('//');
    const moves = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';
    return moves.replace(PRIME_BEFORE_AMOUNT_RE, (match, move: string | undefined, amount: string | undefined) =>
      move === undefined ? match : `${move}${amount}'`) + comment;
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

type VisualSticker = Pick<StickerDat['stickers'][number], 'orbit' | 'ord' | 'ori' | 'face' | 'color'>;
interface VisualPuzzle {
  stickers: VisualSticker[];
  colors: Map<string, string>;
  faceCount: number;
}
const visualPuzzles = new Map<ReconPuzzleKey, Promise<VisualPuzzle>>();

async function isVisuallySolved(puzzle: ReconPuzzleKey, state: KPattern): Promise<boolean> {
  let pending = visualPuzzles.get(puzzle);
  if (!pending) {
    pending = (async () => {
      const { puzzles } = await import('cubing/puzzles');
      const geometry = await puzzles[puzzle].pg!();
      const data = geometry.get3d();
      // Keep the renderer's piece/sticker numbering, including duplicate center
      // orientations. Retain only colors, not the generated mesh coordinates.
      const stickers = data.stickers.map(({ orbit, ord, ori, face, color }) => ({ orbit, ord, ori, face, color }));
      return {
        stickers,
        colors: new Map(stickers.map(s => [`${s.orbit}/${s.ord}/${s.ori}`, s.color])),
        faceCount: data.faces.length,
      };
    })();
    visualPuzzles.set(puzzle, pending);
    void pending.catch(() => { visualPuzzles.delete(puzzle); });
  }
  const { stickers, colors, faceCount } = await pending;
  const orientations = new Map(state.kpuzzle.definition.orbits.map(o => [o.orbitName, o.numOrientations]));
  const faces = new Map<number, string>();
  for (const sticker of stickers) {
    const orbit = state.patternData[sticker.orbit];
    const count = orientations.get(sticker.orbit)!;
    // Same destination-to-source orientation convention as cubing's renderer.
    const sourceOrientation = (sticker.ori + count - orbit.orientation[sticker.ord]) % count;
    const color = colors.get(`${sticker.orbit}/${orbit.pieces[sticker.ord]}/${sourceOrientation}`);
    if (color === undefined) throw new Error('Missing reconstruction sticker color');
    if (faces.has(sticker.face) && faces.get(sticker.face) !== color) return false;
    faces.set(sticker.face, color);
  }
  return faces.size === faceCount && new Set(faces.values()).size === faceCount;
}

function hasRealScramble(scramble: string): boolean {
  const value = scramble.trim().toLowerCase();
  return value.length > 0 && !SCRAMBLE_PLACEHOLDERS.has(value);
}

/** Fold regrips and complementary face slabs into physical vertex moves. */
function cleanReconPyraminxMoves(text: string): string {
  const parsed = parsePyraAlgorithm(cleanFtoReconAlgForPlayer(text));
  if (parsed.invalid.length) throw new Error('Invalid Pyraminx notation');
  let map: ReadonlyArray<number> = [0, 1, 2, 3];
  const out: string[] = [];
  for (const move of parsed.moves) {
    const axis = map[move.vertex];
    if (move.part === 'rot' || move.part === 'face') map = rotateLetterMap(map, axis, move.dir);
    if (move.part === 'rot') continue;
    const letter = move.part === 'tip' ? VERTEX_NAMES[axis].toLowerCase() : VERTEX_NAMES[axis];
    // A face slab is a whole rotation followed by the inverse of the untouched corner.
    const dir = move.part === 'face' ? -move.dir : move.dir;
    out.push(letter + (dir === 1 ? "'" : ''));
  }
  return out.join(' ');
}

function cleanReconSkewbMoves(text: string): string {
  const parsed = parseSkewbAlgorithm(cleanFtoReconAlgForPlayer(text));
  if (parsed.invalid.length) throw new Error('Invalid Skewb notation');
  let map: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6, 7];
  const out: string[] = [];
  for (const move of parsed.moves) {
    if ('rot' in move) map = rotateGripMap(map, move.rot, move.dir);
    else out.push(SKEWB_WCA_TOKENS[map[move.corner]] + (move.dir === 1 ? "'" : ''));
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

  if (puzzle === 'square1') {
    // Keep fields separate so top-only shorthand cannot merge across the boundary.
    const fields = [input.scramble, input.solution].map(parseSq1Algorithm);
    if (fields.some(field => field.invalid.length)) return { status: 'invalid' };
    let state = applySq1Scramble('');
    for (const move of fields.flatMap(field => field.tokens)) {
      if (move.kind === 'slice' && [0, 12].some(offset =>
        state.pieces[offset + 5] === state.pieces[offset + 6]
        || state.pieces[offset + 11] === state.pieces[offset])) return { status: 'invalid' };
      state = applySq1Move(state, move);
    }
    return { status: isSq1Solved(state) ? 'solved' : 'unsolved' };
  }

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
  const scramble = isCube ? cleanReconCubeStateMoves(input.scramble)
      : puzzle === 'clock' || puzzle === 'megaminx' ? cleanReconAlgText(input.scramble)
        : cleanReconAlgForPlayer(input.scramble);
  const solution = isCube ? cleanReconCubeStateMoves(input.solution)
      : puzzle === 'clock' || puzzle === 'megaminx' ? cleanReconAlgText(input.solution)
        : cleanReconAlgForPlayer(input.solution);

  // Regrips in the scramble establish the frame for the solution too.
  let stateAlg: string;
  try {
    stateAlg = puzzle === 'clock' ? (() => {
      const parsed = parseClockAlgorithm(`${scramble} ${solution}`);
      if (parsed.invalid) throw new Error('Invalid Clock notation');
      return parsed.alg;
    })() : puzzle === 'pyraminx' ? cleanReconPyraminxMoves(`${input.scramble}\n${input.solution}`)
    : puzzle === 'skewb' ? cleanReconSkewbMoves(`${input.scramble}\n${input.solution}`)
      : `${scramble} ${solution}`;
  } catch { return { status: 'invalid' }; }

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
    state = solved.applyAlg(stateAlg.trim());
  } catch {
    return { status: 'invalid' };
  }

  if (puzzle === 'clock') {
    // Rotating the clock also rotates its printed hour marks. Frame identity,
    // front/back choice and pin positions do not affect whether it is solved.
    const { DIALS, HOUR_MARKS } = state.patternData;
    return { status: DIALS.orientation.every((angle, i) =>
      (angle - 3 * HOUR_MARKS.orientation[i]) % 12 === 0) ? 'solved' : 'unsolved' };
  }

  try {
    if (state.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    })) return { status: 'solved' };
  } catch {
    // Some KPuzzles do not implement the experimental predicate.
  }
  if (state.isIdentical(solved)) return { status: 'solved' };
  if (isCube || puzzle === 'skewb' || puzzle === 'pyraminx' || puzzle === 'megaminx') {
    try {
      return { status: await isVisuallySolved(puzzle, state) ? 'solved' : 'unsolved' };
    } catch {
      // A missing geometry chunk is not evidence that the user's solve failed.
      return { status: 'unchecked' };
    }
  }
  return { status: 'unsolved' };
}
