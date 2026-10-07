import type { TimerPhase } from '@cuberoot/shared/timer';
import { useEffect, useRef } from 'react';

export type TimerHapticCue = 'ready' | 'stopped';

export interface TimerWakeLockSentinel {
  readonly released: boolean;
  addEventListener(type: 'release', listener: () => void, options?: { once?: boolean }): void;
  release(): Promise<void>;
}

export interface TimerWakeLockPage {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export function timerNeedsScreenAwake(phase: TimerPhase): boolean {
  return phase === 'inspecting' || phase === 'running';
}

export function timerHapticCue(previous: TimerPhase, current: TimerPhase): TimerHapticCue | null {
  if (current === 'ready' && previous === 'holding') return 'ready';
  if (current === 'stopped' && previous === 'running') return 'stopped';
  return null;
}

async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  const wakeLock = (navigator as Partial<Pick<Navigator, 'wakeLock'>>).wakeLock;
  if (!wakeLock || document.visibilityState !== 'visible') return null;
  try {
    return await wakeLock.request('screen');
  } catch {
    return null;
  }
}

// Serialize native mutations and retain ownership across overlapping effect cleanup.
// A late release from inspection must not disable a newly running timer.
export function createNativeScreenWakeLock(
  setKeepAwake: (enabled: boolean) => Promise<void>,
): () => Promise<TimerWakeLockSentinel | null> {
  const owners = new Set<symbol>();
  let tail: Promise<void> = Promise.resolve();
  const sync = () => {
    const next = tail.then(() => setKeepAwake(owners.size > 0));
    tail = next.catch(() => undefined);
    return next;
  };
  return async () => {
    const owner = Symbol();
    owners.add(owner);
    try { await sync(); }
    catch {
      owners.delete(owner);
      await sync().catch(() => undefined);
      return null;
    }
    let released = false;
    const listeners = new Set<() => void>();
    return {
      get released() { return released; },
      addEventListener(_type, listener) { listeners.add(listener); },
      async release() {
        if (released) return;
        released = true;
        owners.delete(owner);
        await sync().catch(() => undefined);
        for (const listener of listeners) listener();
        listeners.clear();
      },
    };
  };
}

export function startTimerScreenWakeLock(
  request: () => Promise<TimerWakeLockSentinel | null> = requestScreenWakeLock,
  page: TimerWakeLockPage = document,
): () => void {
  let disposed = false;
  let acquiring = false;
  let reacquireAfterPending = false;
  let activeLock: TimerWakeLockSentinel | null = null;

  const acquire = async () => {
    if (disposed || acquiring || page.visibilityState !== 'visible' || (activeLock && !activeLock.released)) return;
    activeLock = null;
    acquiring = true;
    const requested = await request().catch(() => null);
    acquiring = false;
    const shouldReacquire = reacquireAfterPending;
    reacquireAfterPending = false;
    if (disposed || page.visibilityState !== 'visible') {
      await requested?.release();
      return;
    }
    if (!requested || requested.released) {
      await requested?.release();
      if (shouldReacquire) void acquire();
      return;
    }
    activeLock = requested;
    requested.addEventListener('release', () => {
      if (activeLock === requested) activeLock = null;
      if (!disposed && page.visibilityState === 'visible') void acquire();
    }, { once: true });
  };
  const visibilityChange = () => {
    if (page.visibilityState === 'visible') {
      if (acquiring) reacquireAfterPending = true;
      else void acquire();
      return;
    }
    const lock = activeLock;
    activeLock = null;
    void lock?.release();
  };

  void acquire();
  page.addEventListener('visibilitychange', visibilityChange);
  return () => {
    disposed = true;
    reacquireAfterPending = false;
    page.removeEventListener('visibilitychange', visibilityChange);
    const lock = activeLock;
    activeLock = null;
    void lock?.release();
  };
}

export function useInstalledTimerEffects(
  phase: TimerPhase,
  playHaptic?: (cue: TimerHapticCue) => Promise<void>,
  requestWakeLock?: () => Promise<TimerWakeLockSentinel | null>,
): void {
  const previousPhase = useRef(phase);

  useEffect(() => {
    const cue = timerHapticCue(previousPhase.current, phase);
    previousPhase.current = phase;
    if (cue) void playHaptic?.(cue);
  }, [phase, playHaptic]);

  useEffect(() => {
    if (!timerNeedsScreenAwake(phase)) return undefined;
    return startTimerScreenWakeLock(requestWakeLock);
  }, [phase, requestWakeLock]);
}
