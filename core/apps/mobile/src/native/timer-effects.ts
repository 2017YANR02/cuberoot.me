import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { TimerMachineState } from '@cuberoot/shared/timer';

export type TimerPhase = TimerMachineState['phase'];
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

export function timerHapticCue(
  previous: TimerPhase,
  current: TimerPhase,
): TimerHapticCue | null {
  if (current === 'ready' && previous === 'holding') return 'ready';
  if (current === 'stopped' && previous === 'running') return 'stopped';
  return null;
}

export async function playTimerHaptic(cue: TimerHapticCue): Promise<void> {
  try {
    await Haptics.impact({
      style: cue === 'ready' ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    // Timing remains fully usable when a device has no haptic engine.
  }
}

export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  const wakeLock = (navigator as Partial<Pick<Navigator, 'wakeLock'>>).wakeLock;
  if (!wakeLock || document.visibilityState !== 'visible') return null;
  try {
    return await wakeLock.request('screen');
  } catch {
    // Unsupported devices and system power policy fall back to normal display timeout.
    return null;
  }
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
    if (
      disposed
      || acquiring
      || page.visibilityState !== 'visible'
      || (activeLock && !activeLock.released)
    ) return;

    activeLock = null;
    acquiring = true;
    const requested = await request();
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
      if (acquiring) {
        reacquireAfterPending = true;
        return;
      }
      void acquire();
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
