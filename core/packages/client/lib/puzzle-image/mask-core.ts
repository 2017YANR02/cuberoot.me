/**
 * Mask primitives with NO derived tables — the light half of the mask layer.
 *
 * Everything here is table-free on purpose: `<ScramblePreview2D>` (75 consumer
 * files, ~80 pages) only ever parses a mask string and hands it to a renderer,
 * so it must not drag the ~10KB `data/*.json` piece / sr-index tables into its
 * chunk. The table-backed half (piece expansion, sr index mapping) lives in
 * `puzzle-mask.ts` and is imported only by whoever actually needs it.
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
 */

/** `${FACE}${index}` in the renderer's own canonical id space, e.g. `U4`, `DBR10`. */
export type StickerId = string;

/** sr-puzzlegen `MASK_COLOR` (puzzles/colors.ts). Sticker data, not a theme token. */
export const MASK_COLOR = '#404040';

export interface RenderMask {
  /** Canonical sticker ids to gray out, read in the SOLVED frame. */
  ids: Set<StickerId>;
  color: string;
}

export interface MaskRenderOptions {
  /**
   * Masked stickers are resolved against each sticker's ORIGIN id (where the
   * sticker started), so the gray travels with the piece through the scramble.
   */
  mask?: RenderMask;
  /**
   * Emit `data-sid="F3"` on every sticker path — the id of the sticker's
   * POSITION (not its origin), for click-to-gray authoring on a solved render.
   * Off by default: the emitted SVG must stay byte-identical without it.
   */
  stickerIds?: boolean;
}

export const CANONICAL_FACES: Record<string, readonly string[]> = {
  cube: ['U', 'R', 'F', 'D', 'L', 'B'],
  pyraminx: ['F', 'D', 'L', 'R'],
  skewb: ['U', 'R', 'F', 'D', 'L', 'B'],
  megaminx: ['U', 'BL', 'BR', 'R', 'F', 'L', 'D', 'DR', 'DBR', 'B', 'DBL', 'DL'],
};

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

/** Convenience for the renderers: DSL string → the `mask` option they take. */
export function toRenderMask(
  mask: string | Set<StickerId> | undefined,
  color = MASK_COLOR,
): RenderMask | undefined {
  if (!mask) return undefined;
  const ids = typeof mask === 'string' ? parseMask(mask) : mask;
  return ids.size ? { ids, color } : undefined;
}
