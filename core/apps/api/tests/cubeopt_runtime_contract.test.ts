import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBootDeadline } from '../src/cubeopt/boot-deadline.js';
import { DEFAULT_CUBEOPT_IDLE_MS, resolveCubeoptIdleMs } from '../src/cubeopt/config.js';
import { assertCubeoptSmokeResult } from '../src/cubeopt/smoke-contract.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('CubeOpt runtime contracts', () => {
  it('allows zero to disable idle unload without accepting invalid delays', () => {
    expect(resolveCubeoptIdleMs(undefined)).toBe(DEFAULT_CUBEOPT_IDLE_MS);
    expect(resolveCubeoptIdleMs('')).toBe(DEFAULT_CUBEOPT_IDLE_MS);
    expect(resolveCubeoptIdleMs('0')).toBe(0);
    expect(resolveCubeoptIdleMs(' 30000 ')).toBe(30_000);
    expect(resolveCubeoptIdleMs('-1')).toBe(DEFAULT_CUBEOPT_IDLE_MS);
    expect(resolveCubeoptIdleMs('1.5')).toBe(DEFAULT_CUBEOPT_IDLE_MS);
    expect(resolveCubeoptIdleMs('forever')).toBe(DEFAULT_CUBEOPT_IDLE_MS);
  });

  it('enforces one spawn-to-READY deadline and settles it exactly once', () => {
    vi.useFakeTimers();
    const timedOut = vi.fn();
    const completed = vi.fn();
    const deadline = createBootDeadline(1_000, timedOut);

    vi.advanceTimersByTime(999);
    expect(timedOut).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(timedOut).toHaveBeenCalledOnce();
    expect(deadline.finish(completed)).toBe(false);
    expect(completed).not.toHaveBeenCalled();
  });

  it('cancels the boot timer after READY without affecting later solve timers', () => {
    vi.useFakeTimers();
    const timedOut = vi.fn();
    const completed = vi.fn();
    const deadline = createBootDeadline(1_000, timedOut);

    expect(deadline.finish(completed)).toBe(true);
    expect(deadline.finish(completed)).toBe(false);
    vi.advanceTimersByTime(2_000);
    expect(completed).toHaveBeenCalledOnce();
    expect(timedOut).not.toHaveBeenCalled();
  });

  it('wires boot and active-solve deadlines to separate budgets', async () => {
    const source = await readFile(resolve(import.meta.dirname, '../src/cubeopt/daemon.ts'), 'utf8');

    expect(source).toMatch(/createBootDeadline\(BOOT_TIMEOUT_MS,/);
    expect(source).toMatch(/job\.solveTimer = setTimeout\([\s\S]*?}, SOLVE_TIMEOUT_MS\);/);
  });

  it('requires the production R smoke result byte-for-byte', () => {
    expect(() => assertCubeoptSmokeResult({ htm: 1, solution: "R'" })).not.toThrow();
    expect(() => assertCubeoptSmokeResult({ htm: 1, solution: " R'" })).toThrow(/unexpected smoke result/);
    expect(() => assertCubeoptSmokeResult({ htm: 1, solution: "R'\n" })).toThrow(/unexpected smoke result/);
    expect(() => assertCubeoptSmokeResult({ htm: 2, solution: "R'" })).toThrow(/unexpected smoke result/);
  });
});
