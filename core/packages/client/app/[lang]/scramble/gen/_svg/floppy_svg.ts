/**
 * 1×3×3 Floppy Cube (1×3×3 花型) state preview SVG — a flat net derived from the solver's exact
 * state model (lib/floppy-solver). The Floppy is one layer thick, so the natural view is the U
 * face (3×3) with the four side faces (R F L B, each 3×1) folded out around it.
 *
 * Colors come straight from the (pieces, flips) state, so solved → every face uniform (the U top
 * is its single home color, each side strip is its own face color). A 180° side turn swaps + flips
 * its two corner pieces; the net shows a flipped corner by its top sticker turning into U↔side
 * (single source of move truth = floppyApply). The four corner pieces are the only mobile
 * stickers; centers and edges are fixed.
 *
 * Corner/face layout (matches cstimer movePieces R={0,1} L={2,3} F={0,3} B={1,2}):
 *   corner 0 = front-right, 1 = back-right, 2 = back-left, 3 = front-left
 *   move axis R L F B = 0 1 2 3; face id U R F B L D = 0..5
 */
import { floppyApply } from '@/lib/floppy-solver';

export const FLOPPY_DEFAULT_COLORS: string[] = [
  '#FFFFFF', // 0 U white
  '#EE0000', // 1 R red
  '#00B14F', // 2 F green
  '#1463E6', // 3 B blue
  '#FF8000', // 4 L orange
  '#FFD500', // 5 D yellow
];
const STROKE = '#000';
const S = 28; // cell size

// Each corner position sits at a U-face grid cell and touches two side faces. The two move axes
// acting on a position determine its flip parity (a corner flips when exactly one of its two
// touching faces has been turned an odd number of times). Axis order R L F B = 0..3.
interface CornerSlot { col: number; row: number; axes: [number, number]; sideOf: Record<number, number>; }
const CORNER_SLOTS: CornerSlot[] = [
  // front-right: faces R(1)/F(2) → axes R(0)/F(2)
  { col: 2, row: 2, axes: [0, 2], sideOf: { 0: 1, 2: 2 } },
  // back-right: faces R(1)/B(3) → axes R(0)/B(3)
  { col: 2, row: 0, axes: [0, 3], sideOf: { 0: 1, 3: 3 } },
  // back-left: faces L(4)/B(3) → axes L(1)/B(3)
  { col: 0, row: 0, axes: [1, 3], sideOf: { 1: 4, 3: 3 } },
  // front-left: faces L(4)/F(2) → axes L(1)/F(2)
  { col: 0, row: 2, axes: [1, 2], sideOf: { 1: 4, 2: 2 } },
];

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }
function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${fill}" stroke="${STROKE}" stroke-width="1"/>`;
}

// Is the corner currently at position `pos` flipped? exactly one of its two touching faces turned.
function isFlipped(pos: number, flips: number[]): boolean {
  const [ax, bx] = CORNER_SLOTS[pos].axes;
  return ((flips[ax] ?? 0) ^ (flips[bx] ?? 0)) === 1;
}

export function renderFloppyScrambleSvg(scramble: string, colors: string[] = FLOPPY_DEFAULT_COLORS): string {
  let pieces = [0, 1, 2, 3];
  let flips = [0, 0, 0, 0];
  try {
    const st = floppyApply(scramble);
    pieces = st.pieces;
    flips = st.flips;
  } catch (e) {
    console.warn('[floppy_svg] apply failed', scramble, e);
  }

  const W = 3 * S;
  const totalW = W + 2 * S; // L + U + R strips
  const totalH = W + 2 * S; // B + U + F strips
  const ox = S, oy = S;     // U grid offset

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];

  // U face 3×3: center + 4 edges fixed white; 4 corners driven by (piece, flip).
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = ox + c * S, y = oy + r * S;
      const isCorner = (c === 0 || c === 2) && (r === 0 || r === 2);
      if (!isCorner) { out.push(rect(x, y, S, S, colors[0])); continue; }
      const pos = CORNER_SLOTS.findIndex((s) => s.col === c && s.row === r);
      // top sticker: white unless flipped, then the corner's primary side color (of its home piece)
      const home = pieces[pos];
      const flipped = isFlipped(pos, flips);
      const topColId = flipped ? CORNER_SLOTS[home].sideOf[CORNER_SLOTS[home].axes[0]] : 0;
      out.push(rect(x, y, S, S, colors[topColId] ?? colors[0]));
    }
  }

  // Four side strips, each 3 cells: middle = fixed face color; the two ends = the side stickers of
  // the two corners on that face. When a corner is flipped its side sticker shows white (U), else
  // the face's home color.
  type Strip = { face: number; x: number; y: number; horiz: boolean; ends: [number, number] };
  const strips: Strip[] = [
    { face: 3, x: ox, y: 0, horiz: true, ends: [2, 1] },        // B (top): back-left, back-right
    { face: 2, x: ox, y: oy + W, horiz: true, ends: [3, 0] },   // F (bottom): front-left, front-right
    { face: 4, x: 0, y: oy, horiz: false, ends: [2, 3] },       // L (left): back-left, front-left
    { face: 1, x: ox + W, y: oy, horiz: false, ends: [1, 0] },  // R (right): back-right, front-right
  ];
  for (const strip of strips) {
    for (let i = 0; i < 3; i++) {
      const x = strip.horiz ? strip.x + i * S : strip.x;
      const y = strip.horiz ? strip.y : strip.y + i * S;
      let colId = strip.face;
      if (i !== 1) {
        const pos = strip.ends[i === 0 ? 0 : 1];
        colId = isFlipped(pos, flips) ? 0 : strip.face;
      }
      out.push(rect(x, y, S, S, colors[colId] ?? colors[strip.face]));
    }
  }

  out.push('</svg>');
  return out.join('');
}
