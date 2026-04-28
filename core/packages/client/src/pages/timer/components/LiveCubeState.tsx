/**
 * LiveCubeState — corner mirror of the user's smart cube.
 *
 * Composes the active scramble with the moves that have streamed in from BLE
 * since the scramble was set, then hands the result to CubePreview (cubing.js
 * `<scramble-display>` under the hood). Re-renders happen naturally each time
 * `moves` is appended: the combined scramble string changes.
 */

import type { JSX } from 'react';

import type { EventId } from '../types';
import { CubePreview } from '../cube';

export interface LiveCubeStateProps {
  event: EventId;
  scramble: string;
  moves: string[];
  size?: number;
}

export default function LiveCubeState(props: LiveCubeStateProps): JSX.Element {
  const { event, scramble, moves, size = 10 } = props;
  const composed = moves.length > 0
    ? `${scramble} ${moves.join(' ')}`
    : scramble;
  return <CubePreview event={event} scramble={composed} size={size} />;
}
