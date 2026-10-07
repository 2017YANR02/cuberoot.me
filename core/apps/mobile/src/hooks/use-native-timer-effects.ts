import { useInstalledTimerEffects } from '@cuberoot/app-ui';
import type { TimerPhase } from '@cuberoot/shared/timer';

import { playTimerHaptic, requestNativeScreenWakeLock } from '../native/timer-effects';

export function useNativeTimerEffects(phase: TimerPhase): void {
  useInstalledTimerEffects(phase, playTimerHaptic, requestNativeScreenWakeLock);
}
