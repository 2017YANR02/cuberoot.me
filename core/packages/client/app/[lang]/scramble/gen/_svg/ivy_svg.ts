/**
 * Ivy Cube (枫叶魔方) state preview SVG — a flat cross net derived from the solver's exact
 * state model (lib/ivy-solver). Each face = a square showing 2 quarter-circle corner "petals"
 * (the 2 turning corners, which lie on an anti-diagonal) + 1 leaf/eye-shaped center piece
 * (everything else, bounded by the 2 concave arcs). No straight diagonal cuts, no frame corners:
 * the center piece fills the whole square including the 2 non-turning corners.
 *
 * Colors come straight from the (centers, corners) state, so solved → every face uniform (the
 * petal color equals the center color, so the face looks solid), and moves permute consistently
 * with the solver (single source of move truth = ivyApply). The two turning corners per face are
 * the 4 tetrahedral Ivy vertices UBR(axis0) UFL(axis1) DFR(axis2) DBL(axis3), placed by the
 * standard cross unfold.
 */
import { ivyApply, MOVE_CENTERS } from '@/lib/ivy-solver';

// Face order U R F B L D = 0..5 (matches lib/ivy-solver). Home colors (WCA-ish scheme).
export const IVY_DEFAULT_COLORS: string[] = [
  '#FFFFFF', // 0 U white
  '#EE0000', // 1 R red
  '#00B14F', // 2 F green
  '#1463E6', // 3 B blue
  '#FF8000', // 4 L orange
  '#FFD500', // 5 D yellow
];
const FRAME = '#1c1c1c';
const STROKE = '#000';
const S = 30;

type Slot = 'TL' | 'TR' | 'BL' | 'BR';
interface FaceDesc { fi: number; col: number; row: number; tris: Partial<Record<Slot, number>>; }

// Per-face: grid cell in the cross net + which corner slot is which turning corner (axis index).
// Verified by construction: at the solved state every region of a face is its home color, so the
// face is uniform.
const FACES: FaceDesc[] = [
  { fi: 0, col: 1, row: 0, tris: { TR: 0, BL: 1 } }, // U
  { fi: 4, col: 0, row: 1, tris: { TR: 1, BL: 3 } }, // L
  { fi: 2, col: 1, row: 1, tris: { TL: 1, BR: 2 } }, // F
  { fi: 1, col: 2, row: 1, tris: { TR: 0, BL: 2 } }, // R
  { fi: 3, col: 3, row: 1, tris: { TL: 0, BR: 3 } }, // B
  { fi: 5, col: 1, row: 2, tris: { TR: 2, BL: 3 } }, // D
];

/** Home-color id shown by turning corner `axis` (orientation `ori`) on face `faceIdx`. */
function cornerColorId(faceIdx: number, axis: number, ori: number): number {
  const tri = MOVE_CENTERS[axis];
  const p = tri.indexOf(faceIdx);
  return tri[(p - ori + 3) % 3];
}

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

export function renderIvyScrambleSvg(scramble: string, colors: string[] = IVY_DEFAULT_COLORS): string {
  let centers = [0, 1, 2, 3, 4, 5];
  let corners = [0, 0, 0, 0];
  try {
    const st = ivyApply(scramble);
    centers = st.centers;
    corners = st.corners;
  } catch (e) {
    console.warn('[ivy_svg] apply failed', scramble, e);
  }

  const W = 4 * S;
  const H = 3 * S;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];

  for (const f of FACES) {
    const x = f.col * S;
    const y = f.row * S;
    const h = S / 2;
    // Edge midpoints.
    const tm: [number, number] = [x + h, y];
    const rm: [number, number] = [x + S, y + h];
    const bm: [number, number] = [x + h, y + S];
    const lm: [number, number] = [x, y + h];
    // Each corner petal: corner point + its two adjacent edge-midpoints. Arc radius h, centered
    // at the corner, bulging TOWARD the face center.
    const petals: Record<Slot, { corner: [number, number]; a: [number, number]; b: [number, number] }> = {
      TL: { corner: [x, y], a: tm, b: lm },
      TR: { corner: [x + S, y], a: rm, b: tm },
      BL: { corner: [x, y + S], a: lm, b: bm },
      BR: { corner: [x + S, y + S], a: bm, b: rm },
    };

    // 1) Whole face square = the leaf-shaped center piece + non-turning corners (center color).
    out.push(
      `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(S)}" height="${fmt(S)}" fill="${colors[centers[f.fi]] ?? FRAME}" stroke="${STROKE}" stroke-width="1" stroke-linejoin="round"/>`,
    );

    // 2) The 2 turning-corner petals on top (quarter discs). Sweep flag 1 makes the arc bulge
    //    toward the face center for the corner→a→b winding chosen above (SVG y-axis points down).
    (Object.keys(petals) as Slot[]).forEach((slot) => {
      const axis = f.tris[slot];
      if (axis === undefined) return;
      const fill = colors[cornerColorId(f.fi, axis, corners[axis])] ?? FRAME;
      const p = petals[slot];
      const d = `M ${fmt(p.corner[0])} ${fmt(p.corner[1])} L ${fmt(p.a[0])} ${fmt(p.a[1])} A ${fmt(h)} ${fmt(h)} 0 0 1 ${fmt(p.b[0])} ${fmt(p.b[1])} Z`;
      out.push(`<path d="${d}" fill="${fill}" stroke="${STROKE}" stroke-width="1" stroke-linejoin="round"/>`);
    });
  }

  out.push('</svg>');
  return out.join('');
}
