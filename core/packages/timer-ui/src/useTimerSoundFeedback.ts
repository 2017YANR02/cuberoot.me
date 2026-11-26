import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from 'react';
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

/** Project the server deadline into the local clock and consume each cue once. */
export function useNetBattleCountdown({ scope, startAt, eligible, offset, play, onStart }: {
  scope: string | null;
  startAt: number | null;
  eligible: boolean;
  offset: RefObject<number | null>;
  play?: TimerSoundOutput['play'];
  onStart(lateMs: number): void;
}): number | null {
  const key = scope !== null && startAt !== null ? JSON.stringify([scope, startAt]) : null;
  const progress = useRef<{ key: string; second: number } | null>(null);
  const [display, setDisplay] = useState<{ key: string; second: number } | null>(null);
  const playTick = useEffectEvent(() => play?.('sync-countdown'));
  const start = useEffectEvent(onStart);
  useEffect(() => {
    if (key === null || startAt === null) { progress.current = null; return; }
    if (progress.current?.key !== key) progress.current = { key, second: Infinity };
    const countdown = progress.current;
    if (!eligible || countdown.second === 0) return;

    let lastDisplayed: number | null = null;
    const tick = () => {
      const left = startAt - (Date.now() + (offset.current ?? 0));
      if (left <= 0) {
        clearInterval(interval);
        countdown.second = 0;
        setDisplay(null);
        start(Math.max(0, -left));
        return;
      }
      const second = Math.min(3, Math.ceil(left / 1_000));
      if (second !== lastDisplayed) {
        lastDisplayed = second;
        setDisplay({ key, second });
      }
      if (second >= countdown.second) return;
      countdown.second = second;
      if (!document.hidden) playTick();
    };
    const interval = setInterval(tick, 50);
    tick();
    return () => clearInterval(interval);
  }, [key, startAt, eligible, offset]);
  return eligible && display?.key === key ? display.second : null;
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
