/**
 * Square-1 placeholder.
 *
 * Sq1 simulation is non-trivial (12 wedges per layer in two orbits; slice
 * cuts depend on alignment). For this MVP we render a "preview not
 * available" tile.
 */

import type { JSX } from 'react';

interface Sq1NetProps {
  scramble?: string;
  size?: number;
  className?: string;
}

export default function Sq1Net(props: Sq1NetProps): JSX.Element {
  const size = props.size ?? 14;
  const w = size * 8;
  const h = size * 5;
  void props.scramble;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label="square-1 preview not available"
    >
      <rect x={0} y={0} width={w} height={h} fill="#222" rx={4} />
      <text
        x={w / 2}
        y={h / 2}
        fill="#aaa"
        fontSize={Math.round(size * 0.9)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="ui-sans-serif,system-ui,sans-serif"
      >
        Sq-1 preview N/A
      </text>
    </svg>
  );
}
