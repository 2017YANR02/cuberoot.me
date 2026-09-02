import { useCallback, useRef, useState } from 'react';

export const TIMER_OVERLAY_IDS = {
  drillPicker: 'timer.drill-picker',
  historyCompare: 'timer.history-compare',
  historyQuickMenu: 'timer.history-quick-menu',
  solveDetail: 'timer.solve-detail',
  puzzlePicker: 'timer.puzzle-picker',
  scrambleSource: 'timer.scramble-source',
  sessionSwitcher: 'timer.session-switcher',
  wcaCompetition: 'timer.wca-competition',
  wcaScrambleMarks: 'timer.wca-scramble-marks',
} as const;

export type TimerOverlayId = typeof TIMER_OVERLAY_IDS[keyof typeof TIMER_OVERLAY_IDS];

export type TimerOverlayOpenReason =
  | 'clear'
  | 'data-change'
  | 'disabled'
  | 'escape'
  | 'focus'
  | 'focus-out'
  | 'input'
  | 'keyboard'
  | 'operation'
  | 'outside'
  | 'select'
  | 'trigger';

export interface TimerOverlayOpenChangeDetails {
  id: TimerOverlayId;
  reason: TimerOverlayOpenReason;
}

/**
 * Shared controlled/uncontrolled contract for timer popovers. A Mobile host can
 * track the currently open id and set `open={false}` from Android Back without
 * replacing any of the Web component's focus, dismissal, or layout behavior.
 */
export interface TimerOverlayControlProps {
  onOpenChange?: (open: boolean, details: TimerOverlayOpenChangeDetails) => void;
  open?: boolean;
}

interface UseTimerOverlayControlOptions extends TimerOverlayControlProps {
  id: TimerOverlayId;
}

/** Package-internal state adapter. Consumers use the component props above. */
export function useTimerOverlayControl({
  id,
  onOpenChange,
  open: controlledOpen,
}: UseTimerOverlayControlOptions): readonly [
  open: boolean,
  changeOpen: (open: boolean, reason: TimerOverlayOpenReason) => void,
] {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const openRef = useRef(open);
  const controlledOpenRef = useRef(controlledOpen);
  const onOpenChangeRef = useRef(onOpenChange);
  openRef.current = open;
  controlledOpenRef.current = controlledOpen;
  onOpenChangeRef.current = onOpenChange;
  const changeOpen = useCallback((next: boolean, reason: TimerOverlayOpenReason) => {
    if (next === openRef.current) return;
    openRef.current = next;
    if (controlledOpenRef.current === undefined) {
      setInternalOpen(next);
    }
    onOpenChangeRef.current?.(next, { id, reason });
  }, [id]);
  return [open, changeOpen] as const;
}
