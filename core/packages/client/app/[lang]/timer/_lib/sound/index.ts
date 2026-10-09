import { createTimerSound } from '@cuberoot/timer-ui';
import { getSettings } from '../settings';
export type { Cue } from '@cuberoot/timer-ui';

export const timerSound = createTimerSound(getSettings);
export const { play, playInspectionBeep, warmupSound } = timerSound;
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') timerSound.cancelVoice();
  });
  window.addEventListener('beforeunload', () => timerSound.dispose());
}
