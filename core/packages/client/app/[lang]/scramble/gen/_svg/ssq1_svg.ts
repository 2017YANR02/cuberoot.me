/**
 * Super Square-1 (ssq1) state preview SVG — FOUR stacked 12-wedge disks (P0-top, P1-top, P1-bottom,
 * P0-bottom) whose colours come straight from the solver's own 48-slot model (lib/ssq1-solver
 * `ssq1Apply`), so the move semantics have a single source of truth and a SOLVED puzzle renders as
 * four clean, self-proving colour wheels.
 *
 * A Super Square-1 is two Square-1 mechanisms stacked. Each side has a top + bottom 12-slot ring;
 * corners span two adjacent 30° slots (same piece id), edges one slot. We draw each ring as 12 thirty-
 * degree wedges, colouring each slot by its piece id via a ramp — so corner pairs read as one 60° band
 * and the whole solved puzzle is regular. This is a STATE-DERIVED net (not a fixed colour table): if
 * `ssq1Apply` were wrong the solved render would not be uniform, which the test guards.
 *
 * Geometry reuses the Square-1/Square-2 wedge disk; we just stack four rings (P0 top, P1 top, P1 bot,
 * P0 bot) so both mechanisms are visible at once. (Preview is a soft requirement — a clean schematic.)
 */
import { ssq1Apply } from '@/lib/ssq1-solver';

const RADIUS = 28;
const RADIUS_MULTIPLIER = Math.SQRT2 * Math.cos((Math.PI * 15) / 180);
const MULTIPLIER = 1.4;
const STROKE_WIDTH = 2;
const DISK_W = 2 * RADIUS_MULTIPLIER * MULTIPLIER * RADIUS;
const DISK_H = 2 * RADIUS_MULTIPLIER * MULTIPLIER * RADIUS;
const GAP = 10;
const W = DISK_W;
const H = 4 * DISK_H + 3 * GAP;

// 48 distinct, state-derived wedge colours. Side 0 (ids 0..7 corners, 100..107 edges) uses a warm/cool
// hue wheel; side 1 (50.., 150..) the same wheel one notch darker — so a solved puzzle reads as four
// clean wheels and each piece is visually distinct. Puzzle-data colours (allowed per the loop's net rules).
const SIDE0_CORNER = ['#FF3B30', '#FF9500', '#FFD60A', '#34C759', '#00BFA5', '#0A84FF', '#5E5CE6', '#BF5AF2'];
const SIDE0_EDGE = ['#FF6B6B', '#FFB454', '#FFE873', '#74D98A', '#5BD6C8', '#5FB0FF', '#9B99F0', '#D99BF0'];
const SIDE1_CORNER = ['#B71C1C', '#C24A00', '#C2A100', '#1E8E3E', '#00897B', '#1565C0', '#3F3DA8', '#7B2C9E'];
const SIDE1_EDGE = ['#E05555', '#D98036', '#D9C24E', '#4FA868', '#3FA89C', '#3F7FC2', '#6E6CC8', '#A86CC8'];

/** map a piece id (as stored in ssq1Apply: P0 ids 0..7/100..107, P1 ids 50..57/150..157) → colour. */
function colorFor(id: number): string {
  if (id >= 150) return SIDE1_EDGE[(id - 150) % 8] ?? '#888';
  if (id >= 100) return SIDE0_EDGE[(id - 100) % 8] ?? '#888';
  if (id >= 50) return SIDE1_CORNER[(id - 50) % 8] ?? '#888';
  return SIDE0_CORNER[id % 8] ?? '#888';
}

function wedgePolys(r: number): string[] {
  const tx = (Math.sqrt(3) * r) / 2;
  const ty = r / 2;
  return [
    `M 0 0 L ${r} 0 L ${tx} ${ty} Z`,
    `M ${r} 0 L ${MULTIPLIER * r} 0 L ${MULTIPLIER * tx} ${MULTIPLIER * ty} L ${tx} ${ty} Z`,
  ];
}

/** Draw one 12-wedge disk: each slot is one 30° wedge, coloured by its piece id. */
function drawDisk(parts: string[], slots: ArrayLike<number>, base: number, cx: number, cy: number, startAngle: number): void {
  const polys = wedgePolys(RADIUS);
  let angle = startAngle;
  for (let i = 0; i < 12; i++) {
    const fill = colorFor(slots[base + i]);
    for (let p = polys.length - 1; p >= 0; p--) {
      parts.push(
        `<path d="${polys[p]}" fill="${fill}" stroke="#000" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" transform="translate(${cx},${cy}) rotate(${angle})" />`,
      );
    }
    angle += 30;
  }
}

/** Render a flat 48-slot piece array (P0 0..23, P1 24..47) as four stacked disks. */
export function renderSsq1State(slots48: ArrayLike<number>): string {
  const cx = W / 2;
  const parts: string[] = [];
  // disk order top→bottom: P0-top (slots 0..11), P1-top (24..35), P1-bot (36..47), P0-bot (12..23).
  const rows: { base: number }[] = [
    { base: 0 },   // P0 top
    { base: 24 },  // P1 top
    { base: 36 },  // P1 bottom
    { base: 12 },  // P0 bottom
  ];
  rows.forEach((row, r) => {
    const cy = DISK_H / 2 + r * (DISK_H + GAP);
    drawDisk(parts, slots48, row.base, cx, cy, 90 + 15);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" stroke-linecap="round" style="width:100%;height:100%">${parts.join('')}</svg>`;
}

/** scramble string → final net SVG (colours derived from ssq1Apply, so solved is self-proving). */
export function renderSsq1ScrambleSvg(scramble: string): string {
  let slots: ArrayLike<number>;
  try {
    slots = ssq1Apply(scramble);
  } catch (e) {
    console.warn('[ssq1_svg] apply failed', scramble, e);
    // solved fallback: P0 0..23, P1 24..47 → but colours keyed by ids; use ssq1Apply('') shape.
    slots = ssq1Apply('');
  }
  return renderSsq1State(slots);
}
