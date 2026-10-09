import { createTimerAsyncScramblePool } from './async-scramble-pool';
import { timerScrambleCapability, type TimerScrambleRequest, type TimerScrambleResult } from './scramble-runtime';

/** One visible generation context, bounded buffering, no seed/settings/storage access. */
export function createTimerRandomScramblePool(generate: (
  request: TimerScrambleRequest, signal: AbortSignal,
) => Promise<TimerScrambleResult>) {
  let activeKey = '';
  const pool = createTimerAsyncScramblePool<string>({
    targetSize: 2,
    requestTimeoutMs: 120_000,
    generate: async (key, signal) => {
      const request = JSON.parse(key) as TimerScrambleRequest;
      const result = await generate(request, signal);
      if (result.event !== request.event || !result.ok || result.kind !== 'generated' || !result.scramble.trim()) {
        throw new Error('Random scramble generation failed');
      }
      return JSON.stringify(result);
    },
  });
  const prepare = (request: TimerScrambleRequest) => {
    // Explicit fields keep the actual pool key independent of object property order.
    const key = JSON.stringify({ event: request.event, cnMode: request.cnMode ?? 'none',
      scramble222Mode: request.scramble222Mode ?? 'optimal', scramble222Type: request.scramble222Type ?? 'full',
      trainerCaseIds: request.trainerCaseIds ?? [] });
    if (key !== activeKey) { pool.reset(); activeKey = key; }
    return key;
  };
  const manual = (request: TimerScrambleRequest): TimerScrambleResult | null =>
    timerScrambleCapability(request.event)?.kind === 'manual'
      ? { ok: true, kind: 'manual', event: request.event, scramble: '' } : null;
  const decode = (value: string): TimerScrambleResult | null => value ? JSON.parse(value) as TimerScrambleResult : null;
  return {
    take(request: TimerScrambleRequest): TimerScrambleResult | null {
      const key = prepare(request);
      return manual(request) ?? decode(pool.take(key));
    },
    async next(request: TimerScrambleRequest, signal?: AbortSignal): Promise<TimerScrambleResult> {
      if (signal?.aborted) return { ok: false, event: request.event, code: 'generation-failed', retryable: true };
      const key = prepare(request);
      return manual(request) ?? decode(await pool.next(key, signal))
        ?? { ok: false, event: request.event, code: 'generation-failed', retryable: true };
    },
    reset() { activeKey = ''; pool.reset(); },
  };
}
