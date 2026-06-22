/**
 * Square-2 (sq2) state preview SVG — a flat two-disk net whose 24 wedge colours come straight from the
 * solver's own 24-slot model (lib/sq2-solver `sq2Apply`), so the move semantics have a single source of
 * truth and the SOLVED puzzle renders as a clean, self-proving net.
 *
 * A Square-2 is a Square-1 whose 8 corner pieces are each split in half, so every one of the 12 top and
 * 12 bottom pieces is an equal 30° wedge (1/12 of a turn). We therefore draw two stacked 12-wedge disks
 * (top above, bottom below) plus a thin equator strip, reusing the Square-1 wedge geometry from
 * `gen/_svg/sq1_svg.ts` but with ALL wedges (no 60° corners).
 *
 * Colours are derived from the slot's home id (0..23): top home ids 0..11 take the 6 face hues split into
 * two ramps, bottom ids 12..23 likewise — so the solved state (each wedge at home) shows a regular,
 * unambiguous net. This is a STATE-DERIVED net (not a fixed colour table): if `sq2Apply` were wrong the
 * solved render would not be uniform, which the test guards.
 */
import { sq2Apply } from '@/lib/sq2-solver';

const RADIUS = 32;
const RADIUS_MULTIPLIER = Math.SQRT2 * Math.cos((Math.PI * 15) / 180);
const MULTIPLIER = 1.4;
const STROKE_WIDTH = 2;
const W = 2 * RADIUS_MULTIPLIER * MULTIPLIER * RADIUS;
const H = 4 * RADIUS_MULTIPLIER * MULTIPLIER * RADIUS;

// 24 distinct, state-derived wedge colours. Top layer (home 0..11) uses warm/cool hues; bottom (12..23)
// uses the same hue wheel one notch darker so a solved puzzle reads as two clean colour wheels and each
// piece is visually distinct. These are puzzle data colours (not UI greys), allowed per the loop's net rules.
export const SQ2_WEDGE_COLORS: string[] = (() => {
  const top = ['#FF3B30', '#FF6B00', '#FFB300', '#FFE000', '#9CE000', '#00C853',
    '#00BFA5', '#00B0FF', '#2962FF', '#6A4CFF', '#C724B1', '#FF2D78'];
  const bot = ['#B71C1C', '#C24A00', '#C28200', '#BFA800', '#6FA000', '#00813A',
    '#008374', '#0077B6', '#1B3FB0', '#48249C', '#8E1B80', '#B01B52'];
  return [...top, ...bot];
})();

function wedgePolys(r: number): string[] {
  const tx = (Math.sqrt(3) * r) / 2;
  const ty = r / 2;
  return [
    `M 0 0 L ${r} 0 L ${tx} ${ty} Z`,
    `M ${r} 0 L ${MULTIPLIER * r} 0 L ${MULTIPLIER * tx} ${MULTIPLIER * ty} L ${tx} ${ty} Z`,
  ];
}

/** Draw one 12-wedge disk: each slot is one 30° wedge, coloured by its home id. */
function drawDisk(parts: string[], slots: ArrayLike<number>, cx: number, cy: number, startAngle: number, colors: string[]): void {
  const polys = wedgePolys(RADIUS);
  let angle = startAngle;
  for (let i = 0; i < 12; i++) {
    const fill = colors[slots[i]] ?? '#888';
    for (let p = polys.length - 1; p >= 0; p--) {
      parts.push(
        `<path d="${polys[p]}" fill="${fill}" stroke="#000" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" transform="translate(${cx},${cy}) rotate(${angle})" />`,
      );
    }
    angle += 30;
  }
}

export function renderSq2State(slots: ArrayLike<number>, colors: string[] = SQ2_WEDGE_COLORS): string {
  const halfSquareWidth = (RADIUS * RADIUS_MULTIPLIER * MULTIPLIER) / Math.SQRT2;
  const equatorH = RADIUS * (MULTIPLIER - 1);
  const leftX = W / 2 - halfSquareWidth;
  const midY = H / 2 - equatorH / 2;
  const fullW = 2 * halfSquareWidth;

  const parts: string[] = [];
  // Equator strip (neutral) between the two disks.
  parts.push(`<rect x="${leftX}" y="${midY}" width="${fullW}" height="${equatorH}" fill="#3a3a3a" stroke="#000" stroke-width="${STROKE_WIDTH}" />`);
  // Top disk (slots 0..11) above centre; bottom disk (slots 12..23) below, mirrored.
  drawDisk(parts, Array.from({ length: 12 }, (_, i) => slots[i]), W / 2, H / 4, 90 + 15, colors);
  drawDisk(parts, Array.from({ length: 12 }, (_, i) => slots[12 + i]), W / 2, (3 * H) / 4, -(90 + 15), colors);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" stroke-linecap="round" style="width:100%;height:100%">${parts.join('')}</svg>`;
}

/** scramble string → final net SVG (colours derived from sq2Apply, so solved is self-proving). */
export function renderSq2ScrambleSvg(scramble: string, colors: string[] = SQ2_WEDGE_COLORS): string {
  let slots: ArrayLike<number>;
  try {
    slots = sq2Apply(scramble);
  } catch (e) {
    console.warn('[sq2_svg] apply failed', scramble, e);
    slots = Array.from({ length: 24 }, (_, i) => i);
  }
  return renderSq2State(slots, colors);
}
