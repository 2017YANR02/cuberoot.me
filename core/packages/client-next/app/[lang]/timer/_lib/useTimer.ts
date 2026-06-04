/**
 * useTimer — WCA-style spacebar / touch timer state machine, with optional
 * inspection.
 *
 * Phases:
 *   idle        — waiting for input
 *   inspecting  — countdown running (only when settings.inspection > 0); a
 *                 second press-down begins the hold cycle
 *   holding     — key/touch is down but hold time hasn't reached holdMs yet
 *   ready       — held long enough; release to start timer
 *   running     — timer is running; any input stops it
 *   stopped     — timer was just stopped; visible until next input
 *
 * Press handlers (`onPressDown`, `onPressUp`, `reset`) are stable (built via
 * useCallback with empty-ish deps reading from refs) so consumers binding
 * window listeners don't thrash on every tick.
 *
 * Inspection rules (cstimer / WCA):
 *   - On idle press-down + release within holdMs: enter `inspecting` (don't
 *     auto-start the hold cycle on first press; user must actively decide
 *     when to grip).
 *   - In `inspecting` press-down: enter `holding` regardless of countdown.
 *   - At t = inspection seconds: subsequent stop will apply +2.
 *   - At t = inspection + 2 seconds: subsequent stop will apply DNF.
 *   - Inspection elapsed ms is reported via `onSolve(ms, inspectionMs)` so
 *     callers can apply the penalty.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettings } from './settings';
import { play, playInspectionBeep } from './sound';

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
  /** Live elapsed ms while running; final ms after stop. */
  displayMs: number;
  /** Live inspection ms while inspecting (0 otherwise). */
  inspectionDisplayMs: number;
  /** Most recent stopped time, or null if none. */
  lastMs: number | null;
  onPressDown: () => void;
  onPressUp: () => void;
  reset: () => void;
  /** Soft-cancel an in-progress hold/inspection arm WITHOUT clearing the last
   *  result or the displayed time — used when a press turns into a gesture. */
  cancelArm: () => void;
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
  // Inspection-second marks (cstimer "beep at") that have already fired this run.
  const firedBeepsRef = useRef<Set<number>>(new Set());
  // inspectionTrigger='up': set on press-down in idle, consumed on press-up.
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
    firedBeepsRef.current = new Set();
    play('inspection-start');
    stopInspectionTick();
    inspTickRef.current = window.setInterval(() => {
      const elapsed = performance.now() - inspectionStartRef.current;
      // UI 只显示整秒,跨秒才写 state — 100ms tick × 15s = 150 次,跨秒只 15 次,省 135 次渲染。
      setInspectionDisplayMs(prev => Math.floor(prev / 1000) === Math.floor(elapsed / 1000) ? prev : elapsed);
      if (!warned8Ref.current && elapsed >= 8000) {
        warned8Ref.current = true;
        play('warn-8');
      }
      if (!warned12Ref.current && elapsed >= 12000) {
        warned12Ref.current = true;
        play('warn-12');
      }
      // cstimer-style "beep at N seconds" — fire each configured mark once.
      const beepAt = getSettings().inspectionBeepAt;
      if (beepAt.length) {
        const fired = firedBeepsRef.current;
        for (const sec of beepAt) {
          if (sec > 0 && elapsed >= sec * 1000 && !fired.has(sec)) {
            fired.add(sec);
            playInspectionBeep();
          }
        }
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
      // Stop the timer.
      stopTick();
      const final = performance.now() - startTsRef.current;
      setDisplayMs(final);
      setLastMsSafe(final);
      setPhaseSafe('stopped');
      play('stop');
      const inspMs = inspectionStartRef.current === 0 ? 0
        : Math.max(0, performance.now() - inspectionStartRef.current - final);
      // Compute auto penalty based on inspection time at the moment the timer
      // started (i.e. after the user released ready). We tracked
      // inspectionStartRef.current, but inspection ran until startTsRef.current
      // — so the inspection elapsed = startTs - inspStart.
      const inspectionAtStart = inspectionStartRef.current === 0
        ? 0
        : Math.max(0, startTsRef.current - inspectionStartRef.current);
      let autoPenalty: 'ok' | '+2' | 'DNF' = 'ok';
      if (settings.inspection > 0) {
        if (inspectionAtStart > (settings.inspection + 2) * 1000) autoPenalty = 'DNF';
        else if (inspectionAtStart > settings.inspection * 1000) autoPenalty = '+2';
      }
      // Reset inspection after recording.
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
        // First tap = enter inspection. If trigger='up', defer until release.
        if (settings.inspectionTrigger === 'up') {
          pendingInspectionStartRef.current = true;
        } else {
          beginInspection();
        }
      } else {
        // No inspection: jump straight to hold cycle.
        startHoldCycle();
      }
      return;
    }

    if (cur === 'inspecting') {
      // Begin hold cycle while still in inspection — countdown continues but
      // the visible state changes to red (holding).
      startHoldCycle();
      return;
    }
    // While 'holding' or 'ready' we stay; user is still holding the key.
  }, [beginInspection, setLastMsSafe, setPhaseSafe, startHoldCycle, stopTick]);

  const onPressUp = useCallback(() => {
    const cur = phaseRef.current;
    // inspectionTrigger='up': commit deferred inspection start now.
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
      // Released too early — return to inspecting (if started) or idle/stopped.
      stopHoldTimer();
      if (inspectionStartRef.current !== 0) {
        // Resume inspection visually (countdown was still running).
        setPhaseSafe('inspecting');
      } else {
        setPhaseSafe(lastMsRef.current !== null ? 'stopped' : 'idle');
      }
    }
  }, [setLastMsSafe, setPhaseSafe, stopHoldTimer, stopInspectionTick, stopTick]);

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

  const cancelArm = useCallback(() => {
    // Tear down any pending hold/inspection started by the press-down, but keep
    // the last solve + its displayed time intact, then fall back to the phase
    // implied by whether a result is on screen (stopped) or not (idle).
    stopHoldTimer();
    stopInspectionTick();
    pendingInspectionStartRef.current = false;
    if (inspectionStartRef.current !== 0) {
      inspectionStartRef.current = 0;
      setInspectionDisplayMs(0);
    }
    setPhaseSafe(lastMsRef.current !== null ? 'stopped' : 'idle');
  }, [setPhaseSafe, stopHoldTimer, stopInspectionTick]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopTick();
      stopInspectionTick();
      stopHoldTimer();
    };
  }, [stopHoldTimer, stopInspectionTick, stopTick]);

  return {
    phase,
    displayMs,
    inspectionDisplayMs,
    lastMs,
    onPressDown,
    onPressUp,
    reset,
    cancelArm,
  };
}
