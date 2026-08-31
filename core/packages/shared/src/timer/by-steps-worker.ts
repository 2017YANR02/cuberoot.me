import {
  createTimerAsyncScramblePool,
  type TimerAsyncScramblePool,
} from './async-scramble-pool';
import {
  stepMetricSpec,
  timerByStepsFilter,
  timerByStepsIdentity,
  type TimerByStepsFilter,
  type TimerByStepsSettings,
} from './by-steps';
import {
  createTimerWorkerRpc,
  type TimerWorkerPort,
  type TimerWorkerRpc,
  type TimerWorkerRpcResponse,
} from './worker-rpc';

export type TimerNon222StepPuzzle = 'pyra' | 'skewb' | 'ivy' | 'gear';

export interface TimerNon222WorkerFilter extends TimerByStepsFilter {
  event: TimerNon222StepPuzzle;
}

export type TimerNon222WorkerPayload =
  | { kind: 'generate'; filter: TimerNon222WorkerFilter }
  | { kind: 'filter'; filter: TimerNon222WorkerFilter; scrambles: string[] };

export type TimerNon222WorkerRequest = TimerNon222WorkerPayload & { id: number };
export type TimerNon222WorkerValue = string | boolean[];
export type TimerNon222WorkerResponse = TimerWorkerRpcResponse<TimerNon222WorkerValue>;

export interface TimerNon222ByStepsWorkerHostOptions {
  /** Called independently for the generation and real-row filtering transports. */
  createWorker: () => TimerWorkerPort;
  targetSize?: number;
  requestTimeoutMs?: number;
  onError?: (error: Error, identity: string) => void;
}

export interface TimerNon222ByStepsWorkerHost {
  /** Ready value or the Timer's empty loading placeholder. */
  take(event: TimerNon222StepPuzzle, settings: TimerByStepsSettings): string;
  prefetch(event: TimerNon222StepPuzzle, settings: TimerByStepsSettings): void;
  next(
    event: TimerNon222StepPuzzle,
    settings: TimerByStepsSettings,
    signal?: AbortSignal,
  ): Promise<string>;
  filterScrambles(
    event: TimerNon222StepPuzzle,
    scrambles: readonly string[],
    filter: TimerByStepsFilter,
    signal: AbortSignal,
  ): Promise<boolean[]>;
  reset(): void;
  dispose(): void;
}

function filterForGeneration(
  event: TimerNon222StepPuzzle,
  settings: TimerByStepsSettings,
): TimerNon222WorkerFilter | null {
  const filter = timerByStepsFilter(event, 'random', settings);
  return filter ? { event, ...filter } : null;
}

function validFilter(event: TimerNon222StepPuzzle, filter: TimerByStepsFilter): boolean {
  const spec = stepMetricSpec(event, filter.metric);
  return Boolean(
    spec
    && Number.isInteger(filter.lo)
    && Number.isInteger(filter.hi)
    && filter.lo >= spec.range[0]
    && filter.hi <= spec.range[1]
    && filter.lo <= filter.hi,
  );
}

/** Shared queue/RPC policy; browser and Capacitor code only inject Worker constructors. */
export function createTimerNon222ByStepsWorkerHost(
  options: TimerNon222ByStepsWorkerHostOptions,
): TimerNon222ByStepsWorkerHost {
  const generationFilters = new Map<string, TimerNon222WorkerFilter>();
  const generationRpc: TimerWorkerRpc<
    Extract<TimerNon222WorkerPayload, { kind: 'generate' }>,
    string
  > = createTimerWorkerRpc({
    createWorker: options.createWorker,
    makeRequest: (id, payload) => ({ id, ...payload }),
    label: 'Timer non-2x2 by-steps generation Worker',
  });
  const filterRpc: TimerWorkerRpc<
    Extract<TimerNon222WorkerPayload, { kind: 'filter' }>,
    boolean[]
  > = createTimerWorkerRpc({
    createWorker: options.createWorker,
    makeRequest: (id, payload) => ({ id, ...payload }),
    label: 'Timer non-2x2 by-steps filter Worker',
  });

  const pool: TimerAsyncScramblePool<string> = createTimerAsyncScramblePool({
    targetSize: options.targetSize,
    requestTimeoutMs: options.requestTimeoutMs,
    describeKey: (identity) => identity,
    onError: options.onError,
    generate: (identity, signal) => {
      const filter = generationFilters.get(identity);
      if (!filter) return Promise.reject(new Error(`unknown Timer by-steps identity: ${identity}`));
      return generationRpc.request({ kind: 'generate', filter }, signal);
    },
  });

  const register = (
    event: TimerNon222StepPuzzle,
    settings: TimerByStepsSettings,
  ): string => {
    const filter = filterForGeneration(event, settings);
    if (!filter) return '';
    const identity = timerByStepsIdentity(event, 'random', settings);
    generationFilters.set(identity, filter);
    return identity;
  };

  return {
    take(event, settings): string {
      const identity = register(event, settings);
      return identity ? pool.take(identity) : '';
    },
    prefetch(event, settings): void {
      const identity = register(event, settings);
      if (identity) pool.prefetch(identity);
    },
    next(event, settings, signal): Promise<string> {
      const identity = register(event, settings);
      return identity ? pool.next(identity, signal) : Promise.resolve('');
    },
    async filterScrambles(event, scrambles, filter, signal): Promise<boolean[]> {
      if (scrambles.length === 0) return [];
      if (!validFilter(event, filter)) {
        throw new Error(`invalid Timer by-steps filter: ${event}/${filter.metric}/${filter.lo}..${filter.hi}`);
      }
      const value = await filterRpc.request({
        kind: 'filter',
        filter: { event, ...filter },
        scrambles: [...scrambles],
      }, signal);
      if (value.length !== scrambles.length || value.some((entry) => typeof entry !== 'boolean')) {
        throw new Error('Timer non-2x2 by-steps filter Worker returned an invalid result');
      }
      return value;
    },
    reset(): void {
      pool.reset();
      generationFilters.clear();
      generationRpc.reset();
      filterRpc.reset();
    },
    dispose(): void {
      pool.dispose();
      generationFilters.clear();
      generationRpc.dispose();
      filterRpc.dispose();
    },
  };
}
