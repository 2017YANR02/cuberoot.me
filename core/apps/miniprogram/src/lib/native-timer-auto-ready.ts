import { createTimerAutoReadyController } from '@cuberoot/shared/timer/auto-ready';
import type { TimerPhase } from '@cuberoot/shared/timer/machine';
import type { TimerStoreSettings } from '@cuberoot/shared/timer/persistence';

export interface NativeTimerAutoReadyState {
  phase: TimerPhase;
  preference: TimerStoreSettings['bluetoothAutoReady'];
  /** Timing enabled, eligible event/scramble and a visible, connected cube with known state. */
  canStart: boolean;
  /** A settings or results sheet may own cube input instead of the timer. */
  blocked: boolean;
}

function mode({ phase, preference, canStart, blocked }: NativeTimerAutoReadyState) {
  if (!canStart || blocked || (phase !== 'idle' && phase !== 'inspecting' && phase !== 'stopped')) return false;
  return preference === 'still' || preference === 'double-flick' ? preference : false;
}

/** `scrambled` stays with the shared scramble-guidance controller. */
export function createNativeTimerAutoReady(read: () => NativeTimerAutoReadyState, arm: () => void) {
  const detector = createTimerAutoReadyController(() => { if (mode(read())) arm(); });
  const sync = () => detector.setMode(mode(read()));
  return {
    sync,
    move(token: string) { sync(); detector.move(token); },
    reset: detector.dispose,
  };
}
