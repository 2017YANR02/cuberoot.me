import { useInstalledTimerEffects } from '@cuberoot/app-ui';
import type { TimerPhase } from '@cuberoot/shared/timer';

import { playTimerHaptic } from '../native/timer-effects';

export function useNativeTimerEffects(phase: TimerPhase): void {
  useInstalledTimerEffects(phase, playTimerHaptic);
}
