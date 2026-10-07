import { registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  createNativeScreenWakeLock,
  startTimerScreenWakeLock,
  timerHapticCue,
  timerNeedsScreenAwake,
  type TimerHapticCue,
  type TimerWakeLockPage,
  type TimerWakeLockSentinel,
} from '@cuberoot/app-ui';
import type { TimerPhase } from '@cuberoot/shared/timer';

export {
  startTimerScreenWakeLock,
  timerHapticCue,
  timerNeedsScreenAwake,
  type TimerHapticCue,
  type TimerPhase,
  type TimerWakeLockPage,
  type TimerWakeLockSentinel,
};

export async function playTimerHaptic(cue: TimerHapticCue): Promise<void> {
  try {
    await Haptics.impact({ style: cue === 'ready' ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch {
    // Timing remains fully usable when a device has no haptic engine.
  }
}

const screenAwake = registerPlugin<{ setKeepAwake(options: { enabled: boolean }): Promise<void> }>('ScreenAwake');
export const requestNativeScreenWakeLock = createNativeScreenWakeLock(
  (enabled) => screenAwake.setKeepAwake({ enabled }),
);
