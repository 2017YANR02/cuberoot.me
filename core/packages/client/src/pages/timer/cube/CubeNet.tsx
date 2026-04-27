/**
 * 2D unfolded "T" net of an NxN cube after applying a scramble.
 *
 *           +---+
 *           | U |
 *   +---+---+---+---+
 *   | L | F | R | B |
 *   +---+---+---+---+
 *           | D |
 *           +---+
 */

import type { JSX } from 'react';
import type { EventId } from '../types.ts';
import type { Face } from './moves.ts';
import { applyScramble } from './state.ts';
import { WCA_COLORS, nxnSizeForEvent } from './colors.ts';

const STROKE = '#1a1a1a';
const STROKE_WIDTH = 1;
const GAP = 1;

interface CubeNetProps {
  event: EventId;
  scramble: string;
  size?: number;
  colors?: Partial<Record<Face, string>>;
  className?: string;
}

export default function CubeNet(props: CubeNetProps): JSX.Element {
  const size = props.size ?? 14;
  const palette: Record<Face, string> = {
    ...WCA_COLORS,
    ...(props.colors ?? {}),
  };
  const n = nxnSizeForEvent(props.event) ?? 3;
  const faces = applyScramble(n, props.scramble);

  // Net layout: faces are arranged in a 3-row × 4-col grid of NxN blocks.
  // Row 0: _ U _ _   (col 1)
  // Row 1: L F R B   (cols 0..3)
  // Row 2: _ D _ _   (col 1)
  const blockSize = n * size + (n - 1) * GAP;
  const sectionGap = Math.max(2, Math.round(size * 0.4));
  const cols = 4;
  const rows = 3;
  const totalW = cols * blockSize + (cols - 1) * sectionGap + 2 * STROKE_WIDTH;
  const totalH = rows * blockSize + (rows - 1) * sectionGap + 2 * STROKE_WIDTH;

  // Position helper: returns top-left of a face block.
  function blockOrigin(face: Face): { x: number; y: number } {
    const col = face === 'L' ? 0 : face === 'F' ? 1 : face === 'R' ? 2 : face === 'B' ? 3 : 1;
    const row = face === 'U' ? 0 : face === 'D' ? 2 : 1;
    return {
      x: STROKE_WIDTH + col * (blockSize + sectionGap),
      y: STROKE_WIDTH + row * (blockSize + sectionGap),
    };
  }

  const FACE_ORDER: Face[] = ['U', 'L', 'F', 'R', 'B', 'D'];

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label={`${props.event} cube net preview`}
    >
      {FACE_ORDER.map((face) => {
        const origin = blockOrigin(face);
        const stickers = faces[face];
        return (
          <g key={face}>
            {Array.from({ length: n }).map((_, r) =>
              Array.from({ length: n }).map((_, c) => {
                const sticker = stickers[r * n + c];
                const x = origin.x + c * (size + GAP);
                const y = origin.y + r * (size + GAP);
                return (
                  <rect
                    key={`${face}-${r}-${c}`}
                    x={x}
                    y={y}
                    width={size}
                    height={size}
                    rx={Math.max(1, Math.round(size * 0.12))}
                    ry={Math.max(1, Math.round(size * 0.12))}
                    fill={palette[sticker]}
                    stroke={STROKE}
                    strokeWidth={STROKE_WIDTH}
                  />
                );
              }),
            )}
          </g>
        );
      })}
    </svg>
  );
}
