// Ported from packages/client/src/hooks/useSpaceHoldTimer.ts
'use client';

import { useCallback, useEffect } from 'react';

const NOT_RUNNING = 0;
const AWAITING_READY = 1;
const READY = 2;
const RUNNING = 3;
const STOPPING = 4;

export interface SpaceHoldTimerOptions {
  state: number;
  delayMs: number;
  enabled?: boolean;
  getTimerReady: (delayMs: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  setNotRunning: () => void;
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
      if (e.repeat) return;
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
