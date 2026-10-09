import { expect, it, vi } from 'vitest';
import { createNativeScreenWakeLock, startTimerScreenWakeLock, type TimerWakeLockPage } from '../src/timer-effects';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

it('retains a new timer owner when an older pending owner releases', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const set = vi.fn<(enabled: boolean) => Promise<void>>().mockImplementationOnce(() => pending).mockResolvedValue(undefined);
  const request = createNativeScreenWakeLock(set);
  const first = request();
  await flush();
  const second = request();
  finish();
  const [oldLock, newLock] = await Promise.all([first, second]);
  await oldLock!.release();
  expect(set.mock.calls.every(([enabled]) => enabled)).toBe(true);
  await newLock!.release();
  expect(set.mock.lastCall).toEqual([false]);
  const count = set.mock.calls.length;
  await newLock!.release();
  expect(set).toHaveBeenCalledTimes(count);
});

it('cleans up a failed native acquisition and permits the next attempt', async () => {
  const set = vi.fn<(enabled: boolean) => Promise<void>>().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined);
  const request = createNativeScreenWakeLock(set);
  expect(await request()).toBeNull();
  expect(set.mock.calls).toEqual([[true], [false]]);
  const lock = await request();
  expect(lock).not.toBeNull();
  await lock!.release();
  expect(set.mock.lastCall).toEqual([false]);
});

it('releases a late native acquisition after disposal, and on hide with foreground recovery', async () => {
  const listeners = new Set<() => void>();
  const page: TimerWakeLockPage & { visibilityState: DocumentVisibilityState } = {
    visibilityState: 'visible',
    addEventListener: (_, listener) => { listeners.add(listener); },
    removeEventListener: (_, listener) => { listeners.delete(listener); },
  };
  let finish!: () => void;
  const set = vi.fn<(enabled: boolean) => Promise<void>>()
    .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
    .mockResolvedValue(undefined);
  const request = createNativeScreenWakeLock(set);
  const stop = startTimerScreenWakeLock(request, page);
  await flush();
  stop();
  finish();
  await flush();
  expect(set.mock.lastCall).toEqual([false]);
  const stopAgain = startTimerScreenWakeLock(request, page);
  await flush();
  expect(set.mock.lastCall).toEqual([true]);
  page.visibilityState = 'hidden';
  listeners.forEach((listener) => listener());
  await flush();
  expect(set.mock.lastCall).toEqual([false]);
  page.visibilityState = 'visible';
  listeners.forEach((listener) => listener());
  await flush();
  expect(set.mock.lastCall).toEqual([true]);
  stopAgain();
  await flush();
  expect(set.mock.lastCall).toEqual([false]);
  expect(listeners.size).toBe(0);
});
