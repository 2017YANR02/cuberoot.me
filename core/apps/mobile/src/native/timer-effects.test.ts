import { describe, expect, it } from 'vitest';

import {
  startTimerScreenWakeLock,
  timerHapticCue,
  timerNeedsScreenAwake,
  type TimerWakeLockPage,
  type TimerWakeLockSentinel,
} from './timer-effects';

class FakeWakeLock implements TimerWakeLockSentinel {
  released = false;
  private releaseListeners: Array<() => void> = [];

  addEventListener(_type: 'release', listener: () => void): void {
    this.releaseListeners.push(listener);
  }

  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    for (const listener of this.releaseListeners.splice(0)) listener();
  }
}

class FakePage implements TimerWakeLockPage {
  visibilityState: DocumentVisibilityState = 'visible';
  private visibilityListeners = new Set<() => void>();

  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.visibilityListeners.add(listener);
  }

  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.visibilityListeners.delete(listener);
  }

  setVisibility(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    for (const listener of this.visibilityListeners) listener();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('native timer effects policy', () => {
  it('keeps the display awake only while inspection or timing is active', () => {
    expect(timerNeedsScreenAwake('idle')).toBe(false);
    expect(timerNeedsScreenAwake('holding')).toBe(false);
    expect(timerNeedsScreenAwake('ready')).toBe(false);
    expect(timerNeedsScreenAwake('inspecting')).toBe(true);
    expect(timerNeedsScreenAwake('running')).toBe(true);
    expect(timerNeedsScreenAwake('stopped')).toBe(false);
  });

  it('emits one cue when the timer becomes ready or stops a solve', () => {
    expect(timerHapticCue('holding', 'ready')).toBe('ready');
    expect(timerHapticCue('running', 'stopped')).toBe('stopped');
    expect(timerHapticCue('ready', 'running')).toBeNull();
    expect(timerHapticCue('stopped', 'holding')).toBeNull();
  });

  it('releases in the background and reacquires on return to the foreground', async () => {
    const page = new FakePage();
    const locks = [new FakeWakeLock(), new FakeWakeLock()];
    let requests = 0;
    const stop = startTimerScreenWakeLock(async () => locks[requests++], page);
    await settle();

    page.setVisibility('hidden');
    await settle();
    expect(locks[0].released).toBe(true);

    page.setVisibility('visible');
    await settle();
    expect(requests).toBe(2);
    stop();
    await settle();
    expect(locks[1].released).toBe(true);
  });

  it('keeps a single in-flight request and releases the acquired lock on stop', async () => {
    const page = new FakePage();
    const pending = deferred<TimerWakeLockSentinel | null>();
    let requests = 0;
    const stop = startTimerScreenWakeLock(() => {
      requests += 1;
      return pending.promise;
    }, page);

    page.setVisibility('visible');
    page.setVisibility('visible');
    expect(requests).toBe(1);

    const lock = new FakeWakeLock();
    pending.resolve(lock);
    await settle();
    stop();
    await settle();
    expect(lock.released).toBe(true);
  });

  it('retries once when a pending request fails across a background round trip', async () => {
    const page = new FakePage();
    const firstRequest = deferred<TimerWakeLockSentinel | null>();
    const foregroundLock = new FakeWakeLock();
    let requests = 0;
    const stop = startTimerScreenWakeLock(() => {
      requests += 1;
      return requests === 1 ? firstRequest.promise : Promise.resolve(foregroundLock);
    }, page);

    page.setVisibility('hidden');
    page.setVisibility('visible');
    expect(requests).toBe(1);
    firstRequest.resolve(null);
    await settle();
    expect(requests).toBe(2);

    stop();
    await settle();
    expect(foregroundLock.released).toBe(true);
  });

  it('does not loop when the Wake Lock API is unsupported', async () => {
    const page = new FakePage();
    let requests = 0;
    const stop = startTimerScreenWakeLock(async () => {
      requests += 1;
      return null;
    }, page);

    await settle();
    await settle();
    expect(requests).toBe(1);
    stop();
  });

  it('releases a request that resolves after the effect is stopped', async () => {
    const page = new FakePage();
    const pending = deferred<TimerWakeLockSentinel | null>();
    const stop = startTimerScreenWakeLock(() => pending.promise, page);
    stop();

    const lateLock = new FakeWakeLock();
    pending.resolve(lateLock);
    await settle();
    expect(lateLock.released).toBe(true);
  });
});
