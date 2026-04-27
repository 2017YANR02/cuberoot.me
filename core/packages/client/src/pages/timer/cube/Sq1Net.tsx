/** Square-1 preview — applies WCA `(a,b) / ...` notation scramble.
 *
 * Renders two top-down circles (top layer and bottom layer) each split into
 * 12 × 30° wedges. The inner part of each wedge shows the face colour
 * (white/yellow), the outer rim band shows the side colour; corner halves
 * also draw a thin radial line between them to suggest the corner cut.
 */

import type { JSX } from 'react';
import { applySq1Scramble, type FaceColor, type SideColor, type Sq1Slot } from './sq1_state.ts';

const FACE_COLOR: Record<FaceColor, string> = {
  W: '#FFFFFF',
  Y: '#FFD500',
};

const SIDE_COLOR: Record<SideColor, string> = {
  F: '#009B48',
  B: '#0046AD',
  L: '#FF5800',
  R: '#B71234',
};

const STROKE = '#1a1a1a';

interface Sq1NetProps {
  scramble?: string;
  size?: number;
  className?: string;
}

/** Polar → cartesian. Angle 0 = up (12 o'clock); positive = CW. */
function pt(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** SVG path for an annular wedge between angles a0..a1 and radii r0..r1.
 *  Always uses small-arc since wedges are 30°. */
function wedgePath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const [x1, y1] = pt(cx, cy, r1, a0);
  const [x2, y2] = pt(cx, cy, r1, a1);
  const [x3, y3] = pt(cx, cy, r0, a1);
  const [x4, y4] = pt(cx, cy, r0, a0);
  return `M ${x1} ${y1} A ${r1} ${r1} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 0 0 ${x4} ${y4} Z`;
}

function drawLayer(cx: number, cy: number, r: number, slots: Sq1Slot[], keyPrefix: string): JSX.Element[] {
  const els: JSX.Element[] = [];
  // Slot 0 starts at angle 0° (12 o'clock) and goes CW. (Visually the puzzle's
  // "front" is at the bottom of the diagram; with our slot layout this means
  // slot 11 / slot 0 boundary is at the top — corners and edges read CW.)
  const rimWidth = r * 0.22;
  const rInner = r - rimWidth;
  for (let i = 0; i < 12; i++) {
    const a0 = i * 30;
    const a1 = (i + 1) * 30;
    const slot = slots[i];
    // Inner face wedge (top colour).
    els.push(
      <path
        key={`${keyPrefix}-f${i}`}
        d={wedgePath(cx, cy, 0, rInner, a0, a1)}
        fill={FACE_COLOR[slot.topColor]}
        stroke={STROKE}
        strokeWidth={0.5}
      />,
    );
    // Outer rim wedge (side colour).
    els.push(
      <path
        key={`${keyPrefix}-r${i}`}
        d={wedgePath(cx, cy, rInner, r, a0, a1)}
        fill={SIDE_COLOR[slot.sideColor]}
        stroke={STROKE}
        strokeWidth={0.5}
      />,
    );
  }
  // Bold radial lines at the boundary between non-corner-half neighbours
  // (i.e. wherever a corner half meets an edge or another piece's half),
  // to make piece outlines pop.
  for (let i = 0; i < 12; i++) {
    const cur = slots[i];
    const nxt = slots[(i + 1) % 12];
    // Boundary at angle (i+1)*30. Skip if this is a within-corner boundary
    // (cur=CL and nxt=CT — it's the inner cut of one corner piece).
    const within = cur.kind === 'CL' && nxt.kind === 'CT';
    if (within) continue;
    const a = (i + 1) * 30;
    const [x1, y1] = pt(cx, cy, 0, a);
    const [x2, y2] = pt(cx, cy, r, a);
    els.push(
      <line
        key={`${keyPrefix}-b${i}`}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={STROKE}
        strokeWidth={1.0}
      />,
    );
  }
  // Outer circle outline.
  els.push(
    <circle
      key={`${keyPrefix}-o`}
      cx={cx} cy={cy} r={r}
      fill="none"
      stroke={STROKE}
      strokeWidth={1.0}
    />,
  );
  return els;
}

export default function Sq1Net(props: Sq1NetProps): JSX.Element {
  const size = props.size ?? 14;
  const r = size * 2.4;
  const padding = size * 0.5;
  const gap = size * 0.6;
  const totalW = r * 4 + gap + padding * 2;
  const totalH = r * 2 + padding * 2;

  const state = applySq1Scramble(props.scramble ?? '');

  const cx1 = padding + r;
  const cx2 = padding + r * 3 + gap;
  const cy = padding + r;

  const items: JSX.Element[] = [];
  items.push(...drawLayer(cx1, cy, r, state.top, 'top'));
  items.push(...drawLayer(cx2, cy, r, state.bottom, 'bot'));

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label="square-1 preview"
    >
      {items}
    </svg>
  );
}
