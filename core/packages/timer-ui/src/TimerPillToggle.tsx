import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

export interface TimerPillToggleProps {
  ariaLabel: string;
  disabled?: boolean;
  offLabel?: string;
  onChange: (value: boolean) => void;
  onLabel?: string;
  value: boolean;
}

/** Pointer/touch/keyboard switch shared by every Web and native timer host. */
export function TimerPillToggle({
  ariaLabel,
  disabled = false,
  offLabel,
  onChange,
  onLabel,
  value,
}: TimerPillToggleProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ moved: boolean; startX: number } | null>(null);
  const labelled = onLabel !== undefined || offLabel !== undefined;
  const valueFromX = (clientX: number): boolean => {
    const element = ref.current;
    if (!element) return value;
    const bounds = element.getBoundingClientRect();
    return clientX - bounds.left > bounds.width / 2;
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { moved: false, startX: event.clientX };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* unsupported WebView */ }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    if (!state.moved && Math.abs(event.clientX - state.startX) > 3) state.moved = true;
    if (!state.moved) return;
    const next = valueFromX(event.clientX);
    if (next !== value) onChange(next);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    drag.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* unsupported WebView */ }
    if (state && !state.moved) onChange(!value);
  };
  const onPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* unsupported WebView */ }
  };

  return (
    <button
      aria-checked={value}
      aria-label={ariaLabel}
      className={`timer-222-mode-toggle${labelled ? '' : ' timer-222-mode-toggle--switch'}${value ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={(event) => {
        if (event.detail === 0) onChange(!value);
      }}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={ref}
      role="switch"
      type="button"
    >
      {labelled && (
        <span className="timer-222-mode-toggle-label">
          <span aria-hidden="true" className="timer-222-mode-toggle-ghost">{onLabel}</span>
          <span aria-hidden="true" className="timer-222-mode-toggle-ghost">{offLabel}</span>
          <span>{value ? onLabel : offLabel}</span>
        </span>
      )}
      <span aria-hidden="true" className="timer-222-mode-toggle-dot" />
    </button>
  );
}
