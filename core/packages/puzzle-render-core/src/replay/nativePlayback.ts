import type { Object3D } from 'three';
import type { TweenCube } from '../engine/TweenTwister';
import { applyAnimFrame, type PieceAnim } from '../engine/pieceAnim';
import { mountReplayScene } from './mountReplayScene';

export interface NativeReplay {
  validate(steps: readonly string[]): void;
  setup(steps: readonly string[]): void;
  animate(step: string, fraction: number): void;
  commit(step: string): void;
  dispose(): void;
}

export interface ReplayMoveGroup<Move> {
  token: string;
  moves: readonly Move[];
}

export type ReplayModel<Move> = Object3D & TweenCube<Move> & { dispose(): void };

export interface ReplayModelOptions<Move, Model extends ReplayModel<Move>> {
  parse(text: string): ReplayMoveGroup<Move>[];
  validateMoves?(moves: readonly Move[]): void;
  beginMove?(cube: Model, move: Move): PieceAnim[];
  framingSize?: number;
  sceneRotation?: { x: number; y: number; z: number };
}

export function mountNativeReplayModel<Move, Model extends ReplayModel<Move>>(
  host: HTMLElement,
  cube: Model,
  interactive: boolean,
  options: ReplayModelOptions<Move, Model>,
): NativeReplay {
  let scene: ReturnType<typeof mountReplayScene>;
  try {
    scene = mountReplayScene(host, cube, {
      interactive, framingSize: options.framingSize, sceneRotation: options.sceneRotation, wrapLights: true,
    });
  } catch (error) {
    cube.dispose();
    throw error;
  }

  interface ActiveStep extends ReplayMoveGroup<Move> {
    completed: number;
    plan?: PieceAnim[];
  }

  let active: ActiveStep | undefined;
  let disposed = false;

  function parseSequence(steps: readonly string[]): Move[] {
    const moves = options.parse(steps.filter(step => step !== '.').join(' ')).flatMap(group => group.moves);
    options.validateMoves?.(moves);
    return moves;
  }

  function stepFor(token: string): ActiveStep {
    if (active?.token === token) return active;
    if (active) throw new Error('Complete or reset the current move before starting another');
    const [parsed] = options.parse(token);
    if (!parsed?.moves.length) throw new Error(`Invalid replay step ${token}`);
    active = { ...parsed, token, completed: 0 };
    return active;
  }

  function finishMove(step: ActiveStep): void {
    const move = step.moves[step.completed];
    if (step.plan) cube.finishMove(step.plan, move);
    else cube.applyMoveInstant(move);
    step.completed++;
    step.plan = undefined;
  }

  return {
    validate(steps) { parseSequence(steps); },
    setup(steps) {
      if (disposed) return;
      const moves = parseSequence(steps);
      active = undefined;
      cube.reset();
      cube.history.clear();
      for (const move of moves) cube.applyMoveSilent(move);
      scene.invalidate();
    },
    animate(token, fraction) {
      if (disposed || token === '.' || !Number.isFinite(fraction)) return;
      const step = stepFor(token);
      const progress = Math.max(0, Math.min(1, fraction)) * step.moves.length;
      const target = Math.min(Math.floor(progress), step.moves.length - 1);
      // A compound notation token uses consecutive physical turns within one step.
      // Advancement is monotonic until the caller commits or seeks to a new state.
      while (step.completed < target) finishMove(step);
      const move = step.moves[step.completed];
      step.plan ??= options.beginMove ? options.beginMove(cube, move) : cube.beginMove(move);
      applyAnimFrame(step.plan, progress - step.completed);
      scene.invalidate();
    },
    commit(token) {
      if (disposed || token === '.') return;
      const step = stepFor(token);
      while (step.completed < step.moves.length) finishMove(step);
      active = undefined;
      scene.invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.dispose();
      cube.dispose();
    },
  };
}
