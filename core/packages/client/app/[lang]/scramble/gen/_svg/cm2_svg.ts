/**
 * Cmetrick Mini (cm2) state preview — a 2D schematic of the puzzle's 4 balls, derived entirely from the
 * solver's exact 4-ball state (lib/cm2-solver). The Cmetrick Mini is a 2×2 grid of spheres, NOT a cube,
 * so a WCA net doesn't fit; instead we draw 4 circles in a 2×2 layout. Each ball shows its 3 visible
 * faces (front / up / right) as a small 3-facelet rosette colored by the 6 standard cube colors mapped
 * through that ball's current orientation.
 *
 * Colors come straight from the state: each ball's orientation index selects which sticker color faces
 * the front (+Z), up (+Y) and right (+X) directions. At solved every ball is in the identity orientation,
 * so all 4 balls render the SAME 3-color rosette — a self-proving render. Any scramble rolls the balls
 * faithfully. The orientation-index→rotation mapping is re-derived here in the SAME enumeration order as
 * the solver (closure of {RX,RY,RZ} from I3), so index `i` is the identical physical rotation; single
 * source of move truth = cm2Apply.
 */
import { cm2Apply, CM2_SOLVED } from '@/lib/cm2-solver';

// 6 sticker colors (data colors), indexed by original face 0..5 = +X,−X,+Y,−Y,+Z,−Z (standard cube:
// right=red, left=orange, up=white, down=yellow, front=green, back=blue).
export const CM2_DEFAULT_COLORS = {
  stickers: ['#EE0000', '#FF8800', '#FFFFFF', '#FFD500', '#00B14F', '#1463E6'] as const,
  ballEdge: '#000',
  faceletStroke: '#000',
  bg: '#FFFFFF',
} as const;

// ── re-derive the 24 rotations in the solver's enumeration order ────────────────
type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];
const DIRS: ReadonlyArray<Vec3> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
function dirIndex(v: Vec3): number {
  for (let i = 0; i < 6; i++) if (DIRS[i][0] === v[0] && DIRS[i][1] === v[1] && DIRS[i][2] === v[2]) return i;
  return -1;
}
function applyMat(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}
function matMul(a: Mat3, b: Mat3): Mat3 {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r as unknown as Mat3;
}
const I3: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const RX: Mat3 = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
const RY: Mat3 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const RZ: Mat3 = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
const ROT_MATS: Mat3[] = [];
{
  const idx = new Map<string, number>();
  const key = (m: Mat3) => JSON.stringify(m);
  idx.set(key(I3), 0); ROT_MATS.push(I3);
  let frontier: Mat3[] = [I3];
  while (frontier.length) {
    const next: Mat3[] = [];
    for (const m of frontier) for (const g of [RX, RY, RZ]) {
      const m2 = matMul(g, m);
      const k = key(m2);
      if (!idx.has(k)) { idx.set(k, ROT_MATS.length); ROT_MATS.push(m2); next.push(m2); }
    }
    frontier = next;
  }
}
/** ROT_PERM[i][f] = which original sticker (0..5) now points in direction f for rotation i. */
const ROT_PERM: number[][] = ROT_MATS.map((m) => DIRS.map((_, f) => dirIndex(applyMat(m, DIRS[f]))));

// Visible directions: front = +Z (4), up = +Y (2), right = +X (0).
function frontColor(orient: number): string { return CM2_DEFAULT_COLORS.stickers[ROT_PERM[orient][4]]; }
function upColor(orient: number): string { return CM2_DEFAULT_COLORS.stickers[ROT_PERM[orient][2]]; }
function rightColor(orient: number): string { return CM2_DEFAULT_COLORS.stickers[ROT_PERM[orient][0]]; }

const VIEW = 200;
const R_BALL = 44;
// 2×2 ball centers: 0=TL,1=TR,2=BL,3=BR.
const CENTERS: ReadonlyArray<[number, number]> = [
  [56, 56], [144, 56], [56, 144], [144, 144],
];

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

/** A small 3-facelet rosette inside the ball: top wedge (up), bottom-left (front), bottom-right (right). */
function ballRosette(cx: number, cy: number, orient: number): string {
  const C = CM2_DEFAULT_COLORS;
  const out: string[] = [];
  // ball circle
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R_BALL}" fill="${frontColor(orient)}" stroke="${C.ballEdge}" stroke-width="1.5"/>`);
  // up facelet = top semicircle band (a 120° top wedge), front = visible body, right = a side wedge.
  const wedge = (a0deg: number, a1deg: number, fill: string) => {
    const a0 = (a0deg) * (Math.PI / 180);
    const a1 = (a1deg) * (Math.PI / 180);
    const x0 = cx + R_BALL * Math.cos(a0), y0 = cy + R_BALL * Math.sin(a0);
    const x1 = cx + R_BALL * Math.cos(a1), y1 = cy + R_BALL * Math.sin(a1);
    const large = (a1deg - a0deg) > 180 ? 1 : 0;
    return `<path d="M ${fmt(cx)} ${fmt(cy)} L ${fmt(x0)} ${fmt(y0)} A ${R_BALL} ${R_BALL} 0 ${large} 1 ${fmt(x1)} ${fmt(y1)} Z" fill="${fill}" stroke="${C.faceletStroke}" stroke-width="0.8"/>`;
  };
  // up = top 120° (−150°..−30°), right = right 120° (−30°..90°), front = remaining left 120° (90°..210°).
  out.push(wedge(-150, -30, upColor(orient)));
  out.push(wedge(-30, 90, rightColor(orient)));
  out.push(wedge(90, 210, frontColor(orient)));
  return out.join('');
}

export function renderCm2ScrambleSvg(scramble: string): string {
  let st: number[] = [...CM2_SOLVED];
  try {
    st = cm2Apply(scramble);
  } catch (e) {
    console.warn('[cm2_svg] apply failed', scramble, e);
  }
  const C = CM2_DEFAULT_COLORS;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${VIEW}" height="${VIEW}" fill="${C.bg}"/>`,
  ];
  for (let b = 0; b < 4; b++) {
    const [cx, cy] = CENTERS[b];
    out.push(ballRosette(cx, cy, st[b]));
  }
  out.push('</svg>');
  return out.join('');
}
