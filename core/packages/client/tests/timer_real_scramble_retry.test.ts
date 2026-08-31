import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  TIMER_REAL_SCRAMBLE_ATTEMPT_COUNT,
  TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY,
  TIMER_REAL_SCRAMBLE_RETRY_DELAYS_MS,
  TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR,
  startTimerRealScrambleRetry,
  timerRealScrambleReady,
  timerRealScrambleRetryDelayMs,
  type TimerRealScrambleRetrySchedule,
} from '@cuberoot/shared/timer';

interface ScheduledTask {
  callback: () => void;
  delayMs: number;
  cancelled: boolean;
}

function controlledScheduler(): {
  readonly schedule: TimerRealScrambleRetrySchedule;
  readonly tasks: ScheduledTask[];
} {
  const tasks: ScheduledTask[] = [];
  return {
    tasks,
    schedule(callback, delayMs) {
      const task = { callback, delayMs, cancelled: false };
      tasks.push(task);
      return () => { task.cancelled = true; };
    },
  };
}

async function flushAttempt(): Promise<void> {
  await Promise.resolve();
}

describe('shared real-scramble retry policy', () => {
  it('preserves the exact Web n=0..6 attempt and delay sequence', async () => {
    expect(TIMER_REAL_SCRAMBLE_RETRY_DELAYS_MS).toEqual([
      1_000, 2_500, 4_000, 5_500, 6_000, 6_000,
    ]);
    expect(TIMER_REAL_SCRAMBLE_ATTEMPT_COUNT).toBe(7);
    expect(Array.from({ length: 7 }, (_, index) => timerRealScrambleRetryDelayMs(index)))
      .toEqual([1_000, 2_500, 4_000, 5_500, 6_000, 6_000, null]);
    expect(timerRealScrambleRetryDelayMs(-1)).toBeNull();
    expect(timerRealScrambleRetryDelayMs(1.5)).toBeNull();

    const { schedule, tasks } = controlledScheduler();
    const attempts: number[] = [];
    const run = startTimerRealScrambleRetry(async (attemptIndex) => {
      attempts.push(attemptIndex);
      return TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR;
    }, { schedule });

    await flushAttempt();
    for (let retryIndex = 0; retryIndex < TIMER_REAL_SCRAMBLE_RETRY_DELAYS_MS.length; retryIndex++) {
      expect(attempts).toEqual(Array.from({ length: retryIndex + 1 }, (_, index) => index));
      expect(tasks).toHaveLength(retryIndex + 1);
      expect(tasks[retryIndex]).toMatchObject({
        delayMs: TIMER_REAL_SCRAMBLE_RETRY_DELAYS_MS[retryIndex],
        cancelled: false,
      });
      tasks[retryIndex].callback();
      await flushAttempt();
    }

    await expect(run.result).resolves.toEqual({ kind: 'exhausted', attemptIndex: 6 });
    expect(attempts).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(tasks).toHaveLength(6);
  });

  it('never duplicates an attempt when a scheduler callback fires twice', async () => {
    const { schedule, tasks } = controlledScheduler();
    let resolveSecond!: (value: ReturnType<typeof timerRealScrambleReady<string>>) => void;
    const second = new Promise<ReturnType<typeof timerRealScrambleReady<string>>>((resolve) => {
      resolveSecond = resolve;
    });
    const attempt = vi.fn((attemptIndex: number) => (
      attemptIndex === 0 ? Promise.resolve(TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR) : second
    ));
    const run = startTimerRealScrambleRetry(attempt, { schedule });

    await flushAttempt();
    expect(tasks).toHaveLength(1);
    tasks[0].callback();
    tasks[0].callback();
    expect(attempt.mock.calls.map(([index]) => index)).toEqual([0, 1]);

    resolveSecond(timerRealScrambleReady('R U'));
    await expect(run.result).resolves.toEqual({
      kind: 'ready', value: 'R U', attemptIndex: 1,
    });
    expect(tasks).toHaveLength(1);
  });

  it('cancels idempotently and ignores both scheduled and in-flight results', async () => {
    const { schedule, tasks } = controlledScheduler();
    const attempt = vi.fn(async () => TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR);
    const run = startTimerRealScrambleRetry(attempt, { schedule });
    await flushAttempt();

    run.cancel();
    run.cancel();
    expect(tasks[0].cancelled).toBe(true);
    tasks[0].callback();
    await flushAttempt();
    expect(attempt).toHaveBeenCalledTimes(1);
    await expect(run.result).resolves.toEqual({ kind: 'cancelled' });
  });

  it('keeps authoritative empty data separate from transient exceptions', async () => {
    const emptyScheduler = controlledScheduler();
    const emptyRun = startTimerRealScrambleRetry(
      async () => TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY,
      { schedule: emptyScheduler.schedule },
    );
    await expect(emptyRun.result).resolves.toEqual({
      kind: 'confirmed-empty', attemptIndex: 0,
    });
    expect(emptyScheduler.tasks).toHaveLength(0);

    const transientScheduler = controlledScheduler();
    const transientAttempt = vi.fn(async (attemptIndex: number) => {
      if (attemptIndex === 0) throw new Error('offline');
      return timerRealScrambleReady('real row');
    });
    const transientRun = startTimerRealScrambleRetry(transientAttempt, {
      schedule: transientScheduler.schedule,
    });
    await flushAttempt();
    expect(transientScheduler.tasks[0].delayMs).toBe(1_000);
    transientScheduler.tasks[0].callback();
    await expect(transientRun.result).resolves.toEqual({
      kind: 'ready', value: 'real row', attemptIndex: 1,
    });
  });

  it('keeps the Web host on the shared policy instead of an inline backoff copy', () => {
    const source = readFileSync(new URL(
      '../app/[lang]/timer/_shell/SoloView.tsx',
      import.meta.url,
    ), 'utf8');
    expect(source).toContain('startTimerRealScrambleRetry');
    expect(source).toContain('TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY');
    expect(source).toContain('TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR');
    expect(source).not.toMatch(/Math\.min\(\s*1000\s*\+\s*n\s*\*\s*1500/);
  });
});
