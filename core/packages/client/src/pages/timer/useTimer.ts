/**
 * useTimer — WCA-style spacebar / touch timer state machine.
 *
 * States:
 *   idle      — waiting for input
 *   holding   — key/touch is down but hold time hasn't reached READY_MS yet
 *   ready     — held long enough; release to start timer
 *   running   — timer is running; any input stops it
 *   stopped   — timer was just stopped; visible until next input
 *
 * Hold threshold READY_MS = 550 ms (cstimer default).
 *
 * Implementation note: callback handles (`onPressDown`, `onPressUp`, `reset`)
 * are *stable* (created once with empty deps) and read live state from refs.
 * This keeps consumers' window-event listeners from being torn down and
 * re-attached on every tick of `displayMs`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type TimerPhase = 'idle' | 'holding' | 'ready' | 'running' | 'stopped';

const READY_MS = 550;
const TICK_MS = 30;

export interface TimerHandle {
  phase: TimerPhase;
  /** Live elapsed ms while running; final ms after stop. */
  displayMs: number;
  /** Most recent stopped time, or null if none. */
  lastMs: number | null;
  /** Press handlers — bind to keydown/touchstart and keyup/touchend respectively. */
  onPressDown: () => void;
  onPressUp: () => void;
  /** Force reset to idle (e.g., after recording solve). */
  reset: () => void;
  /** Set the phase to "stopped" without re-running — used by parent after solve recorded. */
  acknowledge: () => void;
}

export function useTimer(onSolve?: (timeMs: number) => void): TimerHandle {
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [displayMs, setDisplayMs] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);

  // Refs mirror reactive state so stable callbacks can read current values.
  const phaseRef = useRef<TimerPhase>('idle');
  const lastMsRef = useRef<number | null>(null);
  const startTsRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const onSolveRef = useRef(onSolve);
  onSolveRef.current = onSolve;

  // ── helpers (stable) ────────────────────────────────────────────
  const setPhaseSafe = useCallback((p: TimerPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);
  const setLastMsSafe = useCallback((ms: number | null) => {
    lastMsRef.current = ms;
    setLastMs(ms);
  }, []);

  const stopTick = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);
  const stopHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // ── stable press handlers (empty deps; read from refs) ──────────
  const onPressDown = useCallback(() => {
    const cur = phaseRef.current;
    if (cur === 'running') {
      // Stop the timer.
      stopTick();
      const final = performance.now() - startTsRef.current;
      setDisplayMs(final);
      setLastMsSafe(final);
      setPhaseSafe('stopped');
      onSolveRef.current?.(final);
      return;
    }
    if (cur === 'idle' || cur === 'stopped') {
      setPhaseSafe('holding');
      stopHoldTimer();
      holdTimerRef.current = window.setTimeout(() => {
        if (phaseRef.current === 'holding') setPhaseSafe('ready');
      }, READY_MS);
    }
    // While 'holding' or 'ready' we stay; user is still holding the key.
  }, [setLastMsSafe, setPhaseSafe, stopHoldTimer, stopTick]);

  const onPressUp = useCallback(() => {
    const cur = phaseRef.current;
    if (cur === 'ready') {
      stopHoldTimer();
      setDisplayMs(0);
      setLastMsSafe(null);
      startTsRef.current = performance.now();
      setPhaseSafe('running');
      stopTick();
      tickRef.current = window.setInterval(() => {
        setDisplayMs(performance.now() - startTsRef.current);
      }, TICK_MS);
      return;
    }
    if (cur === 'holding') {
      // Released too early — fall back to idle if we never had a time, else stopped.
      stopHoldTimer();
      setPhaseSafe(lastMsRef.current !== null ? 'stopped' : 'idle');
    }
  }, [setLastMsSafe, setPhaseSafe, stopHoldTimer, stopTick]);

  const reset = useCallback(() => {
    stopTick();
    stopHoldTimer();
    setDisplayMs(0);
    setLastMsSafe(null);
    setPhaseSafe('idle');
  }, [setLastMsSafe, setPhaseSafe, stopHoldTimer, stopTick]);

  const acknowledge = useCallback(() => {
    setPhaseSafe('idle');
  }, [setPhaseSafe]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopTick();
      stopHoldTimer();
    };
  }, [stopHoldTimer, stopTick]);

  return { phase, displayMs, lastMs, onPressDown, onPressUp, reset, acknowledge };
}
