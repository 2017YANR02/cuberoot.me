import {
  clockMovesToString,
  parseClockMoves,
  withClockFlipParity,
  type ClockMove,
} from '@cuberoot/puzzle-solvers/clock';

const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** One playback step: a dial turn or the standalone y2 flip token. */
export type ClockStep =
  | { kind: 'move'; move: ClockMove }
  | { kind: 'flip' };

/**
 * Serialize one history step without changing the face context of later tokens.
 * `frame` is the face shown when the step was recorded.
 */
export function clockStepToken(step: ClockStep, frame: 0 | 1): string {
  if (step.kind === 'flip') return 'y2';
  const text = clockMovesToString([step.move]);
  const bare = step.move.side === 1 ? text.slice(3) : text;
  return step.move.side === frame ? bare : `y2 ${bare} y2`;
}

/** Parse a Clock algorithm while preserving y2 as an independent playback step. */
export function parseClockSteps(alg: string): ClockStep[] {
  const moves = parseClockMoves(alg);
  const out: ClockStep[] = [];
  let i = 0;
  for (const raw of alg.trim().split(/\s+/).filter(Boolean)) {
    if (raw === 'y2') {
      out.push({ kind: 'flip' });
      continue;
    }
    if (/^[UDud]{4}$/.test(raw)) continue;
    out.push({ kind: 'move', move: moves[i++] });
  }
  return out;
}

/** Serialize playback steps into canonical Clock notation. */
export function clockStepsToString(steps: readonly ClockStep[]): string {
  const moves = steps.filter((step): step is { kind: 'move'; move: ClockMove } => step.kind === 'move');
  const endsFlipped = steps.filter((step) => step.kind === 'flip').length % 2 === 1;
  return withClockFlipParity(clockMovesToString(moves.map((step) => step.move)), endsFlipped);
}

/** Convert a gesture from the two-sided board into a context-neutral token sequence. */
export function clockGestureToken(move: ClockMove): string {
  const text = clockMovesToString([move]);
  return move.side === 0 ? text : `${text} y2`;
}

/** Reverse a Clock step sequence. */
export function invertClockSteps(steps: readonly ClockStep[]): ClockStep[] {
  return steps.slice().reverse().map((step) => (
    step.kind === 'flip'
      ? step
      : { kind: 'move' as const, move: { ...step.move, amount: mod12(-step.move.amount) } }
  ));
}
