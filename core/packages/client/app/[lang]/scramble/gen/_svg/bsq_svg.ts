/**
 * Bandaged Square-1 (bsq, cstimer key `bsq` = </,(1,0)>) state preview SVG.
 *
 * The bandaged Square-1 IS a physical Square-1 — only its MOVE SET is restricted (top-only `(x,0)` turns +
 * `/` slice; the bottom layer is never turned directly). The PIECES, shape and stickers are identical to a
 * plain Square-1, and bsq scrambles are valid Square-1 notation (`(x,0)/ …`). So the preview reuses the
 * proven Square-1 net renderer (`renderSq1ScrambleSvg` from `@/lib/sq1-svg`) verbatim — no redrawn
 * geometry, single source of truth. A solved puzzle renders as a clean Square-1 (self-proving).
 */
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from '@/lib/sq1-svg';

/** Render a bsq scramble (top-only `(x,0)/` Square-1 notation) on the standard Square-1 net. */
export function renderBsqScrambleSvg(scramble: string): string {
  return renderSq1ScrambleSvg(scramble, DEFAULT_SQ1_COLORS);
}
