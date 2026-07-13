/**
 * Renderer-facing mask types. Split out of `puzzle-mask.ts` so the `_svg/*`
 * renderers can `import type` them without pulling in the derived fixture
 * tables (which import from `tests/fixtures/`).
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
