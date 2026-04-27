/**
 * Megaminx "petals" preview (stub — no simulation).
 *
 * Megaminx has 12 pentagonal faces arranged as two flower-like halves of
 * 6 pentagons each. We render the canonical net: a central pentagon with
 * 5 petals around it, twice (top and bottom hemispheres). Each pentagon
 * shows the 11 stickers of a megaminx face (1 center + 5 corner-edge +
 * 5 outer-corner) — but for simplicity we draw each face as a single
 * coloured pentagon (solved state).
 */

import type { JSX } from 'react';

const MEGA_COLORS: string[] = [
  '#FFFFFF', // white (top center)
  '#0046AD', // blue
  '#B71234', // red
  '#009B48', // green
  '#FF5800', // orange
  '#FFD500', // yellow
  '#888888', // gray (bottom center)
  '#7F00FF', // purple
  '#A0E000', // lime
  '#FFC0CB', // pink
  '#00FFFF', // cyan
  '#80471C', // brown
];

interface MegaminxNetProps {
  scramble?: string;
  size?: number;
  className?: string;
}

const STROKE = '#1a1a1a';

function pentagonPoints(cx: number, cy: number, r: number, rotDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = ((-90 + rotDeg) + i * 72) * Math.PI / 180;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(' ');
}

export default function MegaminxNet(props: MegaminxNetProps): JSX.Element {
  const size = props.size ?? 14;
  const r = size * 2.4; // pentagon radius
  // Two flowers, each: center + 5 petals at radius 2r * cos(36°) ≈ 1.62r... let's just space them.
  const flowerR = r * 1.85;
  const flowerW = flowerR * 2 + r * 2; // overall flower bounding box width
  const padding = r * 0.6;
  const totalW = flowerW * 2 + padding * 3;
  const totalH = flowerW + padding * 2;

  function flower(cx: number, cy: number, colors: string[]): JSX.Element[] {
    // colors[0] = center, colors[1..5] = petals starting at top, going CW.
    const petals: JSX.Element[] = [];
    petals.push(
      <polygon
        key="center"
        points={pentagonPoints(cx, cy, r, 0)}
        fill={colors[0]}
        stroke={STROKE}
        strokeWidth={1}
      />,
    );
    for (let i = 0; i < 5; i++) {
      const ang = (-90 + i * 72) * Math.PI / 180;
      const px = cx + flowerR * Math.cos(ang);
      const py = cy + flowerR * Math.sin(ang);
      petals.push(
        <polygon
          key={`petal-${i}`}
          points={pentagonPoints(px, py, r, 180 + i * 72)}
          fill={colors[i + 1]}
          stroke={STROKE}
          strokeWidth={1}
        />,
      );
    }
    return petals;
  }

  void props.scramble;

  const cx1 = padding + flowerW / 2;
  const cx2 = padding * 2 + flowerW + flowerW / 2;
  const cy = padding + flowerW / 2;

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
      {flower(cx1, cy, MEGA_COLORS.slice(0, 6))}
      {flower(cx2, cy, MEGA_COLORS.slice(6, 12))}
    </svg>
  );
}
