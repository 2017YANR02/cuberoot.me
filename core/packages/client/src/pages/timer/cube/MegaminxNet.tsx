/** Megaminx net preview — applies Pochmann-notation scramble.
 *
 * Sticker indexing matches megaminx_state.ts (cstimer convention):
 *   stickers[0..4] = 5 corner stickers (at vertices, in order)
 *   stickers[5..9] = 5 edge stickers (between adjacent corners)
 *   stickers[10]   = center
 *
 * Face names use cstimer's 12-face system:
 *   U R F L BL BR  (top hemisphere: U + 5 around U)
 *   DR DL DBL B DBR D  (bottom hemisphere: D + 5 around D)
 */

import type { JSX } from 'react';
import { applyMegaScramble, type MegaFace, type MegaSticker } from './megaminx_state.ts';

const COLORS: Record<MegaFace, string> = {
  U: '#FFFFFF',   // white top
  F: '#009B48',   // green
  R: '#B71234',   // red
  BR: '#7F00FF',  // purple
  BL: '#FFD500',  // yellow
  L: '#0046AD',   // blue
  D: '#888888',   // gray bottom
  B: '#FF5800',   // orange (D's antipode of F)
  DBR: '#A0E000', // lime
  DR: '#FFC0CB',  // pink
  DBL: '#00FFFF', // cyan
  DL: '#80471C',  // brown
};

const STROKE = '#1a1a1a';

interface MegaminxNetProps {
  scramble?: string;
  size?: number;
  className?: string;
}

function pentVertex(cx: number, cy: number, r: number, vertexIdx: number, rotDeg: number): [number, number] {
  // Vertex 0 at top, going CW: idx 0 -> 1 -> ... -> 4.
  const ang = ((-90 + rotDeg) + vertexIdx * 72) * Math.PI / 180;
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
}

function pentPoints(cx: number, cy: number, r: number, rotDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const [x, y] = pentVertex(cx, cy, r, i, rotDeg);
    pts.push(`${x},${y}`);
  }
  return pts.join(' ');
}

/** Draw one megaminx face: center pentagon + 5 trapezoid edges + 5 corner triangles.
 *  stickers[0..4] are the 5 corner stickers (one per vertex);
 *  stickers[5..9] are the 5 edge stickers (between adjacent corners);
 *  stickers[10] is the center. */
function megaFace(
  cx: number,
  cy: number,
  r: number,
  rotDeg: number,
  stickers: MegaSticker[],
  key: string,
): JSX.Element {
  const innerR = r * 0.45;
  const outer: Array<[number, number]> = [];
  const inner: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    outer.push(pentVertex(cx, cy, r, i, rotDeg));
    inner.push(pentVertex(cx, cy, innerR, i, rotDeg));
  }
  const els: JSX.Element[] = [];
  // 5 edge trapezoids (drawn first so corner triangles cover overlap).
  for (let i = 0; i < 5; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % 5];
    const ib = inner[(i + 1) % 5];
    const ia = inner[i];
    els.push(
      <polygon
        key={`${key}-e${i}`}
        points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${ib[0]},${ib[1]} ${ia[0]},${ia[1]}`}
        fill={COLORS[stickers[5 + i]]}
        stroke={STROKE}
        strokeWidth={0.6}
      />,
    );
  }
  // Center pentagon.
  els.push(
    <polygon
      key={`${key}-ctr`}
      points={pentPoints(cx, cy, innerR, rotDeg)}
      fill={COLORS[stickers[10]]}
      stroke={STROKE}
      strokeWidth={0.6}
    />,
  );
  // 5 corner triangles overlaid at each vertex.
  for (let i = 0; i < 5; i++) {
    const v = outer[i];
    const ip = inner[(i - 1 + 5) % 5];
    const ic = inner[i];
    els.push(
      <polygon
        key={`${key}-c${i}`}
        points={`${v[0]},${v[1]} ${ip[0]},${ip[1]} ${ic[0]},${ic[1]}`}
        fill={COLORS[stickers[i]]}
        stroke={STROKE}
        strokeWidth={0.6}
      />,
    );
  }
  return <g key={key}>{els}</g>;
}

export default function MegaminxNet(props: MegaminxNetProps): JSX.Element {
  const size = props.size ?? 14;
  const r = size * 2.4;
  const flowerR = r * 1.85;
  const flowerW = flowerR * 2 + r * 2;
  const padding = r * 0.6;
  const totalW = flowerW * 2 + padding * 3;
  const totalH = flowerW + padding * 2;

  const state = applyMegaScramble(props.scramble ?? '');

  // Two flowers: top hemisphere centered on U, bottom on D.
  // Top petals (around U), in some CW visual order.
  const topPetals: MegaFace[] = ['F', 'R', 'BR', 'BL', 'L'];
  // Bottom petals (around D), in some CW visual order.
  const botPetals: MegaFace[] = ['B', 'DBR', 'DR', 'DL', 'DBL'];

  const cx1 = padding + flowerW / 2;
  const cx2 = padding * 2 + flowerW + flowerW / 2;
  const cy = padding + flowerW / 2;

  const items: JSX.Element[] = [];
  items.push(megaFace(cx1, cy, r, 0, state.U, 'U'));
  for (let i = 0; i < 5; i++) {
    const ang = (-90 + i * 72) * Math.PI / 180;
    const px = cx1 + flowerR * Math.cos(ang);
    const py = cy + flowerR * Math.sin(ang);
    items.push(megaFace(px, py, r, 180 + i * 72, state[topPetals[i]], topPetals[i]));
  }
  items.push(megaFace(cx2, cy, r, 0, state.D, 'D'));
  for (let i = 0; i < 5; i++) {
    const ang = (-90 + i * 72) * Math.PI / 180;
    const px = cx2 + flowerR * Math.cos(ang);
    const py = cy + flowerR * Math.sin(ang);
    items.push(megaFace(px, py, r, 180 + i * 72, state[botPetals[i]], botPetals[i]));
  }

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label="megaminx net preview"
    >
      {items}
    </svg>
  );
}
