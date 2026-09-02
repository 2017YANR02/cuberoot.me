import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createTimerNon222ByStepsWorkerHost,
  type TimerByStepsSettings,
  type TimerWorkerErrorEvent,
  type TimerWorkerMessageEvent,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

class FakeWorker implements TimerWorkerPort {
  posted: Array<{ id: number; [key: string]: unknown }> = [];
  terminated = 0;
  private readonly messageListeners: Array<(event: TimerWorkerMessageEvent) => void> = [];
  private readonly errorListeners: Array<(event: TimerWorkerErrorEvent) => void> = [];

  postMessage(message: unknown): void {
    this.posted.push(message as { id: number; [key: string]: unknown });
  }
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
}

function settings(metric: string, lo: number, hi = lo): TimerByStepsSettings {
  return {
    genByStepsOn: true,
    genStepsMetric: metric,
    genSteps: Array.from({ length: hi - lo + 1 }, (_value, index) => lo + index),
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('shared non-2x2 Timer by-steps Worker host', () => {
  it('keeps A/B cache identities separate and exposes an empty loading slot', async () => {
    const workers: FakeWorker[] = [];
    const host = createTimerNon222ByStepsWorkerHost({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      targetSize: 1,
    });
    const pyra = settings('v', 4, 5);
    const gear = settings('ftm', 4, 5);

    expect(host.take('pyra', pyra)).toBe('');
    host.prefetch('gear', gear);
    expect(workers).toHaveLength(1);
    expect(workers[0].posted.map((request) => request.filter)).toEqual([
      { event: 'pyra', metric: 'v', lo: 4, hi: 5 },
      { event: 'gear', metric: 'ftm', lo: 4, hi: 5 },
    ]);
    workers[0].respond({ id: 2, ok: true, value: 'GEAR' });
    workers[0].respond({ id: 1, ok: true, value: 'PYRA' });
    await flushPromises();
    expect(host.take('pyra', pyra)).toBe('PYRA');
    expect(host.take('gear', gear)).toBe('GEAR');
    host.dispose();
  });

  it('handles A to B to A without letting the cancelled A waiter consume current A', async () => {
    const workers: FakeWorker[] = [];
    const host = createTimerNon222ByStepsWorkerHost({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      targetSize: 1,
    });
    const a = settings('htm', 8, 9);
    const b = settings('htm', 5, 6);
    const staleController = new AbortController();
    const staleA = host.next('skewb', a, staleController.signal);
    staleController.abort();
    const visibleB = host.next('ivy', b);
    const currentA = host.next('skewb', a);

    await expect(staleA).resolves.toBe('');
    expect(workers[0].posted).toHaveLength(2);
    workers[0].respond({ id: 2, ok: true, value: 'B-CURRENT' });
    workers[0].respond({ id: 1, ok: true, value: 'A-CURRENT' });
    await expect(visibleB).resolves.toBe('B-CURRENT');
    await expect(currentA).resolves.toBe('A-CURRENT');
    host.dispose();
  });

  it('uses an independent filter transport and aborts stale batch work', async () => {
    const workers: FakeWorker[] = [];
    const host = createTimerNon222ByStepsWorkerHost({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      targetSize: 1,
    });
    host.prefetch('gear', settings('ftm', 4));
    const controller = new AbortController();
    const filtered = host.filterScrambles(
      'pyra',
      ['R U', 'L B'],
      { metric: 'cube', lo: 6, hi: 9 },
      controller.signal,
    );
    expect(workers).toHaveLength(2);
    controller.abort();
    await expect(filtered).rejects.toThrow('request aborted');
    expect(workers[1].terminated).toBe(1);
    expect(workers[0].terminated).toBe(0);
    host.dispose();
  });

  it('reports Worker errors and resolves the Timer loading waiter to empty', async () => {
    const workers: FakeWorker[] = [];
    const errors: string[] = [];
    const host = createTimerNon222ByStepsWorkerHost({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      targetSize: 1,
      onError: (error, identity) => errors.push(`${identity}: ${error.message}`),
    });
    const pending = host.next('gear', settings('ftm', 4, 5));
    workers[0].respond({ id: 1, ok: false, error: 'solver exploded' });
    await expect(pending).resolves.toBe('');
    expect(errors).toEqual(['byst|gear|ftm|4.5: solver exploded']);
    host.dispose();
  });

  it('keeps Web loading, retry, cancellation and stale-slot checks in the host adapter', () => {
    const source = readFileSync(
      new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('const [byStepsLoading, setByStepsLoading] = useState(false)');
    expect(source).toContain('const [byStepsFailed, setByStepsFailed] = useState(false)');
    expect(source).toContain('nextWebNon222ByStepsScramble(requestEvent, requestSettings, controller.signal)');
    expect(source).toContain('controller.abort()');
    expect(source).toContain('genByStepsSig(event, getSettings(), mode222) !== requestSignature');
    expect(source).toContain("entry?.id !== expectedId || entry.scramble !== ''");
    expect(source).toContain('setByStepsRetry((value) => value + 1)');
  });
});
