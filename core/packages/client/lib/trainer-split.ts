export type SplitLaneId = 'a' | 'b';
export type SplitOrder = 'shuffle' | 'seq';

export interface SplitLaneState {
  key: string | null;
  completed: number;
}

export interface SplitRoundState {
  lanes: Record<SplitLaneId, SplitLaneState>;
  remaining: string[];
  completed: number;
  total: number;
  round: number;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Build one local two-lane coverage round. A and B always hold distinct cases. */
export function startSplitRound(
  pool: string[],
  order: SplitOrder,
  random: () => number = Math.random,
  round = 1,
): SplitRoundState {
  const unique = [...new Set(pool.filter(Boolean))];
  const queue = order === 'shuffle' ? shuffled(unique, random) : unique;
  const [a = null, b = null, ...remaining] = queue;
  return {
    lanes: {
      a: { key: a, completed: 0 },
      b: { key: b, completed: 0 },
    },
    remaining,
    completed: 0,
    total: queue.length,
    round,
  };
}

/** Complete one lane and immediately give that person the next unclaimed case. */
export function advanceSplitLane(state: SplitRoundState, lane: SplitLaneId): SplitRoundState {
  if (!state.lanes[lane].key) return state;
  const [next = null, ...remaining] = state.remaining;
  return {
    ...state,
    lanes: {
      ...state.lanes,
      [lane]: {
        key: next,
        completed: state.lanes[lane].completed + 1,
      },
    },
    remaining,
    completed: state.completed + 1,
  };
}

export function splitRoundDone(state: SplitRoundState): boolean {
  return state.completed === state.total
    && state.lanes.a.key === null
    && state.lanes.b.key === null;
}
