import type { KPattern } from 'cubing/kpuzzle';
import type { Move } from 'cubing/alg';
import type { TwistyPlayer } from '@cuberoot/timer-ui/mount-twisty-player';
import type NxnCube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { axisAngle, multiply, type CubePose } from '@/lib/video-recon/engine/cube-motion';

export const VIDEO_CUBE_ENGINES = ['three', 'cubing'] as const;

export interface VideoCubeViewEngine {
  draw(pose?: CubePose): void;
  dispose(): void;
}

// Recognition uses R/B/U as its positive puzzle axes, and image right/down/depth
// as its camera axes. Both project renderers use R/U/F and look from +Z.
const CAMERA_BASIS = axisAngle([Math.PI, 0, 0]);
const PUZZLE_BASIS_INVERSE = axisAngle([Math.PI / 2, 0, 0]);
const LAYER_AXES = ['x', 'z', 'y'] as const;
const RADIANS_PER_DEGREE = Math.PI / 180;

function renderRotation(pose: CubePose) {
  return multiply(multiply(CAMERA_BASIS, pose.rotation), PUZZLE_BASIS_INVERSE);
}

/** Right-handed angles in the destination puzzle's low-to-high layer order. */
function renderAngles(pose: CubePose) {
  const [low, middle, high] = pose.angles;
  return pose.axis === 1 ? [-high, -middle, -low] : pose.angles;
}

export async function mountVideoThreeView(host: HTMLElement, signal: AbortSignal): Promise<VideoCubeViewEngine> {
  const { mountSimWorld } = await import('@cuberoot/puzzle-render-core/sim/mountSimWorld');
  signal.throwIfAborted();
  const mounted = mountSimWorld({ host, sceneRot: { x: 0, y: 0, z: 0 }, preserveDrawingBuffer: false });
  const cube = mounted.world.cube as NxnCube;
  let moves: CubePose['state']['moves'] | undefined;
  let axis: number | undefined;
  const held = new Set<NxnCube['table']['groups'][string][number]>();

  function releaseLayers() {
    for (const group of held) {
      // These are display offsets. The move log owns all discrete turns.
      group.angle = 0;
      group.drop();
    }
    held.clear();
  }

  return {
    draw(pose) {
      cube.visible = !!pose;
      if (pose) {
        if (pose.axis !== axis || pose.state.moves !== moves) releaseLayers();
        if (pose.state.moves !== moves) {
          cube.twister.setup(pose.state.moves.join(' '));
          moves = pose.state.moves;
        }
        axis = pose.axis;
        const groups = cube.table.groups[LAYER_AXES[axis]];
        renderAngles(pose).forEach((degrees, layer) => {
          const group = groups[layer];
          const angle = -degrees * RADIANS_PER_DEGREE;
          if (Math.abs(angle) < 1e-8) {
            if (held.delete(group)) { group.angle = 0; group.drop(); }
          } else {
            if (!held.has(group)) {
              if (!group.drag()) return;
              held.add(group);
            }
            group.angle = angle;
          }
        });
        cube.quaternion.set(...renderRotation(pose));
        cube.updateMatrix();
      }
      mounted.invalidate();
    },
    dispose() {
      releaseLayers();
      mounted.dispose();
    },
  };
}

type TwistyObject = Awaited<ReturnType<TwistyPlayer['experimentalCurrentThreeJSPuzzleObject']>>;
type TwistyPosition = {
  pattern: KPattern;
  movesInProgress: { move: Move; direction: 1; fraction: number }[];
};

function canSetPosition(object: TwistyObject): object is TwistyObject & { onPositionChange(position: TwistyPosition): void } {
  return 'onPositionChange' in object && typeof object.onPositionChange === 'function';
}

/** Cube3D applies smootherstep internally, so invert it to draw the measured angle. */
function fractionForAngle(fraction: number) {
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

export async function mountVideoCubingView(host: HTMLElement, signal: AbortSignal): Promise<VideoCubeViewEngine> {
  const [{ mountTwistyPlayer }, { cube3x3x3 }, { Move }] = await Promise.all([
    import('@cuberoot/timer-ui/mount-twisty-player'), import('cubing/puzzles'), import('cubing/alg'),
  ]);
  signal.throwIfAborted();
  const mounted = await mountTwistyPlayer(host, {
    puzzle: '3x3x3', visualization: '3D', controlPanel: 'none', background: 'none',
    hintFacelets: 'none', backView: 'none', cameraLatitude: 0, cameraLongitude: 0,
    experimentalDragInput: 'none', experimentalMovePressInput: 'none',
  }, { signal });

  try {
    const { player } = mounted;
    // The fixed player stays paused. We drive the already loaded Cube3D directly
    // because its own timestamp represents alg playback, not camera time.
    const [object, kpuzzle, vantages] = await Promise.all([
      player.experimentalCurrentThreeJSPuzzleObject(), cube3x3x3.kpuzzle(), player.experimentalCurrentVantages(),
      player.experimentalModel.legacyPosition.get(),
    ]);
    signal.throwIfAborted();
    if (!canSetPosition(object)) throw new Error('cubing.js Cube3D cannot display timed poses');

    // Slot order matches the CubeRoot renderer. A prime on the positive faces
    // and on S turns each layer about its positive coordinate axis.
    const positiveMoves = {
      x: [new Move('L'), new Move('M'), new Move("R'")],
      y: [new Move('D'), new Move('E'), new Move("U'")],
      z: [new Move('B'), new Move("S'"), new Move("F'")],
    };
    const solved = kpuzzle.defaultPattern();
    let moves: CubePose['state']['moves'] | undefined;
    let pattern = solved;
    return {
      draw(pose) {
        object.visible = !!pose;
        if (pose) {
          if (moves !== pose.state.moves) {
            pattern = solved.applyAlg(pose.state.moves.join(' '));
            moves = pose.state.moves;
          }
          const layers = positiveMoves[LAYER_AXES[pose.axis]];
          const movesInProgress = renderAngles(pose).flatMap((degrees, layer) => {
            if (Math.abs(degrees) < 1e-6) return [];
            const quarterTurns = Math.ceil(Math.abs(degrees) / 90);
            return [{
              move: layers[layer].modified({ amount: layers[layer].amount * Math.sign(degrees) * quarterTurns }),
              direction: 1 as const,
              fraction: fractionForAngle(Math.abs(degrees) / (90 * quarterTurns)),
            }];
          });
          object.quaternion.set(...renderRotation(pose));
          object.updateMatrix();
          object.onPositionChange({ pattern, movesInProgress });
        }
        for (const vantage of vantages) vantage.scheduleRender();
      },
      dispose: mounted.dispose,
    };
  } catch (cause) {
    mounted.dispose();
    throw cause;
  }
}
