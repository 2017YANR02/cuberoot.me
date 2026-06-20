/**
 * Ivy Cube (枫叶魔方) state preview SVG — a flat cross net derived from the solver's exact
 * state model (lib/ivy-solver). Each face = a square split into a center diamond + 4 corner
 * triangles; the Ivy has only 2 turning corners per face (on a diagonal), the other 2 are frame.
 *
 * Colors come straight from the (centers, corners) state, so solved → every face uniform, and
 * moves permute consistently with the solver (single source of move truth = ivyApply). The two
 * turning corners per face are the 4 tetrahedral Ivy vertices UBR(axis0) UFL(axis1) DFR(axis2)
 * DBL(axis3), placed by the standard cross unfold.
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

// Per-face: grid cell in the cross net + which diagonal triangle slot is which turning corner
// (axis index). Verified by construction: at the solved state every region of a face is its
// home color, so the face is uniform.
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
function poly(pts: Array<[number, number]>, fill: string): string {
  const d = pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');
  return `<polygon points="${d}" fill="${fill}" stroke="${STROKE}" stroke-width="1" stroke-linejoin="round"/>`;
}

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
    const cx = x + h;
    const cy = y + h;
    // center diamond
    out.push(poly([[cx, y], [x + S, cy], [cx, y + S], [x, cy]], colors[centers[f.fi]] ?? FRAME));
    // 4 corner triangles
    const slots: Record<Slot, Array<[number, number]>> = {
      TL: [[x, y], [cx, y], [x, cy]],
      TR: [[cx, y], [x + S, y], [x + S, cy]],
      BL: [[x, cy], [x, y + S], [cx, y + S]],
      BR: [[x + S, cy], [x + S, y + S], [cx, y + S]],
    };
    (Object.keys(slots) as Slot[]).forEach((slot) => {
      const axis = f.tris[slot];
      const fill = axis === undefined
        ? FRAME
        : (colors[cornerColorId(f.fi, axis, corners[axis])] ?? FRAME);
      out.push(poly(slots[slot], fill));
    });
  }

  out.push('</svg>');
  return out.join('');
}
