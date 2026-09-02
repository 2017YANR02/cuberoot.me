import { describe, expect, it, vi } from 'vitest';

import {
  createTimerRandomDifficultyPool,
  type TimerRandomDifficultyBatch,
  type TimerRandomDifficultyResult,
} from '@cuberoot/shared/timer';
import { solvedCubie } from '@cuberoot/puzzle-solvers/kociemba/cube';
import type { TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';

const spec = (stage = 'cross'): TrainerSpec => ({
  variant: 'std',
  stage,
  colors: 'BGORWY',
  slot: stage === 'cross' ? 0 : 'best',
  lo: 4,
  hi: 6,
});

const result = (
  target: TrainerSpec,
  scramble = 'R U',
  depth = 5,
): TimerRandomDifficultyResult => ({
  scramble,
  spec: target,
  depth,
  state: solvedCubie(),
});

describe('shared timer random difficulty pool', () => {
  it('keeps one request active, accepts a partial budget batch and tops up after take', async () => {
    let active = 0;
    let maxActive = 0;
    const generate = vi.fn(async (target: TrainerSpec): Promise<TimerRandomDifficultyBatch> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { verdict: 'budget', items: [result(target, `R U ${generate.mock.calls.length}`)] };
    });
    const pool = createTimerRandomDifficultyPool(generate);
    expect(await pool.wait(spec())).toBe('ready');
    expect(maxActive).toBe(1);
    expect(pool.peek(spec())?.depth).toBe(5);
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(4));
    expect(maxActive).toBe(1);
    pool.reset();
  });

  it('latches proven empty, marks four fruitless budgets rare and retries explicitly', async () => {
    const empty = createTimerRandomDifficultyPool(async () => ({ verdict: 'empty', items: [] }));
    expect(await empty.wait(spec())).toBe('empty');
    expect(empty.status(spec())).toBe('empty');
    empty.retry(spec());
    expect(empty.status(spec())).toBe('empty');

    let ready = false;
    const rare = createTimerRandomDifficultyPool(async (target) => (
      ready
        ? { verdict: 'ready', items: [result(target)] }
        : { verdict: 'budget', items: [] }
    ));
    expect(await rare.wait(spec())).toBe('rare');
    ready = true;
    rare.retry(spec());
    expect(await rare.wait(spec())).toBe('ready');
    empty.reset();
    rare.reset();
  });

  it('reports transport and malformed results as errors instead of rare', async () => {
    let fail = true;
    const pool = createTimerRandomDifficultyPool(async (target) => {
      if (fail) throw new Error('worker failed');
      return { verdict: 'ready', items: [result(target)] };
    });
    expect(await pool.wait(spec())).toBe('error');
    fail = false;
    pool.retry(spec());
    expect(await pool.wait(spec())).toBe('ready');
    pool.reset();

    const malformed = createTimerRandomDifficultyPool(async (target) => ({
      verdict: 'ready',
      items: [result(target, 'R U', 99)],
    }));
    expect(await malformed.wait(spec())).toBe('error');
    malformed.reset();
  });

  it('settles abandoned waiters and never publishes a late A result into B or a later A', async () => {
    const pending: Array<(batch: TimerRandomDifficultyBatch) => void> = [];
    const signals: AbortSignal[] = [];
    const pool = createTimerRandomDifficultyPool((_spec, _count, _budget, signal) => new Promise((resolve) => {
      signals.push(signal);
      pending.push((batch) => resolve(batch));
    }));
    const a = spec('cross');
    const b = spec('xcross');
    const firstA = pool.wait(a);
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const waitB = pool.wait(b);
    const secondA = pool.wait(a);
    expect(await waitB).toBe('idle');
    expect(signals[0]?.aborted).toBe(true);

    pending[0]!({ verdict: 'ready', items: [result(a, 'OLD')] });
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1]!({ verdict: 'ready', items: [result(a, 'NEW')] });
    expect(await firstA).toBe('idle');
    expect(await secondA).toBe('ready');
    expect(pool.peek(a)?.scramble).toBe('NEW');
    pool.reset();
  });

  it('aborts active generation when released', async () => {
    let signal: AbortSignal | undefined;
    const pool = createTimerRandomDifficultyPool((_spec, _count, _budget, activeSignal) => {
      signal = activeSignal;
      return new Promise(() => undefined);
    });
    pool.prefetch(spec());
    await vi.waitFor(() => expect(signal).toBeDefined());
    pool.release();
    expect(signal?.aborted).toBe(true);
    pool.reset();
  });
});
