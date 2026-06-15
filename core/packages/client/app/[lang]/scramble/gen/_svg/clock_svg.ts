/**
 * Clock puzzle — TS port of tnoodle-lib `ClockPuzzle.java`
 * (https://github.com/thewca/tnoodle-lib, scrambles/.../ClockPuzzle.java).
 *
 * Provides:
 *   - DEFAULT_CLOCK_COLORS / CLOCK_COLOR_KEYS — the 12 customizable parts
 *   - applyClockScramble(scramble) → 18-position state + rightSideUp flag
 *   - renderClockSvg(state, colors) → flat SVG string (300 × 150 viewBox)
 *
 * Used by the TNoodle-mode color picker so each clock event can carry a
 * user-editable color scheme that flows into both the live preview and the
 * PDF — exactly mirroring tnoodle's per-event color override.
 */

export const CLOCK_COLOR_KEYS = [
  'Front', 'FrontClock', 'FrontTopClock', 'FrontHand', 'FrontHandBorder', 'FrontPin',
  'Back', 'BackClock', 'BackTopClock', 'BackHand', 'BackHandBorder', 'BackPin',
] as const;
export type ClockColorKey = typeof CLOCK_COLOR_KEYS[number];

/** Verbatim from tnoodle ClockPuzzle.java defaultColorScheme. */
export const DEFAULT_CLOCK_COLORS: Record<ClockColorKey, string> = {
  Front: '#113366',
  FrontClock: '#ccddee',
  FrontTopClock: '#ffcc44',
  FrontHand: '#113366',
  FrontHandBorder: '#113366',
  FrontPin: '#88aacc',
  Back: '#ccddee',
  BackClock: '#113366',
  BackTopClock: '#cc6600',
  BackHand: '#ccddee',
  BackHandBorder: '#ccddee',
  BackPin: '#446699',
};

export interface ClockState {
  /** 18 positions, 0..11 each. Indices 0..8 = front 3x3 dials, 9..17 = back. */
  posit: number[];
  /** Flips after each y2; affects which side reads as "Front" when rendering. */
  rightSideUp: boolean;
}

const TURNS = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'] as const;
const MOVES: number[][] = [
  [0,1,1,0,1,1,0,0,0,  -1, 0, 0, 0, 0, 0, 0, 0, 0], // UR
  [0,0,0,0,1,1,0,1,1,   0, 0, 0, 0, 0, 0,-1, 0, 0], // DR
  [0,0,0,1,1,0,1,1,0,   0, 0, 0, 0, 0, 0, 0, 0,-1], // DL
  [1,1,0,1,1,0,0,0,0,   0, 0,-1, 0, 0, 0, 0, 0, 0], // UL
  [1,1,1,1,1,1,0,0,0,  -1, 0,-1, 0, 0, 0, 0, 0, 0], // U
  [0,1,1,0,1,1,0,1,1,  -1, 0, 0, 0, 0, 0,-1, 0, 0], // R
  [0,0,0,1,1,1,1,1,1,   0, 0, 0, 0, 0, 0,-1, 0,-1], // D
  [1,1,0,1,1,0,1,1,0,   0, 0,-1, 0, 0, 0, 0, 0,-1], // L
  [1,1,1,1,1,1,1,1,1,  -1, 0,-1, 0, 0, 0,-1, 0,-1], // ALL
];

export function applyClockScramble(scramble: string): ClockState {
  let posit = new Array<number>(18).fill(0);
  let rightSideUp = true;

  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok === 'y2') {
      const next = new Array<number>(18);
      for (let i = 0; i < 9; i++) {
        next[i] = posit[i + 9];
        next[i + 9] = posit[i];
      }
      posit = next;
      rightSideUp = !rightSideUp;
      continue;
    }
    const m = tok.match(/^([A-Z]+)(\d+)([+-])$/);
    if (!m) continue;
    const turnIdx = (TURNS as readonly string[]).indexOf(m[1]);
    if (turnIdx < 0) continue;
    const num = parseInt(m[2], 10);
    const sign = m[3] === '+' ? 1 : -1;
    const rot = ((num * sign) % 12 + 12) % 12;
    const row = MOVES[turnIdx];
    for (let p = 0; p < 18; p++) {
      posit[p] = ((posit[p] + rot * row[p]) % 12 + 12) % 12;
    }
  }
  return { posit, rightSideUp };
}

// ─── SVG renderer ─────────────────────────────────────────────────────────
// All constants verbatim from ClockPuzzle.java.
const STROKE_WIDTH = 2;
const FACE_STROKE_WIDTH = 1;
const RADIUS = 70;
const CLOCK_RADIUS = 14;
const CLOCK_OUTER_RADIUS = 21;
const POINT_RADIUS = (CLOCK_RADIUS + CLOCK_OUTER_RADIUS) / 2;
const TICK_R = 1;
const TOP_TICK_R = 2;
const ARROW_HEIGHT = 10;
const ARROW_RADIUS = 2;
const PIN_RADIUS = 4;
const ARROW_ANGLE = Math.PI / 2 - Math.acos(ARROW_RADIUS / ARROW_HEIGHT);
const GAP = 5;

const W = 4 * (RADIUS + GAP);
const H = 2 * (RADIUS + GAP);

export function renderClockSvg(state: ClockState, colors: Record<string, string>): string {
  const { posit, rightSideUp } = state;
  const get = (k: string): string => colors[k] ?? DEFAULT_CLOCK_COLORS[k as ClockColorKey] ?? '#000';
  const parts: string[] = [];

  // Two faces: index 0 = left half, index 1 = right half.
  // colorString tells us which key set ("Front"/"Back") to read for each side.
  const colorString = rightSideUp ? ['Front', 'Back'] : ['Back', 'Front'];

  for (let s = 0; s < 2; s++) {
    const cx = (s * 2 + 1) * (RADIUS + GAP);
    const cy = RADIUS + GAP;
    const sideKey = colorString[s];

    // 4 outer-corner thick black rings (no fill — face color leaks through later)
    for (const dx of [-2 * CLOCK_OUTER_RADIUS, 2 * CLOCK_OUTER_RADIUS]) {
      for (const dy of [-2 * CLOCK_OUTER_RADIUS, 2 * CLOCK_OUTER_RADIUS]) {
        parts.push(
          `<circle cx="${cx + dx}" cy="${cy + dy}" r="${CLOCK_OUTER_RADIUS}" stroke="#000" stroke-width="${STROKE_WIDTH}" fill="none" />`,
        );
      }
    }
    // Big body circle
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${RADIUS}" stroke="#000" stroke-width="${STROKE_WIDTH}" fill="${get(sideKey)}" />`,
    );
    // Re-fill the 4 corner discs with face color (over the body, inside the rings)
    const innerR = CLOCK_OUTER_RADIUS - STROKE_WIDTH / 2;
    for (const dx of [-2 * CLOCK_OUTER_RADIUS, 2 * CLOCK_OUTER_RADIUS]) {
      for (const dy of [-2 * CLOCK_OUTER_RADIUS, 2 * CLOCK_OUTER_RADIUS]) {
        parts.push(`<circle cx="${cx + dx}" cy="${cy + dy}" r="${innerR}" fill="${get(sideKey)}" />`);
      }
    }
    // 9 dial faces (3x3 grid)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const dcx = cx + 2 * i * CLOCK_OUTER_RADIUS;
        const dcy = cy + 2 * j * CLOCK_OUTER_RADIUS;
        parts.push(
          `<circle cx="${dcx}" cy="${dcy}" r="${CLOCK_RADIUS}" stroke="#000" stroke-width="${FACE_STROKE_WIDTH}" fill="${get(sideKey + 'Clock')}" />`,
        );
        // 12 tick marks
        for (let k = 0; k < 12; k++) {
          const rad = (30 * k) * Math.PI / 180;
          const tx = dcx + Math.sin(rad) * POINT_RADIUS;
          const ty = dcy + -Math.cos(rad) * POINT_RADIUS;
          const tickColor = get(sideKey + (k === 0 ? 'Top' : '') + 'Clock');
          const r = k === 0 ? TOP_TICK_R : TICK_R;
          parts.push(`<circle cx="${tx}" cy="${ty}" r="${r}" fill="${tickColor}" />`);
        }
      }
    }
  }

  // 18 arrows (one per dial, both faces)
  const ax = ARROW_RADIUS * Math.cos(ARROW_ANGLE);
  const ay = -ARROW_RADIUS * Math.sin(ARROW_ANGLE);
  const arrowPath = `M 0 0 L ${ax} ${ay} L 0 ${-ARROW_HEIGHT} L ${-ax} ${ay} Z`;
  for (let i = 0; i < 18; i++) {
    const isFrontDial = i < 9;
    // sidePrefix: same XOR semantics as Java ((clock<9) ^ rightSideUp)
    const sidePrefix = (isFrontDial !== rightSideUp) ? 'Back' : 'Front';
    const baseX = isFrontDial ? RADIUS + GAP : 3 * (RADIUS + GAP);
    const baseY = RADIUS + GAP;
    const localIdx = isFrontDial ? i : i - 9;
    const dx = 2 * ((localIdx % 3) - 1) * CLOCK_OUTER_RADIUS;
    const dy = 2 * (Math.floor(localIdx / 3) - 1) * CLOCK_OUTER_RADIUS;
    const acx = baseX + dx;
    const acy = baseY + dy;
    const handBorder = get(sidePrefix + 'HandBorder');
    const hand = get(sidePrefix + 'Hand');
    // Border (stroked + filled with border color), then hand (fill on top, no stroke)
    parts.push(
      `<g transform="translate(${acx},${acy}) rotate(${posit[i] * 30})">` +
        `<path d="${arrowPath}" stroke="${handBorder}" stroke-width="${STROKE_WIDTH}" fill="${handBorder}" stroke-linejoin="round" />` +
        `<circle cx="0" cy="0" r="${ARROW_RADIUS}" stroke="${handBorder}" stroke-width="${STROKE_WIDTH}" fill="${handBorder}" />` +
        `<path d="${arrowPath}" fill="${hand}" />` +
        `<circle cx="0" cy="0" r="${ARROW_RADIUS}" fill="${hand}" />` +
      `</g>`,
    );
  }

  // 8 pins. Front face (left half) shows BACK pins when rightSideUp (see tnoodle).
  for (const corner of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const [j, i] = corner;
    parts.push(
      `<circle cx="${(RADIUS + GAP) + j * CLOCK_OUTER_RADIUS}" cy="${(RADIUS + GAP) + i * CLOCK_OUTER_RADIUS}" r="${PIN_RADIUS}" fill="${get(rightSideUp ? 'BackPin' : 'FrontPin')}" />`,
    );
  }
  for (const corner of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const [j, i] = corner;
    parts.push(
      `<circle cx="${3 * (RADIUS + GAP) + j * CLOCK_OUTER_RADIUS}" cy="${(RADIUS + GAP) + i * CLOCK_OUTER_RADIUS}" r="${PIN_RADIUS}" fill="${get(rightSideUp ? 'FrontPin' : 'BackPin')}" />`,
    );
  }

  // No explicit width/height → caller's container dimensions win, so the
  // same SVG works for the live preview (small) and the PDF (large) alike.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" stroke-linecap="round" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">${parts.join('')}</svg>`;
}

/** Convenience: scramble string + colors → final SVG. */
export function renderClockScrambleSvg(scramble: string, colors: Record<string, string>): string {
  return renderClockSvg(applyClockScramble(scramble), colors);
}
