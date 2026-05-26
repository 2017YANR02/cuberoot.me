/**
 * useTimer — WCA-style spacebar / touch timer state machine, with optional
 * inspection countdown (warn at 8s and 12s, +2 / DNF auto-penalty).
 *
 * Ported subset of packages/client/src/pages/timer/useTimer.ts. Press handlers
 * (`onPressDown`, `onPressUp`, `reset`) are stable so consumers binding window
 * listeners don't thrash on tick.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettings } from './timer-settings';
import { play } from './timer-sound';

export type TimerPhase = 'idle' | 'inspecting' | 'holding' | 'ready' | 'running' | 'stopped';

const TICK_MS = 30;

export interface SolveResult {
  /** Final timer ms (raw, before penalty). */
  timeMs: number;
  /** How long inspection ran, in ms (0 if inspection wasn't used). */
  inspectionMs: number;
  /** Auto-applied inspection penalty (+2 if exceeded, DNF if 2s overrun). */
  autoPenalty: 'ok' | '+2' | 'DNF';
}

export interface TimerHandle {
  phase: TimerPhase;
  displayMs: number;
  inspectionDisplayMs: number;
  lastMs: number | null;
  onPressDown: () => void;
  onPressUp: () => void;
  reset: () => void;
}

export function useTimer(onSolve?: (result: SolveResult) => void): TimerHandle {
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [displayMs, setDisplayMs] = useState(0);
  const [inspectionDisplayMs, setInspectionDisplayMs] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);

  const phaseRef = useRef<TimerPhase>('idle');
  const lastMsRef = useRef<number | null>(null);
  const startTsRef = useRef(0);
  const inspectionStartRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const inspTickRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const warned8Ref = useRef(false);
  const warned12Ref = useRef(false);
  const pendingInspectionStartRef = useRef(false);
  const onSolveRef = useRef(onSolve);
  useEffect(() => { onSolveRef.current = onSolve; }, [onSolve]);

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
  const stopInspectionTick = useCallback(() => {
    if (inspTickRef.current !== null) {
      window.clearInterval(inspTickRef.current);
      inspTickRef.current = null;
    }
  }, []);
  const stopHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const beginInspection = useCallback(() => {
    setPhaseSafe('inspecting');
    inspectionStartRef.current = performance.now();
    setInspectionDisplayMs(0);
    warned8Ref.current = false;
    warned12Ref.current = false;
    play('inspection-start');
    stopInspectionTick();
    inspTickRef.current = window.setInterval(() => {
      const elapsed = performance.now() - inspectionStartRef.current;
      setInspectionDisplayMs(prev => (Math.floor(prev / 1000) === Math.floor(elapsed / 1000) ? prev : elapsed));
      if (!warned8Ref.current && elapsed >= 8000) {
        warned8Ref.current = true;
        play('warn-8');
      }
      if (!warned12Ref.current && elapsed >= 12000) {
        warned12Ref.current = true;
        play('warn-12');
      }
    }, 100);
  }, [setPhaseSafe, stopInspectionTick]);

  const startHoldCycle = useCallback(() => {
    const holdMs = getSettings().holdMs;
    setPhaseSafe('holding');
    stopHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'holding') setPhaseSafe('ready');
    }, holdMs);
  }, [setPhaseSafe, stopHoldTimer]);

  const onPressDown = useCallback(() => {
    const cur = phaseRef.current;
    const settings = getSettings();

    if (cur === 'running') {
      stopTick();
      const final = performance.now() - startTsRef.current;
      setDisplayMs(final);
      setLastMsSafe(final);
      setPhaseSafe('stopped');
      play('stop');
      const inspMs = inspectionStartRef.current === 0
        ? 0
        : Math.max(0, performance.now() - inspectionStartRef.current - final);
      const inspectionAtStart = inspectionStartRef.current === 0
        ? 0
        : Math.max(0, startTsRef.current - inspectionStartRef.current);
      let autoPenalty: 'ok' | '+2' | 'DNF' = 'ok';
      if (settings.inspection > 0) {
        if (inspectionAtStart > (settings.inspection + 2) * 1000) autoPenalty = 'DNF';
        else if (inspectionAtStart > settings.inspection * 1000) autoPenalty = '+2';
      }
      inspectionStartRef.current = 0;
      setInspectionDisplayMs(0);
      onSolveRef.current?.({
        timeMs: final,
        inspectionMs: inspMs,
        autoPenalty,
      });
      return;
    }

    if (cur === 'idle' || cur === 'stopped') {
      if (settings.inspection > 0) {
        if (settings.inspectionTrigger === 'up') {
          pendingInspectionStartRef.current = true;
        } else {
          beginInspection();
        }
      } else {
        startHoldCycle();
      }
      return;
    }

    if (cur === 'inspecting') {
      startHoldCycle();
      return;
    }
  }, [beginInspection, setLastMsSafe, setPhaseSafe, startHoldCycle, stopTick]);

  const onPressUp = useCallback(() => {
    const cur = phaseRef.current;
    if (pendingInspectionStartRef.current) {
      pendingInspectionStartRef.current = false;
      if (cur === 'idle' || cur === 'stopped') {
        beginInspection();
        return;
      }
    }
    if (cur === 'ready') {
      stopHoldTimer();
      stopInspectionTick();
      setDisplayMs(0);
      setLastMsSafe(null);
      startTsRef.current = performance.now();
      setPhaseSafe('running');
      play('start');
      stopTick();
      tickRef.current = window.setInterval(() => {
        setDisplayMs(performance.now() - startTsRef.current);
      }, TICK_MS);
      return;
    }
    if (cur === 'holding') {
      stopHoldTimer();
      if (inspectionStartRef.current !== 0) {
        setPhaseSafe('inspecting');
      } else {
        setPhaseSafe(lastMsRef.current !== null ? 'stopped' : 'idle');
      }
    }
  }, [beginInspection, setLastMsSafe, setPhaseSafe, stopHoldTimer, stopInspectionTick, stopTick]);

  const reset = useCallback(() => {
    stopTick();
    stopInspectionTick();
    stopHoldTimer();
    setDisplayMs(0);
    setInspectionDisplayMs(0);
    setLastMsSafe(null);
    inspectionStartRef.current = 0;
    pendingInspectionStartRef.current = false;
    setPhaseSafe('idle');
  }, [setLastMsSafe, setPhaseSafe, stopHoldTimer, stopInspectionTick, stopTick]);

  useEffect(() => () => {
    stopTick();
    stopInspectionTick();
    stopHoldTimer();
  }, [stopHoldTimer, stopInspectionTick, stopTick]);

  return {
    phase,
    displayMs,
    inspectionDisplayMs,
    lastMs,
    onPressDown,
    onPressUp,
    reset,
  };
}
