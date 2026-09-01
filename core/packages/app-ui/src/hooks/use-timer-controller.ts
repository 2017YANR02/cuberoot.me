import {
  initialTimerMachineState,
  timerCanHandleAttemptPress,
  transitionTimer,
  type SolveResult,
  type TimerMachineAction,
  type TimerMachineConfig,
  type TimerMachineState,
  type TimerMachineTransition,
} from '@cuberoot/shared/timer';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

interface TimerControllerOptions {
  canStart?: boolean;
  enabled?: boolean;
  holdMs: number;
  inspectionSec: number;
  onComplete(result: SolveResult): void;
  onStart?(startedAtMs: number): void;
}

export interface TimerController {
  armFromCube(): boolean;
  cancelArm(): boolean;
  machine: TimerMachineState;
  nowMs: number;
  cancelPress(): boolean;
  pressDown(atMs?: number): boolean;
  pressUp(atMs?: number): boolean;
  reset(): boolean;
  startNow(elapsedMs?: number): boolean;
  startFromCube(atMs?: number): boolean;
  stopFromCube(atMs?: number): boolean;
}

export function useTimerController({
  canStart = true,
  enabled = true,
  holdMs,
  inspectionSec,
  onComplete,
  onStart,
}: TimerControllerOptions): TimerController {
  const [machine, setMachine] = useState(initialTimerMachineState);
  const [nowMs, setNowMs] = useState(() => performance.now());
  const machineRef = useRef(machine);
  const holdTimeoutRef = useRef<number | undefined>(undefined);
  const onCompleteRef = useRef(onComplete);
  const onStartRef = useRef(onStart);
  const canStartRef = useRef(canStart);
  const enabledRef = useRef(enabled);
  const configRef = useRef<TimerMachineConfig>({
    inspectionSec,
  });

  onCompleteRef.current = onComplete;
  onStartRef.current = onStart;
  canStartRef.current = canStart;
  enabledRef.current = enabled;
  configRef.current = { inspectionSec };

  const clearHoldTimeout = useCallback(() => {
    if (holdTimeoutRef.current !== undefined) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = undefined;
    }
  }, []);

  const apply = useCallback((action: TimerMachineAction): TimerMachineTransition => {
    const transition = transitionTimer(machineRef.current, action, configRef.current);
    machineRef.current = transition.state;
    setMachine(transition.state);
    setNowMs(performance.now());

    if (transition.effects.includes('hold-started')) {
      clearHoldTimeout();
      holdTimeoutRef.current = window.setTimeout(() => {
        const ready = transitionTimer(machineRef.current, { type: 'hold-ready' }, configRef.current);
        machineRef.current = ready.state;
        setMachine(ready.state);
      }, holdMs);
    }
    if (transition.effects.includes('hold-cancelled') || transition.effects.includes('run-started')) {
      clearHoldTimeout();
    }
    if (transition.effects.includes('run-started')) {
      onStartRef.current?.(transition.state.startedAtMs ?? performance.now());
    }
    if (transition.solve) onCompleteRef.current(transition.solve);
    return transition;
  }, [clearHoldTimeout, holdMs]);

  useEffect(() => clearHoldTimeout, [clearHoldTimeout]);

  useEffect(() => {
    if (enabled) return;
    clearHoldTimeout();
    apply({ type: 'cancel-arm' });
  }, [apply, clearHoldTimeout, enabled]);

  useEffect(() => {
    if (canStart || machineRef.current.phase === 'running') return;
    clearHoldTimeout();
    apply({ type: 'cancel-arm' });
  }, [apply, canStart, clearHoldTimeout]);

  useEffect(() => {
    if (machine.phase !== 'running' && machine.phase !== 'inspecting') return undefined;
    let frame = 0;
    const update = () => {
      setNowMs(performance.now());
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [machine.phase]);

  const pressDown = useCallback((atMs = performance.now()): boolean => (
    enabledRef.current
    && timerCanHandleAttemptPress(machineRef.current.phase, canStartRef.current)
    && apply({ type: 'press-down', nowMs: atMs }).accepted === true
  ), [apply]);

  const pressUp = useCallback((atMs = performance.now()): boolean => {
    if (!enabledRef.current) return false;
    if (!canStartRef.current && machineRef.current.phase !== 'running') {
      clearHoldTimeout();
      apply({ type: 'cancel-arm' });
      return false;
    }
    clearHoldTimeout();
    return apply({ type: 'press-up', nowMs: atMs }).accepted === true;
  }, [apply, clearHoldTimeout]);

  const cancelPress = useCallback((): boolean => {
    clearHoldTimeout();
    return apply({ type: 'cancel-press' }).accepted === true;
  }, [apply, clearHoldTimeout]);

  const armFromCube = useCallback((): boolean => {
    if (!enabledRef.current || !canStartRef.current) return false;
    const phase = machineRef.current.phase;
    if (phase !== 'idle' && phase !== 'stopped') return false;
    apply({ type: 'press-down', nowMs: performance.now() });
    return true;
  }, [apply]);

  const cancelArm = useCallback((): boolean => {
    clearHoldTimeout();
    return apply({ type: 'cancel-arm' }).accepted === true;
  }, [apply, clearHoldTimeout]);

  const startFromCube = useCallback((atMs?: number): boolean => (
    enabledRef.current && canStartRef.current && apply({
      type: 'start-from-cube',
      nowMs: performance.now(),
      atMs,
    }).accepted === true
  ), [apply]);

  const startNow = useCallback((elapsedMs = 0): boolean => (
    enabledRef.current
    && canStartRef.current
    && apply({ type: 'start-now', nowMs: performance.now(), elapsedMs }).effects.includes('run-started')
  ), [apply]);

  const stopFromCube = useCallback((atMs?: number): boolean => apply({
    type: 'stop-from-cube',
    nowMs: performance.now(),
    atMs,
  }).accepted === true, [apply]);

  const reset = useCallback((): boolean => {
    clearHoldTimeout();
    apply({ type: 'reset' });
    return true;
  }, [apply, clearHoldTimeout]);

  return {
    armFromCube,
    cancelPress,
    cancelArm,
    machine,
    nowMs,
    pressDown,
    pressUp,
    reset,
    startNow,
    startFromCube,
    stopFromCube,
  };
}
