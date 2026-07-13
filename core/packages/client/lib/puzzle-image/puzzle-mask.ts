/**
 * Piece / sticker MASK (gray-out) for the puzzle renderers. Pure — no DOM.
 *
 * Canonical sticker id = `${FACE}${index}`, in each renderer's OWN id space
 * (nothing is invented here):
 *
 *   NxN       faces U R F D L B, index = row * N + col read on the face AS DRAWN
 *             in the unfolded net — the same space as the arrow DSL (`U0U2`) and
 *             `ICubeOptions.stickerColors`.
 *   pyraminx  faces F D L R, slots 0..8 per the tnoodle net (pyraminx_svg header).
 *   skewb     faces U R F D L B, slots 0..4 (0 = center, 1..4 = corners).
 *   megaminx  faces U BL BR R F L D DR DBR B DBL DL, slots 0..9 = wedges, 10 = center.
 *
 * Semantics: a mask is authored in the SOLVED frame and carried by the state
 * machine, so the gray travels with the PIECE through the scramble (identical to
 * sr-puzzlegen, whose `applyMask()` runs before `applyAlgorithm()`).
 *
 * Two derived tables back this module. Both are re-derived and compared on every
 * test run (`tests/puzzle-mask.test.ts` + `tests/_puzzle_mask_derive.ts`) — a
 * renderer change breaks the test instead of silently corrupting masks.
 */
import type { PuzzleType } from './types';
import { MASK_COLOR, type StickerId, type RenderMask, type MaskRenderOptions } from './mask-types';
import PIECE_GROUPS_JSON from '@/tests/fixtures/puzzle-mask/piece-groups.json';
import SR_INDEX_MAP_JSON from '@/tests/fixtures/puzzle-mask/sr-index-map.json';

export { MASK_COLOR };
export type { StickerId, RenderMask, MaskRenderOptions };

export const CANONICAL_FACES: Record<string, readonly string[]> = {
  cube: ['U', 'R', 'F', 'D', 'L', 'B'],
  pyraminx: ['F', 'D', 'L', 'R'],
  skewb: ['U', 'R', 'F', 'D', 'L', 'B'],
  megaminx: ['U', 'BL', 'BR', 'R', 'F', 'L', 'D', 'DR', 'DBR', 'B', 'DBL', 'DL'],
};

/**
 * sq1 is NOT maskable. sr-puzzlegen builds square-1 geometry from the simulator
 * at construction time: `applyAlgorithm()` early-returns for square1 and
 * `stickerColors` is skipped for it, so `setValue(face, i, "mask")` never reaches
 * the drawn geometry. Our own `sq1_svg.ts` likewise draws from a shape-dependent
 * layer model with no stable per-sticker id space. Rather than ship something
 * plausible-but-wrong, sq1 masking is gated off here.
 */
export function maskSupported(puzzle: PuzzleType): boolean {
  return puzzle !== 'sq1';
}

/** Whether the sr-puzzlegen (iso / top) renderer can take a mask for this puzzle. */
export function srMaskSupported(puzzle: PuzzleType): boolean {
  return puzzle === 'pyraminx' || puzzle === 'skewb' || puzzle === 'megaminx';
}

// ─── DSL: `U:0,2;F:3-5` ──────────────────────────────────────────────────

const SID_RE = /^([A-Za-z]+)(\d+)$/;

export function parseStickerId(sid: string): { face: string; index: number } | null {
  const m = SID_RE.exec(sid.trim());
  if (!m) return null;
  return { face: m[1], index: parseInt(m[2], 10) };
}

/** `U:0,2;F:3-5` → Set of sticker ids. Tolerates whitespace and empty input. */
export function parseMask(s: string): Set<StickerId> {
  const out = new Set<StickerId>();
  for (const chunk of s.split(';')) {
    const part = chunk.trim();
    if (!part) continue;
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const face = part.slice(0, colon).trim();
    if (!face) continue;
    for (const range of part.slice(colon + 1).split(',')) {
      const r = range.trim();
      if (!r) continue;
      const dash = r.indexOf('-');
      if (dash > 0) {
        const a = parseInt(r.slice(0, dash), 10);
        const b = parseInt(r.slice(dash + 1), 10);
        if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) continue;
        for (let i = a; i <= b; i++) out.add(`${face}${i}`);
      } else {
        const i = parseInt(r, 10);
        if (Number.isFinite(i)) out.add(`${face}${i}`);
      }
    }
  }
  return out;
}

/** Set of sticker ids → the compact DSL. Stable: faces sorted, indices ascending,
 *  runs of ≥ 3 collapsed to `a-b`. `parseMask(formatMask(x))` round-trips. */
export function formatMask(ids: Iterable<StickerId>): string {
  const byFace = new Map<string, number[]>();
  for (const sid of ids) {
    const p = parseStickerId(sid);
    if (!p) continue;
    const arr = byFace.get(p.face) ?? [];
    arr.push(p.index);
    byFace.set(p.face, arr);
  }
  const faces = [...byFace.keys()].sort();
  const parts: string[] = [];
  for (const face of faces) {
    const idx = [...new Set(byFace.get(face)!)].sort((a, b) => a - b);
    const runs: string[] = [];
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
      const len = j - i + 1;
      if (len >= 3) runs.push(`${idx[i]}-${idx[j]}`);
      else for (let k = i; k <= j; k++) runs.push(String(idx[k]));
      i = j + 1;
    }
    parts.push(`${face}:${runs.join(',')}`);
  }
  return parts.join(';');
}

// ─── derived tables ──────────────────────────────────────────────────────

const PIECE_GROUPS = PIECE_GROUPS_JSON as Record<string, StickerId[][]>;
const SR_INDEX_MAP = SR_INDEX_MAP_JSON as unknown as Record<string, Record<string, [string, number]>>;

/** Fixture key for a puzzle (NxN is keyed by size: `cube3`). */
export function maskKey(puzzle: PuzzleType, cubeSize = 3): string {
  return puzzle === 'cube' ? `cube${cubeSize}` : puzzle;
}

/** Stickers grouped by the physical piece they sit on. Empty when not derived. */
export function pieceGroups(puzzle: PuzzleType, cubeSize = 3): StickerId[][] {
  return PIECE_GROUPS[maskKey(puzzle, cubeSize)] ?? [];
}

/** The whole piece a sticker belongs to (the sticker itself when unknown). */
export function pieceOf(puzzle: PuzzleType, sid: StickerId, cubeSize = 3): StickerId[] {
  for (const g of pieceGroups(puzzle, cubeSize)) if (g.includes(sid)) return g;
  return [sid];
}

/** Expand a sticker mask to whole pieces (click one sticker → gray the piece). */
export function expandToPieces(puzzle: PuzzleType, ids: Iterable<StickerId>, cubeSize = 3): Set<StickerId> {
  const out = new Set<StickerId>();
  for (const sid of ids) for (const s of pieceOf(puzzle, sid, cubeSize)) out.add(s);
  return out;
}

/**
 * Canonical ids → sr-puzzlegen's `PuzzleOptions.mask` (`{ [srFace]: number[] }`).
 * Returns undefined when the puzzle has no derived sr map (sq1, NxN — PuzzleSVG
 * never renders NxN through sr).
 */
export function toSrMask(puzzle: PuzzleType, ids: Iterable<StickerId>): Record<string, number[]> | undefined {
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

/** Convenience for the renderers: DSL string → the `mask` option they take. */
export function toRenderMask(mask: string | Set<StickerId> | undefined, color = MASK_COLOR): RenderMask | undefined {
  if (!mask) return undefined;
  const ids = typeof mask === 'string' ? parseMask(mask) : mask;
  return ids.size ? { ids, color } : undefined;
}
