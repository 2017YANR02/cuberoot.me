import { useEffect, useEffectEvent, useRef, useState } from 'react';

const HOLD_MS = 300;
type Phase = 'scramble' | 'inspection' | 'solve';
const isSpace = (event: KeyboardEvent) => event.code === 'Space' || event.key === ' ';

export function useCompetitionTimerControls({ phase, disabled, onInspect, onStart, onStop }: {
  phase: Phase; disabled: boolean; onInspect: () => void; onStart: () => void; onStop: () => void;
}) {
  const hold = useRef<{ since: number; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const [ready, setReady] = useState(false);

  function cancelHold() {
    if (!hold.current) return;
    clearTimeout(hold.current.timeout);
    hold.current = null;
    setReady(false);
  }

  function beginHold() {
    if (disabled || phase !== 'inspection' || hold.current) return;
    hold.current = { since: performance.now(), timeout: setTimeout(() => setReady(true), HOLD_MS) };
  }

  function releaseHold() {
    if (!hold.current) return false;
    const heldLongEnough = performance.now() - hold.current.since >= HOLD_MS;
    cancelHold();
    if (heldLongEnough && !disabled && phase === 'inspection') onStart();
    return true;
  }

  const keyDown = useEffectEvent((event: KeyboardEvent) => {
    if (disabled || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="dialog"], dialog, [role="listbox"]')) return;
    if (phase === 'solve') {
      if (['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return;
      event.preventDefault();
      onStop();
      return;
    }
    if (!isSpace(event) || target?.closest('a, button:not([data-competition-timer-control]), summary')) return;
    event.preventDefault();
    if (phase === 'scramble') onInspect();
    else beginHold();
  });
  const keyUp = useEffectEvent((event: KeyboardEvent) => {
    if (isSpace(event) && releaseHold()) event.preventDefault();
  });
  const blur = useEffectEvent(cancelHold);
  useEffect(() => {
    const down = (event: KeyboardEvent) => keyDown(event);
    const up = (event: KeyboardEvent) => keyUp(event);
    const lostFocus = () => blur();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', lostFocus);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', lostFocus);
      if (hold.current) clearTimeout(hold.current.timeout);
      hold.current = null;
    };
  }, []);
  useEffect(() => {
    if (disabled || phase !== 'inspection') blur();
  }, [disabled, phase]);

  return { ready: ready && !disabled, beginHold, releaseHold, cancelHold };
}
