/**
 * Gear Cube (gear) state preview — a compact 2D schematic derived ENTIRELY from the solver's exact
 * 4-int state (lib/gear-solver). The Gear Cube IS a cube, but its reachable state collapses to
 * 4 corners + 3 gear-edge axis-coordinates rather than a sticker permutation, so a pixel-exact WCA
 * cube net would be misleading. Instead we draw a faithful schematic that is self-proving and that
 * provably TRACKS the solver: a central "corner ring" of 4 dots (state[0] = corner 0..23 → permutation
 * of the 4 corner slots, with 24 = 4! arrangements) plus 3 gear-edges (state[1..3], each 0..71 = 24
 * perm × 3 gear-tooth orientations) rendered as small geared discs whose ANGLE encodes the gear
 * orientation (the visually salient feature of a gear cube — the gears rotate as you turn).
 *
 * Colors come straight from the state: at solved every coordinate is 0, so each piece renders in its
 * canonical color and every gear sits at angle 0 → a single, fixed, self-proving canonical render. Any
 * turn changes at least one coordinate, so the render changes; scramble ∘ optimal-solution returns all
 * coordinates to 0 and reproduces the solved render. Single source of move truth = gearApply.
 */
import { gearApply, GEAR_SOLVED } from '@/lib/gear-solver';

// Vivid data colors (not gray). 1 corner-cluster color + 3 gear-edge colors (one per axis U/R/F).
export const GEAR_DEFAULT_COLORS = {
  corner: '#9333ea',                                   // gear purple (corner cluster)
  edges: ['#EE0000', '#00B14F', '#1463E6'] as const,   // U, R, F gear-edge axes (red, green, blue)
  tooth: '#FFFFFF',
  stroke: '#1a1a1a',
  bg: '#FFFFFF',
} as const;

const VIEW_W = 320;
const VIEW_H = 180;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

// Decode the 4 corner slot positions from state[0] (0..23 = a permutation of [0,1,2,3]).
function cornerPerm(idx: number): number[] {
  const items = [0, 1, 2, 3];
  const out: number[] = [];
  let rem = idx;
  for (let n = 4; n >= 1; n--) {
    const f = factorial(n - 1);
    const p = Math.floor(rem / f);
    rem %= f;
    out.push(items.splice(p, 1)[0]);
  }
  return out;
}
function factorial(n: number): number { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

/** A geared disc at (x,y) radius r, body color `fill`, rotated by `angle` (radians); 6 teeth. */
function gearDisc(x: number, y: number, r: number, fill: string, angle: number, label: string): string {
  const C = GEAR_DEFAULT_COLORS;
  const out: string[] = [];
  // teeth
  const teeth = 6;
  for (let t = 0; t < teeth; t++) {
    const a = angle + (t * 2 * Math.PI) / teeth;
    const tx = x + Math.cos(a) * (r + 3.2);
    const ty = y + Math.sin(a) * (r + 3.2);
    out.push(`<circle cx="${fmt(tx)}" cy="${fmt(ty)}" r="2.4" fill="${C.tooth}" stroke="${C.stroke}" stroke-width="0.8"/>`);
  }
  out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="${fill}" stroke="${C.stroke}" stroke-width="1.4"/>`);
  // orientation spoke — makes the angle visible/self-proving
  const sx = x + Math.cos(angle) * (r - 2);
  const sy = y + Math.sin(angle) * (r - 2);
  out.push(`<line x1="${fmt(x)}" y1="${fmt(y)}" x2="${fmt(sx)}" y2="${fmt(sy)}" stroke="${C.tooth}" stroke-width="1.6" stroke-linecap="round"/>`);
  out.push(`<text x="${fmt(x)}" y="${fmt(y + r + 14)}" text-anchor="middle" font-size="9" fill="${C.stroke}" font-family="monospace">${label}</text>`);
  return out.join('');
}

/** The 4 corner slots arranged in a ring, drawn as small dots whose order encodes state[0]. */
function cornerRing(idx: number): string {
  const C = GEAR_DEFAULT_COLORS;
  const perm = cornerPerm(idx);
  const ringR = 30;
  const out: string[] = [`<circle cx="${fmt(CX)}" cy="${fmt(CY)}" r="${ringR}" fill="none" stroke="${C.corner}" stroke-width="1.2" opacity="0.5"/>`];
  // 4 slots at N/E/S/W; the dot at slot i is labelled with which corner piece occupies it.
  const slotAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  for (let slot = 0; slot < 4; slot++) {
    const a = slotAngles[slot];
    const dx = CX + Math.cos(a) * ringR;
    const dy = CY + Math.sin(a) * ringR;
    const piece = perm[slot];
    // solved (piece===slot) → filled corner color; displaced → lighter outline so solved is uniform.
    const filled = piece === slot;
    out.push(`<circle cx="${fmt(dx)}" cy="${fmt(dy)}" r="6" fill="${filled ? C.corner : C.bg}" stroke="${C.corner}" stroke-width="1.6"/>`);
    out.push(`<text x="${fmt(dx)}" y="${fmt(dy + 3)}" text-anchor="middle" font-size="8" fill="${filled ? C.tooth : C.corner}" font-family="monospace">${piece}</text>`);
  }
  return out.join('');
}

export function renderGearScrambleSvg(scramble: string): string {
  let st: number[] = [...GEAR_SOLVED];
  try {
    st = gearApply(scramble);
  } catch (e) {
    console.warn('[gear_svg] apply failed', scramble, e);
  }
  const C = GEAR_DEFAULT_COLORS;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="${C.bg}"/>`,
  ];

  // 3 gear-edges across the top (one per axis): each state[1..3] = perm(0..23)*3 + tooth(0..2).
  const labels = ['U', 'R', 'F'];
  const gx = [CX - 96, CX, CX + 96];
  const gy = 34;
  for (let ax = 0; ax < 3; ax++) {
    const coord = st[ax + 1];                 // 0..71
    const tooth = coord % 3;                   // gear-tooth orientation 0..2
    const perm = Math.floor(coord / 3);        // edge permutation index 0..23
    // angle: tooth gives 1/3-turn offset; perm gives a fine offset so distinct states look distinct.
    const angle = (tooth * 2 * Math.PI) / 3 + (perm * Math.PI) / 36;
    out.push(gearDisc(gx[ax], gy, 16, C.edges[ax], angle, `${labels[ax]}:${coord}`));
  }

  // corner cluster in the centre.
  out.push(cornerRing(st[0]));
  // caption of the raw state so the render is verifiably state-driven.
  out.push(`<text x="${fmt(CX)}" y="${fmt(VIEW_H - 8)}" text-anchor="middle" font-size="9" fill="${C.stroke}" font-family="monospace">[${st.join(', ')}]</text>`);

  out.push('</svg>');
  return out.join('');
}
