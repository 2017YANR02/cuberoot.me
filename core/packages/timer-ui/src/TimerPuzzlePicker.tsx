import { CubingIcon } from '@cuberoot/event-icon';
import { Boxes, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import {
  TIMER_OVERLAY_IDS,
  type TimerOverlayControlProps,
  type TimerOverlayOpenReason,
  useTimerOverlayControl,
} from './timer-overlay-control';

export interface TimerPuzzlePickerItem {
  id: string;
  label: string;
  iconClass?: string;
  textLabel?: string;
}

export interface TimerPuzzlePickerGroup {
  id: string;
  label: string;
  items: readonly TimerPuzzlePickerItem[];
}

export interface TimerPuzzlePickerProps extends TimerOverlayControlProps {
  disabled?: boolean;
  groups: readonly TimerPuzzlePickerGroup[];
  onSelect: (id: string) => void;
  puzzleLabel: string;
  selectedEvent: string;
  dataNoTimer?: boolean;
}

const VIEWPORT_MARGIN_PX = 8;

/**
 * The timer puzzle control shared verbatim by Web, Android, and iOS.
 * Event catalogs and scramble semantics remain the caller's domain; this
 * component owns the identical trigger, menu, focus, and viewport behavior.
 */
export function TimerPuzzlePicker({
  dataNoTimer,
  disabled = false,
  groups: suppliedGroups,
  onSelect,
  onOpenChange,
  open: controlledOpen,
  puzzleLabel,
  selectedEvent,
}: TimerPuzzlePickerProps) {
  const groups = suppliedGroups.filter((group) => group.items.length > 0);
  const [open, changeOpen] = useTimerOverlayControl({
    id: TIMER_OVERLAY_IDS.puzzlePicker,
    onOpenChange,
    open: controlledOpen,
  });
  const [compact, setCompact] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousOpenRef = useRef(open);
  const popupId = useId();
  const selectedItem = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === selectedEvent);

  const close = useCallback((reason: TimerOverlayOpenReason, restoreFocus = false) => {
    changeOpen(false, reason);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, [changeOpen]);

  useEffect(() => {
    if (disabled) close('disabled');
  }, [close, disabled]);

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
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close('outside');
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close('escape', true);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [close, open]);

  // Vite's modern CSS transform can emit Media Queries level-4 range syntax,
  // which older Android System WebViews ignore. Keep the shared picker responsive
  // from the actual layout viewport as well, without lowering the repo browser target.
  useLayoutEffect(() => {
    const updateCompact = () => setCompact(document.documentElement.clientWidth <= 480);
    updateCompact();
    window.addEventListener('resize', updateCompact);
    return () => window.removeEventListener('resize', updateCompact);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const clamp = () => {
      panel.style.marginLeft = '';
      const left = panel.getBoundingClientRect().left;
      const width = panel.offsetWidth;
      const viewportWidth = document.documentElement.clientWidth;
      const overflow = left + width - (viewportWidth - VIEWPORT_MARGIN_PX);
      const shift = Math.min(
        Math.max(0, overflow),
        Math.max(0, left - VIEWPORT_MARGIN_PX),
      );
      if (shift > 0) panel.style.marginLeft = `${-shift}px`;
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [open]);

  if (groups.length === 0) return null;

  const renderIcon = (item: TimerPuzzlePickerItem, trigger = false) => {
    const className = trigger ? 'pp-trigger-icon' : 'pp-item-icon';
    if (item.iconClass) return <CubingIcon className={className} icon={item.iconClass} />;
    return <span className={`${className} pp-item-tag`}>{item.textLabel ?? item.id}</span>;
  };

  return (
    <div className={`pp${compact ? ' pp--compact' : ''}`} data-no-timer={dataNoTimer ? '' : undefined} ref={rootRef}>
      <button
        aria-controls={open ? popupId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={selectedItem?.label ?? puzzleLabel}
        className={`pp-trigger${selectedItem ? ' pp-trigger--active' : ''}`}
        disabled={disabled}
        onClick={() => changeOpen(!open, 'trigger')}
        ref={triggerRef}
        type="button"
      >
        {selectedItem ? renderIcon(selectedItem, true) : <Boxes className="pp-trigger-icon" size={15} />}
        {!selectedItem && <span className="pp-trigger-label">{puzzleLabel}</span>}
        <ChevronDown className="pp-trigger-chevron" size={14} />
      </button>
      {open && (
        <div className="pp-popup" id={popupId} ref={panelRef} role="menu">
          {groups.map((group) => (
            <div className="pp-group" key={group.id}>
              <div className="pp-group-title">{group.label}</div>
              <div className="pp-group-items">
                {group.items.map((item) => {
                  const active = item.id === selectedEvent;
                  return (
                    <button
                      aria-current={active ? 'page' : undefined}
                      className={`pp-item${active ? ' pp-item--active' : ''}`}
                      key={item.id}
                      onClick={() => {
                        onSelect(item.id);
                        close('select', true);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      {renderIcon(item)}
                      <span className="pp-item-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
