import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TimerRealScrambleRetrySchedule } from '@cuberoot/shared/timer';

import { startRealScrambleFetchRetry } from './real-scramble-retry';

function controlledScheduler() {
  const tasks: Array<{ callback: () => void; cancelled: boolean; delayMs: number }> = [];
  const schedule: TimerRealScrambleRetrySchedule = (callback, delayMs) => {
    const task = { callback, cancelled: false, delayMs };
    tasks.push(task);
    return () => { task.cancelled = true; };
  };
  return { schedule, tasks };
}

async function flushAttempt(): Promise<void> {
  for (let turn = 0; turn < 6; turn++) await Promise.resolve();
}

function real333Response(): Response {
  return new Response(JSON.stringify({
    scrambles: [{
      scramble: "R U R'",
      ci: 'Example2026',
      cn: 'Example Open 2026',
      e: '333',
      r: '1',
      g: 'A',
      n: 1,
      x: 0,
    }],
  }), { status: 200 });
}

describe('mobile real-scramble retry adapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes a proven all-time closed set through the retry boundary', async () => {
    const onClosedSet = vi.fn();
    const run = startRealScrambleFetchRetry('333', {
      fetcher: vi.fn(async () => real333Response()) as unknown as typeof fetch,
      onClosedSet,
    });

    await expect(run.result).resolves.toMatchObject({ kind: 'ready' });
    expect(onClosedSet).toHaveBeenCalledOnce();
    expect(onClosedSet.mock.calls[0][0]).toMatchObject([{
      competitionId: 'Example2026',
      scrambleNumber: 1,
    }]);
  });

  it('passes the exact 2x2 optimal/type source spec through every fetch batch', async () => {
    const { schedule, tasks } = controlledScheduler();
    const noBar = "R' U' F U F R' U2 F U2";
    const item = (optimal: string, n: number) => ({
      scramble: 'R U F',
      o: optimal,
      ci: 'Pocket2026',
      cn: 'Pocket Open 2026',
      e: '222',
      r: '1',
      g: 'A',
      n,
      x: 0,
    });
    const fetcher = vi.fn()
      // Solved has bars, so a no-bar request must keep sampling this same spec.
      .mockResolvedValueOnce(new Response(JSON.stringify({
        scrambles: [item("R R'", 1)],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        scrambles: [item(noBar, 2)],
      }), { status: 200 })) as unknown as typeof fetch;
    const run = startRealScrambleFetchRetry({
      event: '222',
      scramble222Mode: 'optimal',
      scramble222Type: 'nobar',
    }, { fetcher, schedule });

    await expect(run.result).resolves.toMatchObject({
      kind: 'ready',
      attemptIndex: 0,
      value: [{ eventId: '222', scramble: noBar, scrambleNumber: 2 }],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [input, init] of vi.mocked(fetcher).mock.calls) {
      const requested = new URL(input as string);
      expect(requested.searchParams.get('event')).toBe('222');
      expect(requested.searchParams.get('optimal')).toBe('1');
      expect((init as RequestInit | undefined)?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(tasks).toHaveLength(0);
  });

  it.each(['malformed response', 'network rejection'] as const)(
    'classifies %s as transient and uses the shared backoff',
    async (failure) => {
      const { schedule, tasks } = controlledScheduler();
      const fetcher = vi.fn()
        .mockImplementationOnce(() => failure === 'malformed response'
          ? Promise.resolve(new Response(JSON.stringify({ scrambles: 'invalid' }), { status: 200 }))
          : Promise.reject(new TypeError('offline')))
        .mockResolvedValueOnce(real333Response()) as unknown as typeof fetch;
      const run = startRealScrambleFetchRetry('333', { fetcher, schedule });

      await flushAttempt();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ cancelled: false, delayMs: 1_000 });
      tasks[0].callback();

      await expect(run.result).resolves.toMatchObject({
        kind: 'ready',
        attemptIndex: 1,
        value: [{ eventId: '333', scramble: "R U R'" }],
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it('uses shared backoff for a transient HTTP response and keeps the exact event', async () => {
    const { schedule, tasks } = controlledScheduler();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        scrambles: [{
          scramble: "R U2 F'",
          ci: 'Pocket2026',
          cn: 'Pocket Open 2026',
          e: '222',
          r: '1',
          g: 'A',
          n: 1,
          x: 0,
        }],
      }), { status: 200 })) as unknown as typeof fetch;
    const run = startRealScrambleFetchRetry({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'full',
    }, { fetcher, schedule });

    await flushAttempt();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].delayMs).toBe(1_000);
    tasks[0].callback();

    await expect(run.result).resolves.toMatchObject({
      kind: 'ready',
      attemptIndex: 1,
      value: [{ eventId: '222', scramble: "R U2 F'" }],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [input] of vi.mocked(fetcher).mock.calls) {
      const requested = new URL(input as string);
      expect(requested.searchParams.get('event')).toBe('222');
      expect(requested.searchParams.has('optimal')).toBe(false);
    }
  });

  it('classifies HTTP 404 as confirmed empty without scheduling a retry', async () => {
    const { schedule, tasks } = controlledScheduler();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: 'no scrambles for event',
    }), {
      status: 404,
    })) as unknown as typeof fetch;
    const run = startRealScrambleFetchRetry('333', { fetcher, schedule });

    await expect(run.result).resolves.toEqual({
      kind: 'confirmed-empty', attemptIndex: 0,
    });
    expect(tasks).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('times out a never-settling request and advances to the shared backoff', async () => {
    vi.useFakeTimers();
    const { schedule, tasks } = controlledScheduler();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('missing abort signal'));
          return;
        }
        signals.push(signal);
        signal.addEventListener('abort', () => {
          reject(new DOMException('request timed out', 'AbortError'));
        }, { once: true });
      })
    )) as unknown as typeof fetch;
    const run = startRealScrambleFetchRetry('333', {
      fetcher,
      requestTimeoutMs: 25,
      schedule,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(25);
    await flushAttempt();

    expect(signals[0].aborted).toBe(true);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ cancelled: false, delayMs: 1_000 });
    run.cancel();
    await expect(run.result).resolves.toEqual({ kind: 'cancelled' });
    expect(tasks[0].cancelled).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts the active fetch on cancel and never schedules a retry', async () => {
    vi.useFakeTimers();
    const { schedule, tasks } = controlledScheduler();
    let activeSignal: AbortSignal | undefined;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        activeSignal = init?.signal ?? undefined;
        activeSignal?.addEventListener('abort', () => {
          reject(new DOMException('cancelled', 'AbortError'));
        }, { once: true });
      })
    )) as unknown as typeof fetch;
    const run = startRealScrambleFetchRetry('333', {
      fetcher,
      requestTimeoutMs: 30_000,
      schedule,
    });

    expect(activeSignal?.aborted).toBe(false);
    run.cancel();
    expect(activeSignal?.aborted).toBe(true);
    await expect(run.result).resolves.toEqual({ kind: 'cancelled' });
    await flushAttempt();

    expect(tasks).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects unmapped events before fetch or scheduling', () => {
    const { schedule, tasks } = controlledScheduler();
    const fetcher = vi.fn() as unknown as typeof fetch;
    expect(() => startRealScrambleFetchRetry('custom', { fetcher, schedule }))
      .toThrow('real WCA scrambles unsupported for timer event custom');
    expect(fetcher).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });
});
