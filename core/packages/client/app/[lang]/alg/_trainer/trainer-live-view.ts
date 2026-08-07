import type { TrainerCubeView } from './useTrainerCube';

export type TrainerLiveVisual = 'idle' | '3d' | 'qcube' | 'qlast' | 'q2look';

/**
 * A selected live projection must appear immediately. Flat projections need
 * facelets; Virtual can render the current case before the first turn.
 */
export function pickTrainerLiveVisual(
  view: TrainerCubeView,
  hasFacelets: boolean,
): TrainerLiveVisual {
  if (view === 'none') return 'idle';
  if (view === '3d') return '3d';
  if (hasFacelets) return view;
  return 'idle';
}
