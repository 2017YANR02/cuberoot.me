import { trainerSpecKey, type TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';
import type { CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';

const TARGET = 3;
const BATCH = 3;
const GEN_BUDGET_MS = 3_000;
const MAX_TRIES = 4;

export type TimerRandomDifficultyStatus =
  | 'idle'
  | 'working'
  | 'ready'
  | 'empty'
  | 'rare'
  | 'error';

export interface TimerRandomDifficultyResult {
  scramble: string;
  spec: TrainerSpec;
  depth: number;
  state: CubieCube;
}

export interface TimerRandomDifficultyBatch {
  verdict: 'ready' | 'empty' | 'budget';
  items: TimerRandomDifficultyResult[];
}

export type TimerRandomDifficultyBatchGenerator = (
  spec: TrainerSpec,
  count: number,
  budgetMs: number,
  signal: AbortSignal,
) => Promise<TimerRandomDifficultyBatch>;

interface Buffer {
  key: string;
  spec: TrainerSpec | null;
  queue: TimerRandomDifficultyResult[];
  empty: boolean;
  rare: boolean;
  error: boolean;
  tries: number;
}

const emptyBuffer = (): Buffer => ({
  key: '',
  spec: null,
  queue: [],
  empty: false,
  rare: false,
  error: false,
  tries: 0,
});

function validResult(
  item: TimerRandomDifficultyResult,
  spec: TrainerSpec,
): boolean {
  return typeof item.scramble === 'string'
    && item.scramble.trim().length > 0
    && trainerSpecKey(item.spec) === trainerSpecKey(spec)
    && Number.isSafeInteger(item.depth)
    && item.depth >= spec.lo
    && item.depth <= spec.hi
    && item.state.cp.length === 8
    && item.state.co.length === 8
    && item.state.ep.length === 12
    && item.state.eo.length === 12;
}

export function createTimerRandomDifficultyPool(
  generateBatch: TimerRandomDifficultyBatchGenerator,
) {
  let buffer = emptyBuffer();
  let pumping = false;
  let active: AbortController | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const want = (spec: TrainerSpec): Buffer => {
    const key = trainerSpecKey(spec);
    if (buffer.key !== key) {
      active?.abort();
      buffer = { ...emptyBuffer(), key, spec };
      notify();
    } else {
      buffer.spec = spec;
    }
    return buffer;
  };

  const status = (spec: TrainerSpec): TimerRandomDifficultyStatus => {
    if (buffer.key !== trainerSpecKey(spec)) return 'idle';
    if (buffer.queue.length) return 'ready';
    if (buffer.empty) return 'empty';
    if (buffer.rare) return 'rare';
    if (buffer.error) return 'error';
    return 'working';
  };

  const pump = async (): Promise<void> => {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        const target = buffer;
        const spec = target.spec;
        if (!spec || target.empty || target.rare || target.error || target.queue.length >= TARGET) break;
        const request = new AbortController();
        active = request;
        try {
          const batch = await generateBatch(spec, BATCH, GEN_BUDGET_MS, request.signal);
          if (buffer !== target) continue;
          if (!['ready', 'empty', 'budget'].includes(batch.verdict)
            || !Array.isArray(batch.items)
            || !batch.items.every((item) => validResult(item, spec))) {
            throw new Error('invalid random difficulty batch');
          }
          if (batch.items.length) {
            target.tries = 0;
            target.queue.push(...batch.items);
            notify();
            continue;
          }
          if (batch.verdict === 'empty') {
            target.empty = true;
            notify();
            break;
          }
          target.tries += 1;
          if (target.tries >= MAX_TRIES) {
            target.rare = true;
            notify();
            break;
          }
        } catch {
          if (buffer !== target || request.signal.aborted) continue;
          target.error = true;
          notify();
          break;
        } finally {
          if (active === request) active = null;
        }
      }
    } finally {
      pumping = false;
      if (buffer.spec
        && !buffer.empty
        && !buffer.rare
        && !buffer.error
        && buffer.queue.length < TARGET) void pump();
    }
  };

  const release = (): void => {
    if (!buffer.key) return;
    active?.abort();
    buffer = emptyBuffer();
    notify();
  };

  const peek = (spec: TrainerSpec): TimerRandomDifficultyResult | null => {
    const result = want(spec).queue.shift() ?? null;
    void pump();
    return result;
  };

  const prefetch = (spec: TrainerSpec): void => {
    want(spec);
    void pump();
  };

  const wait = (spec: TrainerSpec): Promise<TimerRandomDifficultyStatus> => {
    const target = want(spec);
    void pump();
    const settled = (): TimerRandomDifficultyStatus | null => {
      if (buffer !== target) return 'idle';
      const current = status(spec);
      return current === 'working' ? null : current;
    };
    const now = settled();
    if (now) return Promise.resolve(now);
    return new Promise((resolve) => {
      const listener = () => {
        const current = settled();
        if (!current) return;
        listeners.delete(listener);
        resolve(current);
      };
      listeners.add(listener);
    });
  };

  const retry = (spec: TrainerSpec): void => {
    if (buffer.key !== trainerSpecKey(spec)) return;
    buffer.rare = false;
    buffer.error = false;
    buffer.tries = 0;
    void pump();
  };

  const reset = (): void => {
    active?.abort();
    buffer = emptyBuffer();
    listeners.clear();
  };

  return {
    onChange(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    peek,
    prefetch,
    release,
    reset,
    retry,
    status,
    wait,
  };
}
