import type { TrainerCubeView } from './useTrainerCube';

export type TrainerLiveVisual = 'idle' | 'q2look' | '3d';

/**
 * q2Look is a selected live projection, so it appears as soon as facelets are
 * available. The 3D view keeps the case-recognition image until the first turn.
 */
export function pickTrainerLiveVisual(
  view: TrainerCubeView,
  hasFacelets: boolean,
  moveCount: number,
): TrainerLiveVisual {
  if (view === 'q2look' && hasFacelets) return 'q2look';
  if (moveCount === 0) return 'idle';
  return '3d';
}
