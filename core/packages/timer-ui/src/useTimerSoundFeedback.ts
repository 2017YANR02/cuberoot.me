import { useEffect, useMemo } from 'react';
import {
  createTimerSoundFeedback as createSharedTimerSoundFeedback,
  type TimerSoundOutput,
} from '@cuberoot/shared/timer/sound-feedback';

/** One warning clock per timer instance; audio rendering may be shared by a host. */
export function createTimerSoundFeedback(sound: TimerSoundOutput) {
  return createSharedTimerSoundFeedback(sound, {
    now: () => performance.now(),
    isVisible: () => document.visibilityState !== 'hidden',
  });
}

export function useTimerSoundFeedback(sound: TimerSoundOutput) {
  const feedback = useMemo(() => createTimerSoundFeedback(sound), [sound]);
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') sound.cancelVoice(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); feedback.dispose(); };
  }, [feedback, sound]);
  return feedback.onTransition;
}
