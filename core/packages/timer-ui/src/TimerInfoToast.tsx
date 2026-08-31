'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

export interface TimerInfoToastProps {
  /** Default matches the existing Web undo window. Set null to keep it open. */
  durationMs?: number | null;
  message: string;
  onDismiss: () => void;
  onUndo?: () => void;
  undoLabel: string;
  /** Fixed native chrome below the toast, such as Mobile's three-tab bar. */
  viewportBottomInset?: number;
}

/** Shared timer status/undo toast used by gesture and history mutations. */
export function TimerInfoToast({
  durationMs = 5000,
  message,
  onDismiss,
  onUndo,
  undoLabel,
  viewportBottomInset = 0,
}: TimerInfoToastProps) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (durationMs === null) return;
    const timeout = window.setTimeout(
      () => dismissRef.current(),
      Math.max(0, durationMs),
    );
    return () => window.clearTimeout(timeout);
  }, [durationMs, message]);

  const style = {
    '--timer-info-toast-bottom-inset': `${Math.max(0, viewportBottomInset)}px`,
  } as CSSProperties;

  return (
    <div
      aria-live="polite"
      className="timer-info-toast"
      data-no-timer
      role="status"
      style={style}
    >
      <span className="timer-info-toast-message">{message}</span>
      {onUndo && (
        <button
          className="timer-info-toast-undo"
          onClick={() => {
            onUndo();
            dismissRef.current();
          }}
          type="button"
        >
          {undoLabel}
        </button>
      )}
    </div>
  );
}
