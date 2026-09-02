import { describe, expect, it, vi } from 'vitest';
import {
  createTimerAsyncScramblePool,
  createTimerWorkerRpc,
  type TimerWorkerErrorEvent,
  type TimerWorkerMessageEvent,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('timer async scramble pool', () => {
  it('owns target size, in-flight accounting, and strict per-key queues', async () => {
    const calls = new Map<string, number>();
    const pool = createTimerAsyncScramblePool<string>({
      targetSize: 2,
      generate: async (key) => {
        const n = (calls.get(key) ?? 0) + 1;
        calls.set(key, n);
        return `${key}-${n}`;
      },
    });

    expect(pool.take('eg1')).toBe('');
    await flushPromises();
    expect(calls.get('eg1')).toBe(2);
    expect(pool.take('eg1')).toBe('eg1-1');
    expect(pool.take('cll')).toBe('');
    await flushPromises();
    expect(calls.get('cll')).toBe(2);
    expect(pool.take('cll')).toBe('cll-1');
    expect(pool.take('eg1')).toBe('eg1-2');
    pool.dispose();
  });

  it('take + next awaits the existing fill instead of enqueueing request target+1', async () => {
    const resolvers: Array<(value: string) => void> = [];
    let calls = 0;
    const pool = createTimerAsyncScramblePool<string>({
      targetSize: 3,
      generate: () => {
        calls++;
        return new Promise<string>((resolve) => resolvers.push(resolve));
      },
    });

    expect(pool.take('nobar')).toBe('');
    expect(calls).toBe(3);
    const awaited = pool.next('nobar');
    expect(calls).toBe(3);
    // Completion order, not request order, owns the visible slot.
    resolvers[2]('FIRST');
    await expect(awaited).resolves.toBe('FIRST');
    expect(calls).toBe(3);
    pool.dispose();
  });

  it('cancelled same-key waiters cannot consume results needed by the current slot', async () => {
    const resolvers: Array<(value: string) => void> = [];
    const pool = createTimerAsyncScramblePool<string>({
      targetSize: 3,
      generate: () => new Promise<string>((resolve) => resolvers.push(resolve)),
    });
    const aborts = [new AbortController(), new AbortController(), new AbortController()];
    const stale = aborts.map((controller) => pool.next('same-key', controller.signal));
    const current = pool.next('same-key');
    expect(resolvers).toHaveLength(3);

    for (const controller of aborts) controller.abort();
    await expect(Promise.all(stale)).resolves.toEqual(['', '', '']);
    resolvers[0]('CURRENT');
    resolvers[1]('QUEUED-1');
    resolvers[2]('QUEUED-2');
    await expect(current).resolves.toBe('CURRENT');
    expect(pool.take('same-key')).toBe('QUEUED-1');
    pool.dispose();
  });

  it('centralizes timeout + abort and resolves timer placeholders to empty', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | null = null;
      const errors: string[] = [];
      const pool = createTimerAsyncScramblePool<string>({
        targetSize: 1,
        requestTimeoutMs: 25,
        generate: (_key, nextSignal) => {
          signal = nextSignal;
          return new Promise(() => {});
        },
        onError: (error) => errors.push(error.message),
      });
      const result = pool.next('tcllp');
      await vi.advanceTimersByTimeAsync(25);
      await expect(result).resolves.toBe('');
      expect(signal).not.toBeNull();
      expect((signal as unknown as { aborted: boolean }).aborted).toBe(true);
      expect(errors).toEqual(['timer async scramble request timed out: tcllp']);
      pool.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('never queues a stale result after reset', async () => {
    let resolve!: (value: string) => void;
    const pool = createTimerAsyncScramblePool<string>({
      targetSize: 1,
      generate: () => new Promise<string>((done) => { resolve = done; }),
    });
    pool.prefetch('ls');
    pool.reset();
    resolve('STALE');
    await flushPromises();
    expect(pool.take('ls')).toBe('');
    pool.dispose();
  });
});

class FakeWorker implements TimerWorkerPort {
  posted: unknown[] = [];
  terminated = 0;
  messageListeners: Array<(event: TimerWorkerMessageEvent) => void> = [];
  errorListeners: Array<(event: TimerWorkerErrorEvent) => void> = [];

  postMessage(message: unknown): void { this.posted.push(message); }
  addEventListener(
    type: 'message' | 'error',
    listener: ((event: TimerWorkerMessageEvent) => void) | ((event: TimerWorkerErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.push(listener as (event: TimerWorkerMessageEvent) => void);
    } else {
      this.errorListeners.push(listener as (event: TimerWorkerErrorEvent) => void);
    }
  }
  terminate(): void { this.terminated++; }
  respond(data: unknown): void {
    for (const listener of this.messageListeners) listener({ data });
  }
  fail(message: string): void {
    for (const listener of this.errorListeners) listener({ message });
  }
}

describe('timer worker RPC', () => {
  it('owns ids, pending responses, and abort-driven worker replacement', async () => {
    const workers: FakeWorker[] = [];
    const rpc = createTimerWorkerRpc<string, string>({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      makeRequest: (id, type) => ({ id, type }),
      label: 'test worker',
    });

    const firstAbort = new AbortController();
    const first = rpc.request('eg2', firstAbort.signal);
    expect(workers[0].posted).toEqual([{ id: 1, type: 'eg2' }]);
    workers[0].respond({ id: 1, ok: true, value: 'R U F' });
    await expect(first).resolves.toBe('R U F');

    const secondAbort = new AbortController();
    const second = rpc.request('cll', secondAbort.signal);
    secondAbort.abort();
    await expect(second).rejects.toThrow('test worker request aborted');
    expect(workers[0].terminated).toBe(1);

    const thirdAbort = new AbortController();
    const third = rpc.request('ls', thirdAbort.signal);
    expect(workers).toHaveLength(2);
    expect(workers[1].posted).toEqual([{ id: 3, type: 'ls' }]);
    workers[0].fail('late error from terminated worker');
    expect(workers[1].terminated).toBe(0);
    workers[1].respond({ id: 3, ok: false, error: 'solver failed' });
    await expect(third).rejects.toThrow('solver failed');
    rpc.dispose();
  });

  it('owns request timeouts instead of duplicating host timers', async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const rpc = createTimerWorkerRpc<string, string>({
        createWorker: () => worker,
        makeRequest: (id, type) => ({ id, type }),
        label: 'timed worker',
      });
      const request = rpc.request('eg1', undefined, 25);
      const rejection = expect(request).rejects.toThrow('timed worker request aborted');
      await vi.advanceTimersByTimeAsync(25);
      await rejection;
      expect(worker.terminated).toBe(1);
      rpc.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects every pending request when one abort terminates their shared worker', async () => {
    const worker = new FakeWorker();
    const rpc = createTimerWorkerRpc<string, string>({
      createWorker: () => worker,
      makeRequest: (id, type) => ({ id, type }),
      label: 'shared worker',
    });
    const controller = new AbortController();
    const first = rpc.request('generation', controller.signal);
    const second = rpc.request('solution');
    const firstRejection = expect(first).rejects.toThrow('shared worker request aborted');
    const secondRejection = expect(second).rejects.toThrow('shared worker request aborted');
    controller.abort();
    await Promise.all([firstRejection, secondRejection]);
    expect(worker.terminated).toBe(1);
    rpc.dispose();
  });

  it('does not create a worker for an aborted request and rejects malformed replies immediately', async () => {
    const workers: FakeWorker[] = [];
    const rpc = createTimerWorkerRpc<string, string>({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      makeRequest: (id, type) => ({ id, type }),
      label: 'validated worker',
    });
    const controller = new AbortController();
    controller.abort();
    await expect(rpc.request('cancelled', controller.signal)).rejects.toThrow(
      'validated worker request aborted',
    );
    expect(workers).toHaveLength(0);

    const request = rpc.request('bad reply');
    workers[0].respond({ id: 1, value: 'missing ok' });
    await expect(request).rejects.toThrow('validated worker returned an invalid response');
    rpc.dispose();
  });
});
