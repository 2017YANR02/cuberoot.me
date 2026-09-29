import { useEffect, useMemo } from 'react';
import type { TimerMachineTransition } from '@cuberoot/shared/timer';
import type { Cue } from './timer-sound';

/** One warning clock per timer instance; audio rendering may be shared by a host. */
export function createTimerSoundFeedback(sound: {
  play(cue: Cue): void; cancelVoice(): void;
  getInspectionBeepAt?(): readonly number[]; playInspectionBeep?(): void;
}) {
  let inspectionTimer: ReturnType<typeof setInterval> | undefined;
  const clear = () => { clearInterval(inspectionTimer); inspectionTimer = undefined; };
  return {
    onTransition({ effects, state, solve }: TimerMachineTransition) {
      for (const effect of effects) {
        if (effect === 'inspection-started') {
          clear();
          sound.cancelVoice();
          sound.play('inspection-start');
          const start = state.inspectionStartedAtMs ?? performance.now();
          const fired = new Set<number>();
          const firedBeeps = new Set<number>();
          inspectionTimer = setInterval(() => {
            const elapsed = performance.now() - start;
            for (const seconds of [8, 12] as const) {
              if (elapsed >= seconds * 1000 && !fired.has(seconds)) {
                fired.add(seconds);
                if (document.visibilityState !== 'hidden') sound.play(seconds === 8 ? 'warn-8' : 'warn-12');
              }
            }
            for (const seconds of sound.getInspectionBeepAt?.() ?? []) {
              if (elapsed >= seconds * 1000 && !firedBeeps.has(seconds)) {
                firedBeeps.add(seconds);
                if (document.visibilityState !== 'hidden') sound.playInspectionBeep?.();
              }
            }
          }, 100);
        } else if (effect === 'run-started') {
          clear(); sound.cancelVoice(); sound.play('start');
        } else if (effect === 'run-stopped') {
          clear(); sound.cancelVoice(); if (solve) sound.play('stop');
        } else if (effect === 'arm-cancelled' || effect === 'reset') {
          clear(); sound.cancelVoice();
        }
      }
    },
    dispose() { clear(); sound.cancelVoice(); },
  };
}

export function useTimerSoundFeedback(sound: Parameters<typeof createTimerSoundFeedback>[0]) {
  const feedback = useMemo(() => createTimerSoundFeedback(sound), [sound]);
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') sound.cancelVoice(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); feedback.dispose(); };
  }, [feedback, sound]);
  return feedback.onTransition;
}
