import {
  initialTimerMachineState,
  transitionTimer,
  type SolveResult,
  type TimerMachineAction,
  type TimerMachineConfig,
  type TimerMachineState,
} from '@cuberoot/shared/timer';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

interface TimerControllerOptions {
  holdMs: number;
  inspectionSec: number;
  onComplete(result: SolveResult): void;
}

export interface TimerController {
  machine: TimerMachineState;
  nowMs: number;
  pointerCancel(event: ReactPointerEvent<HTMLButtonElement>): void;
  pointerDown(event: ReactPointerEvent<HTMLButtonElement>): void;
  pointerUp(event: ReactPointerEvent<HTMLButtonElement>): void;
}

function eventTargetsControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-timer-pad]')) return false;
  return target.closest('a, button, input, select, textarea, [contenteditable="true"]') !== null;
}

export function useTimerController({
  holdMs,
  inspectionSec,
  onComplete,
}: TimerControllerOptions): TimerController {
  const [machine, setMachine] = useState(initialTimerMachineState);
  const [nowMs, setNowMs] = useState(() => performance.now());
  const machineRef = useRef(machine);
  const holdTimeoutRef = useRef<number | undefined>(undefined);
  const onCompleteRef = useRef(onComplete);
  const configRef = useRef<TimerMachineConfig>({
    inspectionSec,
  });

  onCompleteRef.current = onComplete;
  configRef.current = { inspectionSec };

  const clearHoldTimeout = useCallback(() => {
    if (holdTimeoutRef.current !== undefined) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = undefined;
    }
  }, []);

  const apply = useCallback((action: TimerMachineAction) => {
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
    if (transition.solve) onCompleteRef.current(transition.solve);
  }, [clearHoldTimeout, holdMs]);

  useEffect(() => clearHoldTimeout, [clearHoldTimeout]);

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

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || eventTargetsControl(event.target)) return;
      event.preventDefault();
      apply({ type: 'press-down', nowMs: performance.now() });
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || eventTargetsControl(event.target)) return;
      event.preventDefault();
      apply({ type: 'press-up', nowMs: performance.now() });
    };
    const cancelPress = () => {
      clearHoldTimeout();
      apply({ type: 'cancel-press' });
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', cancelPress);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', cancelPress);
    };
  }, [apply, clearHoldTimeout]);

  const pointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    apply({ type: 'press-down', nowMs: performance.now() });
  }, [apply]);

  const pointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    clearHoldTimeout();
    apply({ type: 'press-up', nowMs: performance.now() });
  }, [apply, clearHoldTimeout]);

  const pointerCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    clearHoldTimeout();
    apply({ type: 'cancel-press' });
  }, [apply, clearHoldTimeout]);

  return { machine, nowMs, pointerCancel, pointerDown, pointerUp };
}
