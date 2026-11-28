import { SIZE } from '../engine/define';
import Cube from '../engine/nxn/cube';
import type { RotateAction } from '../engine/nxn/group';
import { TwistAction } from '../engine/nxn/twister';
import { mountReplayScene } from './mountReplayScene';

const LAYER_MOVE = /^(?:(\d+)(?:-(\d+))?)?([URFDLB])(w?)(\d*)'?$/;
const OTHER_MOVE = /^([urfdlbMESmesxyzXYZ])(\d*)'?$/;
const QUARTER_TURN = Math.PI / 2;

/** Accept individual NxN move tokens with layers that fit the selected cube. */
export function supportsReplayMove(move: string, order = 3): boolean {
  const face = LAYER_MOVE.exec(move);
  if (face) {
    const [, start, end, , wide, amount] = face;
    const first = Number(start ?? (wide ? 2 : 1));
    const last = Number(end ?? first);
    return first >= 1 && first <= last && last <= order && Number.isSafeInteger(Number(amount));
  }
  const other = OTHER_MOVE.exec(move);
  if (!other || !Number.isSafeInteger(Number(other[2]))) return false;
  if (/[MESmes]/.test(other[1])) return order >= 3;
  return /[xyzXYZ]/.test(other[1]) || order >= 2;
}

export interface ReplayCube {
  /** Restore the solved pose and apply the given move tokens. */
  setup(steps: readonly string[]): void;
  /** Set the visible fraction of a turn without changing the settled state. */
  animate(move: string, fraction: number): void;
  /** Apply a completed turn even if no intermediate frame was shown. */
  commit(move: string): void;
  /** Last completed state, in URFDLB face order with row-major stickers. */
  getFacelets(): string;
  dispose(): void;
}

/** Mount the NxN or shape-mod model with per-player controlled slice angles. */
export function mountReplayCube(host: HTMLElement, {
  order = 3,
  shape = false,
  interactive = true,
}: { order?: number; shape?: boolean | 'sphere'; interactive?: boolean } = {}): ReplayCube & { capture(size: number): HTMLCanvasElement } {
  const cube = new Cube(order, shape, { useStackKernel: order >= 16 });
  try {
    const scene = mountReplayScene(host, cube, { interactive, framingSize: SIZE * order });
    let disposed = false;
    let active: { move: string; slices: RotateAction[] } | undefined;
    function slicesFor(move: string): RotateAction[] {
      if (!supportsReplayMove(move, order)) throw new Error(`Unsupported ${order}×${order} move: ${move}`);
      const action = new TwistAction(move);
      action.times %= 4;
      if (action.times === 3) { action.times = 1; action.reverse = !action.reverse; }
      return action.times === 0 ? [] : cube.table.convert(action);
    }

    function releaseTurn(): void {
      if (!active) return;
      for (const { group } of active.slices) group.twist(0, true);
      active = undefined;
    }

    return {
      setup(steps) {
        if (disposed) return;
        releaseTurn();
        cube.twister.setupFromRest(steps.join(' '));
        scene.invalidate();
      },
      animate(move, fraction) {
        if (disposed || !Number.isFinite(fraction)) return;
        if (active?.move !== move) {
          const slices = slicesFor(move);
          releaseTurn();
          active = { move, slices };
          for (const { group } of slices) group.drag();
        }
        const progress = Math.max(0, Math.min(1, fraction));
        for (const { group, twist } of active.slices) group.angle = twist * QUARTER_TURN * progress;
        scene.invalidate();
      },
      commit(move) {
        if (disposed) return;
        const slices = active?.move === move ? active.slices : slicesFor(move);
        if (active?.move !== move) releaseTurn();
        for (const { group, twist } of slices) group.twist(twist * QUARTER_TURN, true);
        active = undefined;
        scene.invalidate();
      },
      capture: scene.capture,
      getFacelets: () => cube.serialize(),
      dispose() {
        if (disposed) return;
        disposed = true;
        try { cube.dispose(); } finally { scene.dispose(); }
      },
    };
  } catch (error) {
    cube.dispose();
    throw error;
  }
}
