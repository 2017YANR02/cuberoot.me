import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBootDeadline } from '../src/cubeopt/boot-deadline.js';
import { cubeoptInputWriter } from '../src/cubeopt/daemon-input.js';
import { assertCubeoptReadyLine, DEFAULT_CUBEOPT_IDLE_MS, resolveCubeoptIdleMs, resolveCubeoptThreads } from '../src/cubeopt/config.js';
import { assertCubeoptSmokeResult } from '../src/cubeopt/smoke-contract.js';
import { assertCubeoptLoadMemory, requiredCubeoptLoadBytes, CUBEOPT_LOAD_FLOOR_BYTES } from '../src/cubeopt/memory-budget.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('CubeOpt runtime contracts', () => {
  it('handles asynchronous EPIPE once without writing later queued requests', async () => {
    const writes: string[] = [], failures: Error[] = [];
    const pipe = new Writable({ write(chunk, _encoding, callback) {
      writes.push(chunk.toString());
      queueMicrotask(() => callback(Object.assign(new Error('closed'), { code: 'EPIPE' })));
    } });
    const send = cubeoptInputWriter(pipe, error => failures.push(error));
    send('first');
    await new Promise(resolve => setImmediate(resolve));
    send('second');
    expect(writes).toEqual(['first']);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ code: 'EPIPE' });
  });
  it('checks the actual configured thread count in READY', () => {
    expect(resolveCubeoptThreads('4')).toBe(4);
    expect(resolveCubeoptThreads(undefined)).toBe(2);
    for (const value of ['0', '-1', '1.5', '17', 'NaN']) {
      expect(() => resolveCubeoptThreads(value)).toThrow(/THREADS/);
    }
    expect(() => assertCubeoptReadyLine('READY\t4', 4)).not.toThrow();
    for (const line of ['READY', 'READY\t1', 'READY\t4extra']) {
      expect(() => assertCubeoptReadyLine(line, 4)).toThrow(/configured threads/);
    }
  });
  it('refuses a full table load without service headroom and enforces a loading floor', () => {
    const tableBytes = 7_782_727_680;
    expect(requiredCubeoptLoadBytes(tableBytes)).toBe(8_856_469_504);
    expect(() => assertCubeoptLoadMemory(8_003_664 * 1024, requiredCubeoptLoadBytes(tableBytes))).toThrow(/load deferred/);
    expect(() => assertCubeoptLoadMemory(10 * 1024 ** 3, requiredCubeoptLoadBytes(tableBytes))).not.toThrow();
    expect(() => assertCubeoptLoadMemory(160_236 * 1024, CUBEOPT_LOAD_FLOOR_BYTES)).toThrow(/load deferred/);
    expect(() => assertCubeoptLoadMemory(512 * 1024 ** 2, CUBEOPT_LOAD_FLOOR_BYTES)).not.toThrow();
  });
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
