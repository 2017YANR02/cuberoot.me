/**
 * React adapter for the shared, platform-neutral timer machine.
 *
 * This hook owns browser scheduling and audio only. All phase transitions,
 * timestamps, inspection penalties and smart-cube arming rules live in
 * `@cuberoot/shared/timer`, which is also consumed by the native app.
 */

import {
  initialTimerMachineState,
  transitionTimer,
  type SolveResult,
  type TimerMachineAction,
  type TimerMachineConfig,
  type TimerMachineEffect,
  type TimerMachineState,
  type TimerPhase,
} from '@cuberoot/shared/timer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettings } from '../_lib/settings';
import { play, playInspectionBeep } from '../_lib/sound';

export type { SolveResult, TimerPhase } from '@cuberoot/shared/timer';

export interface TimerHandle {
  phase: TimerPhase;
  /** Live elapsed ms while running; final ms after stop. */
  displayMs: number;
  /** Live inspection ms while inspecting or arming (0 otherwise). */
  inspectionDisplayMs: number;
  /** Most recent stopped time, or null if none. */
  lastMs: number | null;
  onPressDown: () => void;
  onPressUp: () => void;
  reset: () => void;
  /** Start immediately for a synchronized countdown, optionally backdated. */
  startNow: (elapsedMs?: number) => void;
  /** Stop at an exact time measured by an external hardware timer. */
  stopExternal: (timeMs: number, inspectionMs?: number) => void;
  /** Start an armed attempt from a smart-cube move timestamp. */
  startFromCube: (atMs?: number) => boolean;
  /** Cancel an in-progress arm while preserving the last displayed solve. */
  cancelArm: () => void;
}

const TICK_MS = 30;

function machineConfig(): TimerMachineConfig {
  const settings = getSettings();
  return {
    inspectionSec: settings.inspection,
  };
}

export function useTimer(onSolve?: (result: SolveResult) => void): TimerHandle {
  const initial = useRef<TimerMachineState>(initialTimerMachineState());
  const machineRef = useRef<TimerMachineState>(initial.current);
  const [phase, setPhase] = useState<TimerPhase>(initial.current.phase);
  const [displayMs, setDisplayMs] = useState(0);
  const [inspectionDisplayMs, setInspectionDisplayMs] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(initial.current.lastMs);

  const tickRef = useRef<number | null>(null);
  const inspTickRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const warned8Ref = useRef(false);
  const warned12Ref = useRef(false);
  const firedBeepsRef = useRef<Set<number>>(new Set());
  const onSolveRef = useRef(onSolve);
  useEffect(() => { onSolveRef.current = onSolve; }, [onSolve]);

  const commitState = useCallback((state: TimerMachineState) => {
    machineRef.current = state;
    setPhase(state.phase);
    setLastMs(state.lastMs);
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

  const beginInspectionEffects = useCallback((startedAtMs: number) => {
    setInspectionDisplayMs(0);
    warned8Ref.current = false;
    warned12Ref.current = false;
    firedBeepsRef.current = new Set();
    play('inspection-start');
    stopInspectionTick();
    inspTickRef.current = window.setInterval(() => {
      const elapsed = Math.max(0, performance.now() - startedAtMs);
      setInspectionDisplayMs((previous) => (
        Math.floor(previous / 1000) === Math.floor(elapsed / 1000) ? previous : elapsed
      ));
      if (!warned8Ref.current && elapsed >= 8000) {
        warned8Ref.current = true;
        play('warn-8');
      }
      if (!warned12Ref.current && elapsed >= 12000) {
        warned12Ref.current = true;
        play('warn-12');
      }
      const beepAt = getSettings().inspectionBeepAt;
      for (const sec of beepAt) {
        if (sec > 0 && elapsed >= sec * 1000 && !firedBeepsRef.current.has(sec)) {
          firedBeepsRef.current.add(sec);
          playInspectionBeep();
        }
      }
    }, 100);
  }, [stopInspectionTick]);

  const beginRunEffects = useCallback((startedAtMs: number) => {
    stopHoldTimer();
    stopInspectionTick();
    stopTick();
    setInspectionDisplayMs(0);
    setDisplayMs(Math.max(0, performance.now() - startedAtMs));
    play('start');
    tickRef.current = window.setInterval(() => {
      const startedAt = machineRef.current.startedAtMs;
      if (startedAt !== null) setDisplayMs(Math.max(0, performance.now() - startedAt));
    }, TICK_MS);
  }, [stopHoldTimer, stopInspectionTick, stopTick]);

  const runEffects = useCallback((
    effects: TimerMachineEffect[],
    state: TimerMachineState,
    solve?: SolveResult,
  ) => {
    for (const effect of effects) {
      if (effect === 'inspection-started') {
        beginInspectionEffects(state.inspectionStartedAtMs ?? performance.now());
      } else if (effect === 'hold-started') {
        stopHoldTimer();
        holdTimerRef.current = window.setTimeout(() => {
          const transition = transitionTimer(
            machineRef.current,
            { type: 'hold-ready' },
            machineConfig(),
          );
          commitState(transition.state);
        }, getSettings().holdMs);
      } else if (effect === 'hold-cancelled') {
        stopHoldTimer();
      } else if (effect === 'run-started') {
        beginRunEffects(state.startedAtMs ?? performance.now());
      } else if (effect === 'run-stopped') {
        stopTick();
        setInspectionDisplayMs(0);
        if (solve) {
          setDisplayMs(solve.timeMs);
          play('stop');
          onSolveRef.current?.(solve);
        }
      } else if (effect === 'arm-cancelled') {
        stopHoldTimer();
        stopInspectionTick();
        setInspectionDisplayMs(0);
      } else if (effect === 'reset') {
        stopTick();
        stopInspectionTick();
        stopHoldTimer();
        setDisplayMs(0);
        setInspectionDisplayMs(0);
      }
    }
  }, [beginInspectionEffects, beginRunEffects, commitState, stopHoldTimer, stopInspectionTick, stopTick]);

  const dispatch = useCallback((action: TimerMachineAction) => {
    const transition = transitionTimer(machineRef.current, action, machineConfig());
    commitState(transition.state);
    runEffects(transition.effects, transition.state, transition.solve);
    return transition;
  }, [commitState, runEffects]);

  const onPressDown = useCallback(() => {
    dispatch({ type: 'press-down', nowMs: performance.now() });
  }, [dispatch]);

  const onPressUp = useCallback(() => {
    dispatch({ type: 'press-up', nowMs: performance.now() });
  }, [dispatch]);

  const startNow = useCallback((elapsedMs = 0) => {
    dispatch({ type: 'start-now', nowMs: performance.now(), elapsedMs });
  }, [dispatch]);

  const stopExternal = useCallback((timeMs: number, inspectionMs = 0) => {
    dispatch({ type: 'stop-external', timeMs, inspectionMs });
  }, [dispatch]);

  const startFromCube = useCallback((atMs?: number): boolean => {
    const transition = dispatch({
      type: 'start-from-cube',
      nowMs: performance.now(),
      atMs,
    });
    return transition.accepted === true;
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
  }, [dispatch]);

  const cancelArm = useCallback(() => {
    dispatch({ type: 'cancel-arm' });
  }, [dispatch]);

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
    startNow,
    stopExternal,
    startFromCube,
    cancelArm,
  };
}
