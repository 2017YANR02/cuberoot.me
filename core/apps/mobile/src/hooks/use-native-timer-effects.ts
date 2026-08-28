import { useEffect, useRef } from 'react';

import {
  playTimerHaptic,
  startTimerScreenWakeLock,
  timerHapticCue,
  timerNeedsScreenAwake,
  type TimerPhase,
} from '../native/timer-effects';

export function useNativeTimerEffects(phase: TimerPhase): void {
  const previousPhase = useRef(phase);

  useEffect(() => {
    const cue = timerHapticCue(previousPhase.current, phase);
    previousPhase.current = phase;
    if (cue) void playTimerHaptic(cue);
  }, [phase]);

  useEffect(() => {
    if (!timerNeedsScreenAwake(phase)) return undefined;
    return startTimerScreenWakeLock();
  }, [phase]);
}
