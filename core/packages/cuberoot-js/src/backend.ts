import {
  DEFAULT_CUSTOM_CUTS,
  NXN_ORDER_DEFAULT,
  NXN_ORDER_MAX,
  NXN_ORDER_MIN,
  PG_DEF_BY_ID,
  SIM_PUZZLE_IDS,
  simPuzzleBackend,
} from '@cuberoot/puzzle-solvers/sim-puzzles';
import { mountReplayCube } from '@cuberoot/puzzle-render-core/replay/mountReplayCube';
import { parseNxNReplay } from './algorithm.js';

export const supportedPuzzles: readonly string[] = Object.freeze([...SIM_PUZZLE_IDS]);

interface ReplayRenderer {
  dispose(): void;
  validate?(steps: readonly string[]): void;
  getFacelets?(): string;
}

interface TurnRenderer extends ReplayRenderer {
  setup(steps: readonly string[]): void;
  animate(move: string, fraction: number): void;
  commit(move: string): void;
}

interface TimelineRenderer extends ReplayRenderer {
  timeline: {
    setSequence(setup: readonly string[], moves: readonly string[]): void;
    seek(step: number, fraction: number): void;
  };
}

export type Renderer = (TurnRenderer | TimelineRenderer) & { parse(input: string): string[] };

type PuzzleConfig =
  | { kind: 'nxn'; puzzle: string | number; order: number; shape?: true | 'sphere' }
  | { kind: 'native'; puzzle: string }
  | { kind: 'pg'; puzzle: string; puzzleDescription?: string };

export function resolvePuzzle(options: {
  puzzle?: string | number;
  order?: number;
  puzzleDescription?: string;
}): PuzzleConfig {
  const { puzzleDescription, order } = options;
  const input = options.puzzle ?? (puzzleDescription === undefined ? 'nxn' : 'custom');
  const id = typeof input === 'string' ? input.trim().toLowerCase() : input;
  if (id === 'nxn' || typeof id === 'number' || /^\d/.test(id)) {
    const textSize = typeof id === 'string' ? /^(\d+)(?:[x×]\1(?:[x×]\1)?)?$/.exec(id)?.[1] : id;
    const size = id === 'nxn' ? order ?? NXN_ORDER_DEFAULT : Number(textSize);
    if (!Number.isInteger(size) || size < NXN_ORDER_MIN || size > NXN_ORDER_MAX) {
      throw new RangeError(`NxN order must be an integer from ${NXN_ORDER_MIN} to ${NXN_ORDER_MAX}`);
    }
    if (order !== undefined && size !== order) throw new RangeError('Puzzle and order specify different NxN sizes');
    if (puzzleDescription !== undefined) throw new TypeError('puzzleDescription requires the custom puzzle');
    return { kind: 'nxn', puzzle: size, order: size };
  }

  if (order !== undefined) throw new TypeError('order is only available for NxN puzzles');
  if (puzzleDescription !== undefined && id !== 'custom') throw new TypeError('puzzleDescription requires the custom puzzle');
  switch (simPuzzleBackend(id)) {
    case 'nxn':
      return { kind: 'nxn', puzzle: id, order: id === 'mirror2' ? 2 : 3, shape: id === 'sphere' ? 'sphere' : true };
    case 'native':
      return { kind: 'native', puzzle: id };
    case 'pg':
      return { kind: 'pg', puzzle: id, puzzleDescription: PG_DEF_BY_ID[id] };
    case 'named':
      return { kind: 'pg', puzzle: id };
    case 'custom':
      return { kind: 'pg', puzzle: id, puzzleDescription: puzzleDescription ?? DEFAULT_CUSTOM_CUTS };
    default:
      throw new RangeError(`Unsupported puzzle: ${input}`);
  }
}

export function mountNxN(host: HTMLElement, config: Extract<PuzzleConfig, { kind: 'nxn' }>, interactive: boolean): Renderer {
  const { order, shape } = config;
  return {
    ...mountReplayCube(host, { order, shape, interactive }),
    parse: input => parseNxNReplay(input, order),
  };
}

export async function mountOtherPuzzle(
  host: HTMLElement,
  config: Exclude<PuzzleConfig, { kind: 'nxn' }>,
  interactive: boolean,
  signal: AbortSignal,
): Promise<Renderer> {
  if (config.kind === 'pg') {
    const { mountPgReplay } = await import('@cuberoot/puzzle-render-core/replay/mountPgReplay');
    signal.throwIfAborted();
    return mountPgReplay(host, { puzzle: config.puzzle, puzzleDescription: config.puzzleDescription, interactive, signal });
  }
  const { isNativeReplayPuzzle, mountNativeReplay, parseNativeReplay } = await import('@cuberoot/puzzle-render-core/replay/native');
  signal.throwIfAborted();
  const puzzle = config.puzzle;
  if (!isNativeReplayPuzzle(puzzle)) throw new RangeError(`Unsupported native puzzle: ${puzzle}`);
  return {
    ...mountNativeReplay(host, puzzle, interactive),
    parse: input => parseNativeReplay(puzzle, input),
  };
}
