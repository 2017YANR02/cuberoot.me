/**
 * Ivy Cube (枫叶魔方) state preview SVG — a flat cross net derived from the solver's exact
 * state model (lib/ivy-solver). Each face = a square cut by TWO large circular arcs, each
 * centered at one of the 2 turning corners (the pair on an anti-diagonal) and of radius = the
 * full edge length S, both sweeping between the 2 NON-turning corners on the other diagonal.
 * Those 2 arcs carve the square into 3 regions, exactly like the black cut lines on a real
 * Ivy cube (the "maple-leaf" look):
 *   - a pointed-oval lens / "eye" piece in the center, its 2 points at the non-turning corners,
 *     bounded by both arcs → filled with the CENTER color;
 *   - 2 large "petal" pieces, one at each turning corner, each bounded by the 2 square edges
 *     meeting at that corner + the OTHER turning corner's arc → filled with that turning
 *     corner's color.
 *
 * Colors come straight from the (centers, corners) state, so solved → every face uniform (the
 * petal color equals the center color, so the face looks solid with only the black cut lines),
 * and moves permute consistently with the solver (single source of move truth = ivyApply). The
 * two turning corners per face are the 4 tetrahedral Ivy vertices UBR(axis0) UFL(axis1)
 * DFR(axis2) DBL(axis3), placed by the standard cross unfold.
 *
 * Arc radius = S; sweep flags are computed geometrically (arcSweep) — large-arc-flag = 0 and the
 * sweep that makes the minor arc bulge AWAY from its own turning-corner center (i.e. toward the
 * face interior), so it dips concavely between the two non-turning corners regardless of which
 * diagonal the turning corners sit on.
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

type Pt = [number, number];

/**
 * SVG sweep-flag (with large-arc-flag = 0) for the minor arc centered at `c`, radius `r`, drawn
 * `p1` -> `p2`, that bulges concavely toward the face interior (the arc whose midpoint sits on the
 * far side of the chord from `c`). SVG y points down, so the flag can't be reasoned out by hand —
 * we sample both candidate midpoints and pick the one extending past the chord midpoint, away
 * from `c`.
 */
function arcSweep(c: Pt, r: number, p1: Pt, p2: Pt): 0 | 1 {
  const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
  const a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
  const midForSweep = (sweep: 0 | 1): Pt => {
    let da = a2 - a1;
    if (sweep === 1) { if (da < 0) da += 2 * Math.PI; } else if (da > 0) { da -= 2 * Math.PI; }
    const am = a1 + da / 2;
    return [c[0] + r * Math.cos(am), c[1] + r * Math.sin(am)];
  };
  const chordMid: Pt = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const dir: Pt = [chordMid[0] - c[0], chordMid[1] - c[1]]; // c -> chordMid, points outward
  const score = (sweep: 0 | 1): number => {
    const m = midForSweep(sweep);
    return (m[0] - chordMid[0]) * dir[0] + (m[1] - chordMid[1]) * dir[1];
  };
  return score(1) > score(0) ? 1 : 0;
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
    // Square corners.
    const corner: Record<Slot, Pt> = {
      TL: [x, y],
      TR: [x + S, y],
      BL: [x, y + S],
      BR: [x + S, y + S],
    };
    // The 2 turning corners (anti-diagonal) come from f.tris; the other 2 are non-turning.
    const turnSlots = (Object.keys(f.tris) as Slot[]); // exactly 2, on a diagonal
    const allSlots: Slot[] = ['TL', 'TR', 'BL', 'BR'];
    const nonTurnSlots = allSlots.filter((s) => !turnSlots.includes(s)); // exactly 2, other diagonal
    const [n1, n2] = nonTurnSlots.map((s) => corner[s]) as [Pt, Pt];

    // One big arc per turning corner: centered there, radius S, sweeping between the 2 non-turning
    // corners (both at distance S from any corner of the square). Concave-inward sweep flag.
    const arc = turnSlots.map((s) => {
      const c = corner[s];
      const sweep = arcSweep(c, S, n1, n2); // n1 -> n2
      return { c, sweep };
    });
    const [a0, a1] = arc; // a0 centered at turnSlots[0], a1 at turnSlots[1]
    const A = (sweep: 0 | 1, p: Pt) => `A ${fmt(S)} ${fmt(S)} 0 0 ${sweep} ${fmt(p[0])} ${fmt(p[1])}`;

    // 1) Center lens / "eye": bounded by both arcs, points at the 2 non-turning corners.
    //    Go n1 -> n2 along arc a0, then n2 -> n1 along arc a1 (reversed → sweep flips).
    const lensFill = colors[centers[f.fi]] ?? FRAME;
    const lensD = `M ${fmt(n1[0])} ${fmt(n1[1])} ${A(a0.sweep, n2)} ${A(a1.sweep === 1 ? 0 : 1, n1)} Z`;

    // 2) The 2 petals, one per turning corner. Each is the corner region bounded by the two square
    //    edges meeting at that turning corner + the OTHER turning corner's arc (n1 -> n2).
    const petalPaths: string[] = turnSlots.map((slot, i) => {
      const t = corner[slot];
      const otherArc = arc[1 - i]; // the OTHER turning corner's arc bounds this petal
      const axis = f.tris[slot]!;
      const fill = colors[cornerColorId(f.fi, axis, corners[axis])] ?? FRAME;
      // Walk: turning corner -> n1 (edge) -> arc(other) -> n2 -> turning corner (edge).
      return `M ${fmt(t[0])} ${fmt(t[1])} L ${fmt(n1[0])} ${fmt(n1[1])} ${A(otherArc.sweep, n2)} L ${fmt(t[0])} ${fmt(t[1])} Z|${fill}`;
    });

    // Draw petals first, then lens on top — overlap (if any rounding gap) is hidden, and the lens
    // outline stays crisp. Each region carries the black cut stroke.
    petalPaths.forEach((pp) => {
      const [d, fill] = pp.split('|');
      out.push(`<path d="${d}" fill="${fill}" stroke="${STROKE}" stroke-width="1" stroke-linejoin="round"/>`);
    });
    out.push(`<path d="${lensD}" fill="${lensFill}" stroke="${STROKE}" stroke-width="1" stroke-linejoin="round"/>`);
  }

  out.push('</svg>');
  return out.join('');
}
