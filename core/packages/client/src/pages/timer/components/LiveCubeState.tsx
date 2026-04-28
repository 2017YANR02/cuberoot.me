/**
 * LiveCubeState — corner mirror of the user's smart cube.
 *
 * Composes the active scramble with the moves that have streamed in from BLE
 * since the scramble was set, then hands the result to the existing Cube3D
 * preview. Re-renders happen naturally each time `moves` is appended: the
 * combined scramble string changes, and Cube3D's recolour effect picks it up.
 *
 * Sized small (default 120px) and parked in a corner so it doesn't compete
 * with the main timer face. Auto-rotation is off — this is a verification
 * panel, not eye-candy.
 */

import type { JSX } from 'react';

import type { EventId } from '../types';
import { Cube3D } from '../cube3d';

export interface LiveCubeStateProps {
  event: EventId;
  scramble: string;
  moves: string[];
  size?: number;
}

export default function LiveCubeState(props: LiveCubeStateProps): JSX.Element {
  const { event, scramble, moves, size = 120 } = props;
  const composed = moves.length > 0
    ? `${scramble} ${moves.join(' ')}`
    : scramble;
  return (
    <Cube3D
      event={event}
      scramble={composed}
      size={size}
      autoRotate={false}
    />
  );
}
