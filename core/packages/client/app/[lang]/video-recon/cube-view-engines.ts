import type NxnCube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { axisAngle, multiply, type CubePose } from '@/lib/video-recon/engine/cube-motion';

import { fractionForAngle, mountTimedCubingCube } from '@/lib/video-recon/timed-cubing-cube';

export interface VideoCubeViewEngine {
  draw(pose?: CubePose): void;
  setSolidFoundation?(solid: boolean): void;
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

export async function mountVideoCubingView(host: HTMLElement, signal: AbortSignal): Promise<VideoCubeViewEngine> {
  const { object, vantages, solved, Move, setSolidFoundation, dispose } = await mountTimedCubingCube(host, signal);

  // Slot order matches the CubeRoot renderer. A prime on the positive faces
  // and on S turns each layer about its positive coordinate axis.
  const positiveMoves = {
    x: [new Move('L'), new Move('M'), new Move("R'")],
    y: [new Move('D'), new Move('E'), new Move("U'")],
    z: [new Move('B'), new Move("S'"), new Move("F'")],
  };
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
    setSolidFoundation,
    dispose,
  };
}
