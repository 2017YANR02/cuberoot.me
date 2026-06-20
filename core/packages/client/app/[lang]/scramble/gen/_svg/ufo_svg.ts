/**
 * UFO (UFO 魔方) state preview — a 2D disc schematic derived entirely from the solver's exact 48-slot
 * state (lib/ufo-solver). The UFO is a flat disc, not a cube, so a WCA net doesn't fit; instead we
 * draw the disc as 6 angular sectors (a 6-position wheel). 3 of the sectors hold a "ball" (8 octant
 * wedges each = 24 movable pieces); the other 3 are gap holding-positions a piece passes through when
 * the wheel turns.
 *
 * Colors come straight from the state: each of the 24 octant labels gets a fixed hue (3 ball
 * color-families × 8 shades). At solved every ball sits in its home sector with its 8 octants in
 * canonical order — a self-proving render: solved shows the three balls as three clean color-families
 * in their home sectors and the gap sectors empty. Any scramble permutes the wedges faithfully.
 *
 * Slot layout matches lib/ufo-solver: octant labels 0..7 = ball A, 8..15 = ball B, 16..23 = ball C.
 * The 48 home slots group as [sector0:0..7][gap1:8..15][sector2:16..23][gap3:24..31][sector4:32..39]
 * [gap5:40..47]; a slot's sector = floor(slot/8). Single source of move truth = ufoApply.
 */
import { ufoApply, UFO_SOLVED } from '@/lib/ufo-solver';

// 3 ball color-families (data colors, not UI greys). Each ball's 8 octants are shades around the hue.
export const UFO_DEFAULT_COLORS = {
  balls: ['#EE0000', '#00B14F', '#1463E6'] as const, // ball A red, B green, C blue
  empty: '#E6E6E6',
  center: '#FFFFFF',
  stroke: '#000',
} as const;

const VIEW = 200;
const CX = VIEW / 2;
const CY = VIEW / 2;
const R_OUTER = 92;
const R_BALL = 30; // radius of each ball circle drawn at the rim
const R_RING = 58; // distance of ball centers from disc center

/** Per-octant shade: lighten/darken the ball hue by the octant index (0..7) for a faithful spread. */
function octantColor(label: number): string {
  const ball = Math.floor(label / 8); // 0..2
  const oct = label % 8; // 0..7
  const base = UFO_DEFAULT_COLORS.balls[ball];
  // mix toward white for higher octants → 8 distinguishable shades, brand hue preserved.
  const t = oct / 9; // 0..0.78
  return mixToWhite(base, t);
}

function mixToWhite(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const h = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

/** SVG path for an octant wedge: a 45° pie slice of a ball circle centered at (bx,by). */
function octantWedge(bx: number, by: number, oct: number, fill: string): string {
  const a0 = (oct * 45 - 90) * (Math.PI / 180);
  const a1 = ((oct + 1) * 45 - 90) * (Math.PI / 180);
  const x0 = bx + R_BALL * Math.cos(a0), y0 = by + R_BALL * Math.sin(a0);
  const x1 = bx + R_BALL * Math.cos(a1), y1 = by + R_BALL * Math.sin(a1);
  return `<path d="M ${fmt(bx)} ${fmt(by)} L ${fmt(x0)} ${fmt(y0)} A ${R_BALL} ${R_BALL} 0 0 1 ${fmt(x1)} ${fmt(y1)} Z" fill="${fill}" stroke="${UFO_DEFAULT_COLORS.stroke}" stroke-width="0.8"/>`;
}

export function renderUfoScrambleSvg(scramble: string): string {
  let st: number[] = [...UFO_SOLVED];
  try {
    st = ufoApply(scramble);
  } catch (e) {
    console.warn('[ufo_svg] apply failed', scramble, e);
  }

  const C = UFO_DEFAULT_COLORS;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];

  // disc backdrop
  out.push(`<circle cx="${CX}" cy="${CY}" r="${R_OUTER}" fill="${C.center}" stroke="${C.stroke}" stroke-width="1"/>`);

  // 6 sectors at 60° apart. Sector centers point outward; ball drawn at R_RING from center.
  for (let sector = 0; sector < 6; sector++) {
    const ang = (sector * 60 - 90) * (Math.PI / 180);
    const bx = CX + R_RING * Math.cos(ang);
    const by = CY + R_RING * Math.sin(ang);
    const base = sector * 8;
    const occupied = st.slice(base, base + 8).some((v) => v >= 0);
    if (!occupied) {
      // empty gap holding-sector → muted disc
      out.push(`<circle cx="${fmt(bx)}" cy="${fmt(by)}" r="${R_BALL}" fill="${C.empty}" stroke="${C.stroke}" stroke-width="0.8"/>`);
      continue;
    }
    for (let oct = 0; oct < 8; oct++) {
      const label = st[base + oct];
      const fill = label >= 0 ? octantColor(label) : C.empty;
      out.push(octantWedge(bx, by, oct, fill));
    }
  }

  out.push('</svg>');
  return out.join('');
}
