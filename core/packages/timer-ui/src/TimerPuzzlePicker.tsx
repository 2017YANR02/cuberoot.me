import { CubingIcon } from '@cuberoot/event-icon';
import { TIMER_333_SCRAMBLE_TYPES, timerEventIdFromSelector, timerPuzzleSelection } from '@cuberoot/shared/timer';
import { Boxes, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import {
  TIMER_OVERLAY_IDS,
  type TimerOverlayControlProps,
  type TimerOverlayOpenReason,
  useTimerOverlayControl,
} from './timer-overlay-control';
import { CompactSelect } from './CompactSelect';

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
  /** Enable the puzzle/type split on timer controls; data import may keep raw modes. */
  scrambleTypeLabel?: string;
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
  scrambleTypeLabel,
}: TimerPuzzlePickerProps) {
  const availableItems = suppliedGroups.flatMap((group) => group.items);
  const separateTypes = Boolean(scrambleTypeLabel && availableItems.some((item) => item.id === '333'));
  const storedEvent = timerEventIdFromSelector(selectedEvent);
  const selection = storedEvent ? timerPuzzleSelection(storedEvent) : null;
  // Non-training selectors may use WCA spellings such as 333bf; keep their UI identity.
  const selectedPuzzle = separateTypes && selection?.puzzle === '333' ? '333' : selectedEvent;
  const groups = suppliedGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !separateTypes || !TIMER_333_SCRAMBLE_TYPES.some(
      (type) => type.event !== '333' && type.event === item.id,
    )),
  })).filter((group) => group.items.length > 0);
  const scrambleTypes = TIMER_333_SCRAMBLE_TYPES.filter((type) => availableItems.some((item) => item.id === type.event));
  const [activeMenu, setActiveMenu] = useState<'puzzle' | 'type'>('puzzle');
  const [expanded, changeOpen] = useTimerOverlayControl({
    id: TIMER_OVERLAY_IDS.puzzlePicker,
    onOpenChange,
    open: controlledOpen,
  });
  const open = expanded && activeMenu === 'puzzle';
  const [compact, setCompact] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousOpenRef = useRef(open);
  const popupId = useId();
  const selectedItem = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === selectedPuzzle);

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
    <>
    <div className={`pp${compact ? ' pp--compact' : ''}`} data-no-timer={dataNoTimer ? '' : undefined} ref={rootRef}>
      <button
        aria-controls={open ? popupId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={selectedItem?.label ?? puzzleLabel}
        className={`pp-trigger${selectedItem ? ' pp-trigger--active' : ''}`}
        disabled={disabled}
        onClick={() => { setActiveMenu('puzzle'); changeOpen(!open, 'trigger'); }}
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
                  const active = item.id === selectedPuzzle;
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
    {separateTypes && selectedPuzzle === '333' && scrambleTypes.length > 1 && (
      <CompactSelect
        variant="plain"
        className="timer-scramble-type-select"
        open={expanded && activeMenu === 'type'}
        onOpenChange={(next) => {
          setActiveMenu('type');
          changeOpen(next, next ? 'trigger' : 'select');
        }}
        ariaLabel={scrambleTypeLabel!}
        dataNoTimer={dataNoTimer}
        disabled={disabled}
        label={storedEvent === '333' ? 'WCA' : availableItems.find((item) => item.id === storedEvent)?.label ?? 'WCA'}
        items={scrambleTypes.map((type) => ({
          value: type.event,
          label: type.event === '333' ? 'WCA' : availableItems.find((item) => item.id === type.event)!.label,
        }))}
        value={storedEvent ?? '333'}
        onChange={onSelect}
      />
    )}
    </>
  );
}
