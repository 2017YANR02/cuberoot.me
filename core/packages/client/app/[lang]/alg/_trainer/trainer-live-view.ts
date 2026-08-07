import type { TrainerCubeView } from './useTrainerCube';

export type TrainerLiveVisual = 'idle' | 'q2look' | '3d';

/**
 * A selected live projection must appear immediately. q2Look needs facelets;
 * 3D can render the current case from the scramble before the first turn.
 */
export function pickTrainerLiveVisual(
  view: TrainerCubeView,
  hasFacelets: boolean,
): TrainerLiveVisual {
  if (view === 'q2look' && hasFacelets) return 'q2look';
  if (view === '3d') return '3d';
  return 'idle';
}
