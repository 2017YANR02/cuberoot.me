/**
 * Piece / sticker MASK — the TABLE-BACKED half. Pure, no DOM.
 *
 * Importing this module pulls the two derived tables in `./data/*.json` (~10KB).
 * If you only need to parse a mask string and hand it to a renderer, import
 * `./mask-core` instead — that half is table-free (see its header).
 *
 * `data/piece-groups.json` and `data/sr-index-map.json` are DERIVED, never
 * hand-typed: `tests/_puzzle_mask_derive.ts` re-derives both from the state
 * machines themselves and `tests/puzzle-mask.test.ts` compares the result to
 * these files on every run — a renderer change breaks the test instead of
 * silently corrupting masks. They live under `lib/` (not `tests/fixtures/`)
 * because they are runtime data the app ships, not test input.
 */
import type { PuzzleType } from './types';
import {
  MASK_COLOR, CANONICAL_FACES, parseStickerId, parseMask, formatMask, toRenderMask,
  type StickerId, type RenderMask, type MaskRenderOptions,
} from './mask-core';
import PIECE_GROUPS_JSON from './data/piece-groups.json';
import SR_INDEX_MAP_JSON from './data/sr-index-map.json';

export { MASK_COLOR, CANONICAL_FACES, parseStickerId, parseMask, formatMask, toRenderMask };
export type { StickerId, RenderMask, MaskRenderOptions };

export const PIECE_GROUPS = PIECE_GROUPS_JSON as Record<string, StickerId[][]>;
export const SR_INDEX_MAP =
  SR_INDEX_MAP_JSON as unknown as Record<string, Record<string, [string, number]>>;

/** Every puzzle but the cube family is keyed by name alone (no size). */
export type NonCubePuzzle = Exclude<PuzzleType, 'cube'>;

/**
 * Table key for a (puzzle, size), or null when no table exists for it.
 *
 * `sq1` is NOT maskable and never will be: sr-puzzlegen builds square-1 geometry
 * from the simulator at construction time (`applyAlgorithm()` early-returns for
 * square1, `stickerColors` is skipped for it), so `setValue(face, i, "mask")`
 * never reaches the drawn geometry. Our own `sq1_svg.ts` likewise draws from a
 * shape-dependent layer model with no stable per-sticker id space.
 *
 * The cube family is only derived for N = 2..7 — every other N (and any puzzle
 * with no table) returns null instead of silently pretending.
 */
export function maskKey(puzzle: PuzzleType, cubeSize?: number): string | null {
  if (puzzle === 'cube') {
    if (cubeSize === undefined) return null;
    const key = `cube${cubeSize}`;
    return key in PIECE_GROUPS ? key : null;
  }
  return puzzle in PIECE_GROUPS ? puzzle : null;
}

/**
 * Does a derived piece table really exist for this (puzzle, size)? Cube size is
 * mandatory — there is no default N, and e.g. `cube8` has no table.
 */
export function maskSupported(puzzle: PuzzleType, cubeSize: number): boolean;
export function maskSupported(puzzle: NonCubePuzzle): boolean;
export function maskSupported(puzzle: PuzzleType, cubeSize?: number): boolean {
  return maskKey(puzzle, cubeSize) !== null;
}

/** Whether the sr-puzzlegen (iso / top) renderer can take a mask for this puzzle. */
export function srMaskSupported(puzzle: PuzzleType): boolean {
  return puzzle === 'pyraminx' || puzzle === 'skewb' || puzzle === 'megaminx';
}

// ─── derived tables ──────────────────────────────────────────────────────

function groupsFor(puzzle: PuzzleType, cubeSize?: number): StickerId[][] {
  const key = maskKey(puzzle, cubeSize);
  if (!key) {
    const what = puzzle === 'cube' ? `cube${cubeSize ?? '?'}` : puzzle;
    throw new Error(
      `[puzzle-mask] no derived piece table for "${what}" ` +
      `(have: ${Object.keys(PIECE_GROUPS).join(', ')}). ` +
      'Gate the caller on maskSupported() instead of masking blind.',
    );
  }
  return PIECE_GROUPS[key];
}

function pieceOfImpl(puzzle: PuzzleType, sid: StickerId, cubeSize?: number): StickerId[] {
  for (const g of groupsFor(puzzle, cubeSize)) if (g.includes(sid)) return g;
  const what = puzzle === 'cube' ? `cube${cubeSize}` : puzzle;
  throw new Error(`[puzzle-mask] sticker "${sid}" is not on ${what}`);
}

/** Stickers grouped by the physical piece they sit on. Throws when no table exists. */
export function pieceGroups(puzzle: PuzzleType, cubeSize: number): StickerId[][];
export function pieceGroups(puzzle: NonCubePuzzle): StickerId[][];
export function pieceGroups(puzzle: PuzzleType, cubeSize?: number): StickerId[][] {
  return groupsFor(puzzle, cubeSize);
}

/**
 * The whole piece a sticker sits on. Loud on both failure modes — an unsupported
 * (puzzle, size) and a sticker id that is not on that puzzle both throw. The old
 * signature defaulted `cubeSize = 3`, so a 4x4 sticker id came back as a lone
 * one-sticker "piece" with no warning.
 */
export function pieceOf(puzzle: PuzzleType, sid: StickerId, cubeSize: number): StickerId[];
export function pieceOf(puzzle: NonCubePuzzle, sid: StickerId): StickerId[];
export function pieceOf(puzzle: PuzzleType, sid: StickerId, cubeSize?: number): StickerId[] {
  return pieceOfImpl(puzzle, sid, cubeSize);
}

/** Expand a sticker mask to whole pieces (click one sticker → gray the piece). */
export function expandToPieces(
  puzzle: PuzzleType, ids: Iterable<StickerId>, cubeSize: number,
): Set<StickerId>;
export function expandToPieces(puzzle: NonCubePuzzle, ids: Iterable<StickerId>): Set<StickerId>;
export function expandToPieces(
  puzzle: PuzzleType, ids: Iterable<StickerId>, cubeSize?: number,
): Set<StickerId> {
  const out = new Set<StickerId>();
  for (const sid of ids) for (const s of pieceOfImpl(puzzle, sid, cubeSize)) out.add(s);
  return out;
}

/**
 * Canonical ids → sr-puzzlegen's `PuzzleOptions.mask` (`{ [srFace]: number[] }`).
 * Returns undefined when the puzzle has no derived sr map (sq1, NxN — PuzzleSVG
 * never renders NxN through sr).
 */
export function toSrMask(
  puzzle: PuzzleType, ids: Iterable<StickerId>,
): Record<string, number[]> | undefined {
  const table = SR_INDEX_MAP[puzzle];
  if (!table) return undefined;
  const out: Record<string, number[]> = {};
  for (const sid of ids) {
    const hit = table[sid];
    if (!hit) continue;
    (out[hit[0]] ??= []).push(hit[1]);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
  return out;
}
