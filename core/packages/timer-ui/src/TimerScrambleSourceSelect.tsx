import { ChevronDown, ChevronRight } from 'lucide-react';
import { TIMER_333_TRAINING_GROUPS } from '@cuberoot/shared/timer';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
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
  language?: 'en' | 'zh';
  trainingItems?: readonly { value: string; label: ReactNode }[];
  trainingValue?: string;
  onTrainingChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  labels: TimerScrambleSourceLabels;
  onChange: (value: TimerScrambleSourceValue<TReal>) => void;
  popupClassName?: string;
  /** Hide official scrambles when the selected puzzle has no real source. */
  realAvailable?: boolean;
  /** Canonical persisted source id. All active hosts pass `wca`. */
  realValue: TReal;
  /** Optional WCA settings shown at the second menu level. */
  realMenuContent?: ReactNode;
  triggerClassName?: string;
  showArrow?: boolean;
  value: TimerScrambleSourceValue<TReal>;
}

type CanonicalSource = 'real' | 'random' | 'manual';

const VIEWPORT_MARGIN_PX = 8;
const POPUP_GAP_PX = 6;

/**
 * The timer scramble-source control shared verbatim by Web, Android, and iOS.
 * Hosts own persistence and translated copy; this component owns the fixed
 * source menu, focus, dismissal, and viewport behavior.
 */
export function TimerScrambleSourceSelect<
  TReal extends TimerScrambleSourceRealValue,
>({
  language = 'en',
  trainingItems = [],
  trainingValue,
  onTrainingChange,
  className,
  disabled = false,
  labels,
  onChange,
  onOpenChange,
  open: controlledOpen,
  popupClassName,
  realAvailable = true,
  realValue,
  realMenuContent,
  triggerClassName,
  showArrow = true,
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
  const [groupId, setGroupId] = useState<string | null>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const groupTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const groups = TIMER_333_TRAINING_GROUPS.map(group => ({
    ...group,
    items: trainingItems.filter(item => (group.events as readonly string[]).includes(item.value)),
  })).filter(group => group.items.length > 0);
  const activeGroup = groups.find(group => group.id === groupId);
  const realMenuOpen = groupId === 'real' && realMenuContent != null;
  const submenuOpen = Boolean(activeGroup) || realMenuOpen;
  const ungroupedItems = trainingItems.filter(item => !groups.some(group => group.items.includes(item)));
  const canonicalValue: CanonicalSource = value === 'real' || value === 'wca'
    ? 'real'
    : value;
  const close = useCallback((reason: TimerOverlayOpenReason, restoreFocus = false) => {
    setGroupId(null);
    changeOpen(false, reason);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, [changeOpen]);

  const returnToGroups = useCallback(() => {
    const previousGroup = groupId;
    setGroupId(null);
    requestAnimationFrame(() => {
      if (previousGroup) groupTriggerRefs.current.get(previousGroup)?.focus();
    });
  }, [groupId]);

  useEffect(() => {
    if (!open) setGroupId(null);
  }, [open]);

  useLayoutEffect(() => {
    if (submenuOpen) {
      const firstOption = submenuRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
      (firstOption ?? submenuRef.current)?.focus();
    }
  }, [groupId, submenuOpen]);

  const items: ReadonlyArray<{ value: CanonicalSource; label: ReactNode }> = [
    ...(realAvailable ? [{ value: 'real' as const, label: labels.realOption }] : []),
    { value: 'random', label: labels.randomOption },
    { value: 'manual', label: labels.manualOption },
  ];
  const currentLabel = trainingItems.find((item) => item.value === trainingValue)?.label ?? {
    real: labels.real,
    random: labels.random,
    manual: labels.manual,
  }[canonicalValue];

  useEffect(() => {
    if (disabled && open) close('disabled');
  }, [close, disabled, open]);

  useEffect(() => {
    if (!open || disabled) return;
    // Contain even a short menu: an unscrollable popup cannot consume touch
    // overscroll itself, so lock the document for the popup's lifetime.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [disabled, open]);

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
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        if (submenuOpen) returnToGroups();
        else close('escape', true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [submenuOpen, close, disabled, open, returnToGroups]);

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
    const observer = new ResizeObserver(positionPanel);
    observer.observe(panel);
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [disabled, open, groupId]);

  return (
    <div
      className={['timer-scramble-source-select', className].filter(Boolean).join(' ')}
      data-no-timer
    >
      <button
        aria-controls={open ? popupId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
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
        {showArrow && <ChevronDown
          aria-hidden="true"
          className={`timer-scramble-source-arrow${open ? ' open' : ''}`}
          size={14}
          strokeWidth={2}
        />}
      </button>

      {open && !disabled && createPortal(
        <div
          aria-label={labels.ariaLabel}
          className={['timer-scramble-source-popup', popupClassName].filter(Boolean).join(' ')}
          data-site-surface="popover"
          data-real-menu={realMenuOpen || undefined}
          data-submenu={submenuOpen || undefined}
          data-no-timer
          id={popupId}
          ref={panelRef}
          role="dialog"
          onTouchMove={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="timer-scramble-source-options" role="listbox" aria-label={labels.ariaLabel}>
            {items.map((item) => {
              const active = !trainingValue && item.value === canonicalValue;
              return (
                <button
                  aria-selected={active}
                  aria-expanded={item.value === 'real' && realMenuContent != null ? realMenuOpen : undefined}
                  className={`timer-scramble-source-option timer-scramble-source-group${active ? ' active' : ''}`}
                  key={item.value}
                  ref={element => { if (item.value === 'real') { if (element) groupTriggerRefs.current.set('real', element); else groupTriggerRefs.current.delete('real'); } }}
                  onKeyDown={event => { if (event.key === 'ArrowRight' && item.value === 'real' && realMenuContent != null) { event.preventDefault(); event.currentTarget.click(); } }}
                  onClick={() => {
                    if (disabled) return;
                    const next = item.value === 'real' ? realValue : item.value;
                    if (item.value === 'real' && realMenuContent != null) {
                      if (canonicalValue !== 'real' || trainingValue) onChange(next as TimerScrambleSourceValue<TReal>);
                      setGroupId('real');
                      return;
                    }
                    onChange(next as TimerScrambleSourceValue<TReal>);
                    close('select', true);
                  }}
                  role="option"
                  type="button"
                >
                  {item.label}
                  {item.value === 'real' && realMenuContent != null && <ChevronRight size={14} aria-hidden="true" />}
                </button>
              );
            })}
            {groups.map(group => (
              <button
                aria-selected={group.items.some(item => item.value === trainingValue)}
                aria-haspopup="listbox"
                aria-expanded={group.id === groupId}
                className={`timer-scramble-source-option timer-scramble-source-group${group.items.some(item => item.value === trainingValue) ? ' active' : ''}`}
                key={group.id}
                ref={element => { if (element) groupTriggerRefs.current.set(group.id, element); else groupTriggerRefs.current.delete(group.id); }}
                onClick={() => setGroupId(group.id)}
                onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); setGroupId(group.id); } }}
                role="option"
                type="button"
              >{group.label[language]}<ChevronRight size={14} aria-hidden="true" /></button>
            ))}
            {ungroupedItems.map((item) => (
              <button
                aria-selected={item.value === trainingValue}
                className={`timer-scramble-source-option${item.value === trainingValue ? ' active' : ''}`}
                key={item.value}
                onClick={() => { onTrainingChange?.(item.value); close('select', true); }}
                role="option"
                type="button"
              >{item.label}</button>
            ))}
          </div>
          {submenuOpen && <div
            className="timer-scramble-source-secondary"
            ref={submenuRef}
            tabIndex={-1}
            role={realMenuOpen ? 'group' : 'listbox'}
            aria-label={realMenuOpen ? labels.ariaLabel : activeGroup?.label[language]}
            onKeyDown={event => {
              if (event.key === 'ArrowLeft' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
                event.preventDefault(); returnToGroups();
              }
            }}
          >
            {realMenuOpen ? <div className="timer-scramble-source-details">{realMenuContent}</div> : activeGroup?.items.map(item => (
              <button
                aria-selected={item.value === trainingValue}
                className={`timer-scramble-source-option${item.value === trainingValue ? ' active' : ''}`}
                key={item.value}
                onClick={() => { onTrainingChange?.(item.value); close('select', true); }}
                role="option"
                type="button"
              >{item.label}</button>
            ))}
          </div>}
        </div>,
        triggerRef.current?.closest('dialog, [role="dialog"]') ?? document.body,
      )}
    </div>
  );
}
