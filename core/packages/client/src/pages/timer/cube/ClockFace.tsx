/**
 * Clock face preview (stub).
 *
 * A clock has 9 dials per side × 2 sides + 4 pegs. WCA scrambles encode
 * dial offsets like "UR2+ DR4-". For preview we render a 3×3 grid of
 * empty clock dials at 12 o'clock — a recognisable placeholder.
 */

import type { JSX } from 'react';

interface ClockFaceProps {
  scramble?: string;
  size?: number;
  className?: string;
}

export default function ClockFace(props: ClockFaceProps): JSX.Element {
  const size = props.size ?? 28;
  const gap = 6;
  const totalW = size * 3 + gap * 2 + 4;
  const totalH = size * 3 + gap * 2 + 4;

  void props.scramble;

  function dial(cx: number, cy: number, key: string): JSX.Element {
    const r = size / 2 - 2;
    return (
      <g key={key}>
        <circle cx={cx} cy={cy} r={r} fill="#f5f5f5" stroke="#333" strokeWidth={1} />
        <line x1={cx} y1={cy} x2={cx} y2={cy - r * 0.7} stroke="#333" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={1.2} fill="#333" />
      </g>
    );
  }

  const dials: JSX.Element[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = 2 + c * (size + gap) + size / 2;
      const cy = 2 + r * (size + gap) + size / 2;
      dials.push(dial(cx, cy, `${r}-${c}`));
    }
  }

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label="clock face preview"
    >
      {dials}
    </svg>
  );
}
