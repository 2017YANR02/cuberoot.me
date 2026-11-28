import type { KPattern } from 'cubing/kpuzzle';
import type { Move } from 'cubing/alg';
import type { TwistyPlayer } from '@cuberoot/timer-ui/mount-twisty-player';
import { applyTwistyPuzzleCoreOpacity } from '@/components/twistyCoreOpacity';

export const VIDEO_CUBE_ENGINES = ['three', 'cubing'] as const;
export type VideoCubeEngine = typeof VIDEO_CUBE_ENGINES[number];

type TwistyObject = Awaited<ReturnType<TwistyPlayer['experimentalCurrentThreeJSPuzzleObject']>>;
type TwistyPosition = {
  pattern: KPattern;
  movesInProgress: { move: Move; direction: 1; fraction: number }[];
};

function canSetPosition(object: TwistyObject): object is TwistyObject & { onPositionChange(position: TwistyPosition): void } {
  return 'onPositionChange' in object && typeof object.onPositionChange === 'function';
}

/** Cube3D applies smootherstep internally, so invert it to draw the measured angle. */
export function fractionForAngle(fraction: number) {
  if (fraction === 1) return 1;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 16; step++) {
    const midpoint = (low + high) / 2;
    const eased = midpoint ** 3 * (10 - midpoint * (15 - 6 * midpoint));
    if (eased < fraction) low = midpoint;
    else high = midpoint;
  }
  return (low + high) / 2;
}

export async function mountTimedCubingCube(host: HTMLElement, signal: AbortSignal) {
  const [{ mountTwistyPlayer }, { cube3x3x3 }, { Move }] = await Promise.all([
    import('@cuberoot/timer-ui/mount-twisty-player'), import('cubing/puzzles'), import('cubing/alg'),
  ]);
  signal.throwIfAborted();
  const mounted = await mountTwistyPlayer(host, {
    puzzle: '3x3x3', visualization: '3D', controlPanel: 'none', background: 'none',
    hintFacelets: 'none', backView: 'none', cameraLatitude: 0, cameraLongitude: 0,
    experimentalDragInput: 'none', experimentalMovePressInput: 'none',
  }, { signal });

  let rejectAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(signal.reason);
    if (signal.aborted) rejectAbort();
    else signal.addEventListener('abort', rejectAbort, { once: true });
  });
  try {
    const { player } = mounted;
    // The fixed player stays paused. We drive the already loaded Cube3D directly
    // because its own timestamp represents alg playback, not camera time.
    const [object, kpuzzle] = await Promise.race([cancelled, Promise.all([
      player.experimentalCurrentThreeJSPuzzleObject(), cube3x3x3.kpuzzle(),
      player.experimentalModel.legacyPosition.get(),
    ])]);
    const vantages = await player.experimentalCurrentVantages();
    signal.throwIfAborted();
    if (!canSetPosition(object)) throw new Error('cubing.js Cube3D cannot display timed poses');
    let solidFoundation = false;
    function setSolidFoundation(solid: boolean) {
      if (solidFoundation === solid) return;
      applyTwistyPuzzleCoreOpacity(object, solid ? 1 : 0.3);
      solidFoundation = solid;
    }
    return { object, vantages, solved: kpuzzle.defaultPattern(), Move, setSolidFoundation, dispose: mounted.dispose };
  } catch (cause) {
    mounted.dispose();
    throw cause;
  } finally {
    if (rejectAbort) signal.removeEventListener('abort', rejectAbort);
  }
}
