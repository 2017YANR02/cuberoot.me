/**
 * Super Floppy Cube (超薄花型 / Super Floppy) state preview — a flat 2D schematic derived entirely
 * from the solver's exact (corners, edges) state (lib/superfloppy-solver). The Super Floppy is a
 * 3×3×1 slab whose corners lift out of the plane and roam over 12 slots, so a plain WCA net doesn't
 * fit; instead we draw the in-plane 3×3 (center + 4 fixed edges + the 4 in-plane corner homes) and
 * ring it with the 8 lifted corner slots (two outside each edge, up/down). Colors come straight from
 * the state, so solved → the 4 in-plane homes show their own colors, every lifted slot is empty
 * (background), and every edge shows orientation 0 — a self-proving canonical render.
 *
 * A corner cell's color = its home corner color (each of the 4 corners has its own hue). An edge
 * cell shows the face color with a small orientation marker (a notch at one of 4 rotations) so a
 * reorientation is visible without a separate flip color. Empty lifted slots render as the muted
 * background. Single source of move truth = superFloppyApply.
 *
 * Slot ids match lib/superfloppy-solver: corners 0..3 = in-plane NE SE NW SW homes; 4 R-up 5 R-down
 * 6 L-up 7 L-down 8 U-up 9 U-down 10 D-up 11 D-down. Edge faces 0..3 = R L U D.
 */
import { superFloppyApply } from '@/lib/superfloppy-solver';

// 4 corner home hues + edge face colors + structural colors. (Data colors, not UI greys.)
export const SUPERFLOPPY_DEFAULT_COLORS = {
  corners: ['#EE0000', '#FF8000', '#00B14F', '#1463E6'], // corner home ids 0..3 (NE SE NW SW)
  edges: ['#FFD500', '#FFD500', '#FFD500', '#FFD500'],    // R L U D edge face (uniform yellow body)
  center: '#FFFFFF',
  empty: '#E6E6E6',
  marker: '#222',
  stroke: '#000',
} as const;
const S = 26; // cell size

// Cell coordinates (col,row) for every drawable position. Outer lifted ring at distance 0, in-plane
// 3×3 offset inward by 1. Grid is 5 wide × 5 tall.
const OX = 1, OY = 1;
const CENTER: readonly [number, number] = [OX + 1, OY + 1];
// edge face cells (R L U D)
const EDGE_CELL: ReadonlyArray<readonly [number, number]> = [
  [OX + 2, OY + 1], // R (right mid)
  [OX + 0, OY + 1], // L (left mid)
  [OX + 1, OY + 0], // U (top mid)
  [OX + 1, OY + 2], // D (bottom mid)
];
// corner slot cells 0..11
const CORNER_CELL: ReadonlyArray<readonly [number, number]> = [
  [OX + 2, OY + 0], // 0 NE
  [OX + 2, OY + 2], // 1 SE
  [OX + 0, OY + 0], // 2 NW
  [OX + 0, OY + 2], // 3 SW
  [OX + 3, OY + 0.5], // 4 R-up   (right of R edge, upper)
  [OX + 3, OY + 1.5], // 5 R-down (right of R edge, lower)
  [OX - 1, OY + 0.5], // 6 L-up
  [OX - 1, OY + 1.5], // 7 L-down
  [OX + 0.5, OY - 1],  // 8 U-up   (above U edge, left)
  [OX + 1.5, OY - 1],  // 9 U-down (above U edge, right)
  [OX + 0.5, OY + 3],  // 10 D-up
  [OX + 1.5, OY + 3],  // 11 D-down
];

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }
function cell(col: number, row: number, fill: string, extra = ''): string {
  return `<rect x="${fmt(col * S)}" y="${fmt(row * S)}" width="${fmt(S)}" height="${fmt(S)}" fill="${fill}" stroke="${SUPERFLOPPY_DEFAULT_COLORS.stroke}" stroke-width="1"/>${extra}`;
}

// Orientation marker for an edge: a small triangle notch on one of the 4 sides (0=top,1=right,
// 2=bottom,3=left), rotating with the edge's orientation.
function edgeMarker(col: number, row: number, ori: number): string {
  const cx = col * S + S / 2, cy = row * S + S / 2;
  const r = S * 0.32;
  // notch position by orientation
  const angle = (ori * Math.PI) / 2 - Math.PI / 2; // 0 → top
  const tx = cx + r * Math.cos(angle), ty = cy + r * Math.sin(angle);
  const m = SUPERFLOPPY_DEFAULT_COLORS.marker;
  return `<circle cx="${fmt(tx)}" cy="${fmt(ty)}" r="${fmt(S * 0.1)}" fill="${m}"/>`;
}

export function renderSuperFloppyScrambleSvg(scramble: string): string {
  let st = { corners: [0, 1, 2, 3, -1, -1, -1, -1, -1, -1, -1, -1], edges: [0, 0, 0, 0] };
  try {
    st = superFloppyApply(scramble);
  } catch (e) {
    console.warn('[superfloppy_svg] apply failed', scramble, e);
  }

  const C = SUPERFLOPPY_DEFAULT_COLORS;
  const cols = 5, rows = 5;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * S} ${rows * S}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];

  // center
  out.push(cell(CENTER[0], CENTER[1], C.center));
  // edges with orientation markers
  for (let f = 0; f < 4; f++) {
    const [c, r] = EDGE_CELL[f];
    out.push(cell(c, r, C.edges[f], edgeMarker(c, r, st.edges[f] ?? 0)));
  }
  // corner slots: occupied → home corner color; empty → muted background
  for (let slot = 0; slot < 12; slot++) {
    const [c, r] = CORNER_CELL[slot];
    const corner = st.corners[slot];
    out.push(cell(c, r, corner >= 0 ? C.corners[corner] : C.empty));
  }

  out.push('</svg>');
  return out.join('');
}
