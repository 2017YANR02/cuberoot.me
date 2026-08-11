export type SplitLaneId = 'a' | 'b';
export type SplitOrder = 'shuffle' | 'seq';
export type SplitBatchSize = 1 | 3;

export interface SplitLaneState {
  keys: string[];
  completed: number;
}

export interface SplitRoundState {
  lanes: Record<SplitLaneId, SplitLaneState>;
  remaining: string[];
  completed: number;
  total: number;
  round: number;
  batchSize: SplitBatchSize;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function deal(queue: string[], batchSize: SplitBatchSize): {
  a: string[];
  b: string[];
  remaining: string[];
} {
  const initial = queue.slice(0, batchSize * 2);
  return {
    a: initial.filter((_, index) => index % 2 === 0),
    b: initial.filter((_, index) => index % 2 === 1),
    remaining: queue.slice(batchSize * 2),
  };
}

function interleave(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index]) out.push(a[index]);
    if (b[index]) out.push(b[index]);
  }
  return out;
}

/** Build one local two-lane coverage round. A and B always hold distinct cases. */
export function startSplitRound(
  pool: string[],
  order: SplitOrder,
  random: () => number = Math.random,
  round = 1,
  batchSize: SplitBatchSize = 1,
): SplitRoundState {
  const unique = [...new Set(pool.filter(Boolean))];
  const queue = order === 'shuffle' ? shuffled(unique, random) : unique;
  const { a, b, remaining } = deal(queue, batchSize);
  return {
    lanes: {
      a: { keys: a, completed: 0 },
      b: { keys: b, completed: 0 },
    },
    remaining,
    completed: 0,
    total: queue.length,
    round,
    batchSize,
  };
}

/** Complete one lane's visible batch and immediately assign the next unclaimed batch. */
export function advanceSplitLane(state: SplitRoundState, lane: SplitLaneId): SplitRoundState {
  const finished = state.lanes[lane].keys.length;
  if (finished === 0) return state;
  const next = state.remaining.slice(0, state.batchSize);
  const remaining = state.remaining.slice(state.batchSize);
  return {
    ...state,
    lanes: {
      ...state.lanes,
      [lane]: {
        keys: next,
        completed: state.lanes[lane].completed + finished,
      },
    },
    remaining,
    completed: state.completed + finished,
  };
}

/** Re-deal unfinished cases when Three at once changes, without losing round progress. */
export function resizeSplitRound(
  state: SplitRoundState,
  batchSize: SplitBatchSize,
): SplitRoundState {
  if (state.batchSize === batchSize) return state;
  const unfinished = [
    ...interleave(state.lanes.a.keys, state.lanes.b.keys),
    ...state.remaining,
  ];
  const { a, b, remaining } = deal(unfinished, batchSize);
  return {
    ...state,
    lanes: {
      a: { ...state.lanes.a, keys: a },
      b: { ...state.lanes.b, keys: b },
    },
    remaining,
    batchSize,
  };
}

export function splitRoundDone(state: SplitRoundState): boolean {
  return state.completed === state.total
    && state.lanes.a.keys.length === 0
    && state.lanes.b.keys.length === 0;
}
