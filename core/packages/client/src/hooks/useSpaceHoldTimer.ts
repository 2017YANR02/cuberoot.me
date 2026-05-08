/**
 * Space-hold cubing timer state machine.
 *
 * Shared between ZBLL / ZBLS trainers. Both stores use the same 5-state model
 * (NOT_RUNNING=0, AWAITING_READY=1, READY=2, RUNNING=3, STOPPING=4) and the same
 * keyDown/keyUp + touchStart/touchEnd transitions:
 *
 *   keyDown:
 *     NOT_RUNNING → getTimerReady(delay) → AWAITING_READY → READY (after delay)
 *     RUNNING     → stopTimer            → STOPPING
 *   keyUp:
 *     READY           → startTimer       → RUNNING
 *     AWAITING_READY  → setNotRunning    (released too early — cancel)
 *     STOPPING        → setNotRunning    (clear stop latch for next solve)
 *
 * Putting RUNNING→STOPPING on keyDown (not keyUp) matches touch behaviour and
 * prevents the "must press Space twice to start the next solve" bug — otherwise
 * STOPPING is only cleared by an extra press-release pair.
 */
import { useCallback, useEffect } from 'react';

const NOT_RUNNING = 0;
const AWAITING_READY = 1;
const READY = 2;
const RUNNING = 3;
const STOPPING = 4;

export interface SpaceHoldTimerOptions {
  /** Current state — must follow the 5-state model above */
  state: number;
  /** Hold delay before transitioning AWAITING_READY → READY */
  delayMs: number;
  /** When false, all space + touch events are ignored (e.g. settings panel open) */
  enabled?: boolean;
  getTimerReady: (delayMs: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  setNotRunning: () => void;
  /** Non-Space keydown — caller's other shortcuts (Alt+t, Delete, arrows…) */
  onOtherKeyDown?: (e: KeyboardEvent) => void;
}

export interface SpaceHoldTimerHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSpaceHoldTimer(opts: SpaceHoldTimerOptions): SpaceHoldTimerHandlers {
  const {
    state, delayMs, enabled = true,
    getTimerReady, startTimer, stopTimer, setNotRunning,
    onOtherKeyDown,
  } = opts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;  // 长按 keydown 持续重复,只认第一次
      if (state === NOT_RUNNING) {
        getTimerReady(delayMs);
      } else if (state === RUNNING) {
        stopTimer();
      }
      return;
    }
    onOtherKeyDown?.(e);
  }, [enabled, state, delayMs, getTimerReady, stopTimer, onOtherKeyDown]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (state === READY) {
      startTimer();
    } else if (state === AWAITING_READY) {
      setNotRunning();
    } else if (state === STOPPING) {
      setNotRunning();
    }
  }, [enabled, state, startTimer, setNotRunning]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const onTouchStart = useCallback((_e: React.TouchEvent) => {
    if (!enabled) return;
    if (state === RUNNING) {
      stopTimer();
    } else if (state === NOT_RUNNING) {
      getTimerReady(delayMs);
    }
  }, [enabled, state, delayMs, getTimerReady, stopTimer]);

  const onTouchEnd = useCallback((_e: React.TouchEvent) => {
    if (!enabled) return;
    if (state === READY) {
      startTimer();
    } else if (state === AWAITING_READY) {
      setNotRunning();
    } else if (state === STOPPING) {
      setNotRunning();
    }
  }, [enabled, state, startTimer, setNotRunning]);

  return { onTouchStart, onTouchEnd };
}
