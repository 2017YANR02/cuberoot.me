import { ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import {
  TIMER_OVERLAY_IDS,
  type TimerOverlayControlProps,
  type TimerOverlayOpenReason,
  useTimerOverlayControl,
} from './timer-overlay-control';

export type TimerScrambleSourceRealValue = 'real' | 'wca';
export type TimerScrambleSourceValue<TReal extends TimerScrambleSourceRealValue> =
  | TReal
  | 'random'
  | 'manual';

export interface TimerScrambleSourceLabels {
  ariaLabel: string;
  manual: ReactNode;
  manualOption: ReactNode;
  random: ReactNode;
  randomOption: ReactNode;
  real: ReactNode;
  realOption: ReactNode;
}

export interface TimerScrambleSourceSelectProps<
  TReal extends TimerScrambleSourceRealValue = TimerScrambleSourceRealValue,
> extends TimerOverlayControlProps {
  className?: string;
  disabled?: boolean;
  labels: TimerScrambleSourceLabels;
  onChange: (value: TimerScrambleSourceValue<TReal>) => void;
  popupClassName?: string;
  /** Canonical persisted source id. All active hosts pass `wca`. */
  realValue: TReal;
  triggerClassName?: string;
  value: TimerScrambleSourceValue<TReal>;
}

type CanonicalSource = 'real' | 'random' | 'manual';

const VIEWPORT_MARGIN_PX = 8;
const POPUP_GAP_PX = 6;

/**
 * The timer scramble-source control shared verbatim by Web, Android, and iOS.
 * Hosts own persistence and translated copy; this component owns the fixed
 * three-source menu, focus, dismissal, and viewport behavior.
 */
export function TimerScrambleSourceSelect<
  TReal extends TimerScrambleSourceRealValue,
>({
  className,
  disabled = false,
  labels,
  onChange,
  onOpenChange,
  open: controlledOpen,
  popupClassName,
  realValue,
  triggerClassName,
  value,
}: TimerScrambleSourceSelectProps<TReal>) {
  const [open, changeOpen] = useTimerOverlayControl({
    id: TIMER_OVERLAY_IDS.scrambleSource,
    onOpenChange,
    open: controlledOpen,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousOpenRef = useRef(open);
  const popupId = useId();
  const canonicalValue: CanonicalSource = value === 'real' || value === 'wca'
    ? 'real'
    : value;
  const close = useCallback((reason: TimerOverlayOpenReason, restoreFocus = false) => {
    changeOpen(false, reason);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, [changeOpen]);

  const items: ReadonlyArray<{ value: CanonicalSource; label: ReactNode }> = [
    { value: 'real', label: labels.realOption },
    { value: 'random', label: labels.randomOption },
    { value: 'manual', label: labels.manualOption },
  ];
  const currentLabel = {
    real: labels.real,
    random: labels.random,
    manual: labels.manual,
  }[canonicalValue];

  useEffect(() => {
    if (disabled && open) close('disabled');
  }, [close, disabled, open]);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;
    if (controlledOpen !== undefined && wasOpen && !open) {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || active === document.body || panelRef.current?.contains(active)) {
          triggerRef.current?.focus();
        }
      });
    }
  }, [controlledOpen, open]);

  useEffect(() => {
    if (!open || disabled) return;
    const inside = (target: Node | null): boolean => (
      !!target
      && (!!panelRef.current?.contains(target) || !!triggerRef.current?.contains(target))
    );
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target as Node)) close('outside');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close('escape', true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, disabled, open]);

  useLayoutEffect(() => {
    if (!open || disabled) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const positionPanel = () => {
      const anchor = trigger.getBoundingClientRect();
      const maxLeft = Math.max(
        VIEWPORT_MARGIN_PX,
        window.innerWidth - panel.offsetWidth - VIEWPORT_MARGIN_PX,
      );
      const left = Math.min(Math.max(VIEWPORT_MARGIN_PX, anchor.left), maxLeft);
      const below = anchor.bottom + POPUP_GAP_PX;
      const top = below + panel.offsetHeight <= window.innerHeight - VIEWPORT_MARGIN_PX
        ? below
        : Math.max(
            VIEWPORT_MARGIN_PX,
            anchor.top - POPUP_GAP_PX - panel.offsetHeight,
          );
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.visibility = 'visible';
    };

    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [disabled, open]);

  return (
    <div
      className={['timer-scramble-source-select', className].filter(Boolean).join(' ')}
      data-no-timer
    >
      <button
        aria-controls={open ? popupId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={labels.ariaLabel}
        className={['timer-scramble-source-trigger', triggerClassName].filter(Boolean).join(' ')}
        disabled={disabled}
        onClick={() => {
          if (!disabled) changeOpen(!open, 'trigger');
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="timer-scramble-source-current">{currentLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={`timer-scramble-source-arrow${open ? ' open' : ''}`}
          size={14}
          strokeWidth={2}
        />
      </button>

      {open && !disabled && createPortal(
        <div
          aria-label={labels.ariaLabel}
          className={['timer-scramble-source-popup', popupClassName].filter(Boolean).join(' ')}
          data-no-timer
          id={popupId}
          ref={panelRef}
          role="listbox"
        >
          <div className="timer-scramble-source-options">
            {items.map((item) => {
              const active = item.value === canonicalValue;
              return (
                <button
                  aria-selected={active}
                  className={`timer-scramble-source-option${active ? ' active' : ''}`}
                  key={item.value}
                  onClick={() => {
                    if (disabled) return;
                    const next = item.value === 'real' ? realValue : item.value;
                    onChange(next as TimerScrambleSourceValue<TReal>);
                    close('select', true);
                  }}
                  role="option"
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
