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
import ENGINE_SID_MAP_JSON from './data/engine-sid-map.json';

export { MASK_COLOR, CANONICAL_FACES, parseStickerId, parseMask, formatMask, toRenderMask };
export type { StickerId, RenderMask, MaskRenderOptions };

export const PIECE_GROUPS = PIECE_GROUPS_JSON as Record<string, StickerId[][]>;
export const SR_INDEX_MAP =
  SR_INDEX_MAP_JSON as unknown as Record<string, Record<string, [string, number]>>;
/** canonical sid → /sim 引擎贴纸建构 key(mesh `userData.stickerKey`)。派生表,
 *  禁手改:tests/_engine_mask_derive.ts 每次跑测重推比对(engine-mask.test.ts)。
 *  这是 mask 直映(PLAN-sr-retirement §2b/Phase 3),最终取代 SR_INDEX_MAP。 */
export const ENGINE_SID_MAP = ENGINE_SID_MAP_JSON as Record<string, Record<string, string>>;

/** Every puzzle but the cube family is keyed by name alone (no size). */
export type NonCubePuzzle = Exclude<PuzzleType, 'cube'>;

/**
 * Table key for a (puzzle, size), or null when no table exists for it.
 *
 * `sq1` masking (2026-07-21) is a NEW capability sr-puzzlegen never had (its
 * square-1 geometry is built from the simulator at construction time, so
 * `setValue(face, i, "mask")` never reaches the drawn geometry). Ours works
 * because the canonical sq1 id space is piece-keyed (mask-core header): the
 * tnoodle state carries piece ids through every move, so both `sq1-svg.ts`
 * (2D) and the engine companion (stickerKey) gray piece-followingly. The sr
 * iso render still can't mask sq1 — `srMaskSupported` stays false for it.
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

/**
 * Whether the /sim engine companion mirror can take a mask. `cube` (NxN) and
 * `sq1` need no derived table: their engine sticker keys ARE canonical sids
 * (NxN via `schematicInstanceKeys`, sq1 via build-time `stickerKey` — see
 * toEngineMask), so masking is an identity match. Every other puzzle needs a
 * geometry-derived direct map in ENGINE_SID_MAP.
 */
export function engineMaskSupported(puzzle: PuzzleType): boolean {
  return puzzle === 'cube' || puzzle === 'sq1' || puzzle in ENGINE_SID_MAP;
}

/**
 * Canonical ids → engine sticker build keys(mesh `userData.stickerKey`),喂
 * `exportSimSvgSchematic` 的 `mask` 选项。undefined = 该拼图还没有派生直映表
 * (调用方回退 spec 渲染器,不静默丢遮罩);表存在但 id 不在拼图上的静默跳过
 * (与 toSrMask 同宽容度)。
 */
export function toEngineMask(
  puzzle: PuzzleType, ids: Iterable<StickerId>,
): Set<string> | undefined {
  // NxN 与 sq1:引擎贴纸 key 直接就是 canonical sid(NxN 是 instanced.ts 的
  // engineHomeSid;sq1 是 sq1Geometry 建构时烙的 stickerKey),故恒等透传 ——
  // 不需要也没有派生表。拼图上不存在的 sid 留着无害(导出器 has() 永不命中,
  // 与非 cube 分支的静默跳过同宽容度)。
  if (puzzle === 'cube' || puzzle === 'sq1') return new Set(ids);
  const table = ENGINE_SID_MAP[puzzle];
  if (!table) return undefined;
  const out = new Set<string>();
  for (const sid of ids) {
    const key = table[sid];
    if (key) out.add(key);
  }
  return out;
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
