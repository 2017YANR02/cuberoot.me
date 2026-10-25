import { variantLabel, stageLabel } from '@cuberoot/shared/timer/scramble-variants';
import { CubingIcon } from '@cuberoot/event-icon';
import { TIMER_333_SCRAMBLE_TYPES, timerEventIdFromSelector, timerPuzzleSelection } from '@cuberoot/shared/timer';
import { Boxes, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import {
  TIMER_OVERLAY_IDS,
  type TimerOverlayControlProps,
  type TimerOverlayOpenReason,
  useTimerOverlayControl,
} from './timer-overlay-control';
import { CompactSelect } from './CompactSelect';
import { SearchInput } from './SearchInput';
import { usePopoverPosition } from './usePopoverPosition';

export interface TimerPuzzlePickerItem {
  id: string;
  label: string;
  iconClass?: string;
  textLabel?: string;
  searchText?: string;
  detail?: string;
  disabled?: boolean;
  /** Optional second level, such as formula sets belonging to this puzzle. */
  children?: readonly Pick<TimerPuzzlePickerItem, 'id' | 'label' | 'iconClass' | 'textLabel' | 'searchText' | 'detail' | 'disabled'>[];
}

export interface TimerPuzzlePickerGroup {
  id: string;
  label: string;
  items: readonly TimerPuzzlePickerItem[];
}

export interface TimerPuzzlePickerProps extends TimerOverlayControlProps {
  /** Optional catalog discovery; shared behavior, labels and storage scope supplied by host. */
  discovery?: {
    storageKey: string;
    searchLabel: string;
    clearLabel: string;
    emptyLabel: string;
    resultsLabel: string;
    recentLabel: string;
    favoritesLabel: string;
    favoriteLabel: string;
    unfavoriteLabel: string;
  };
  disabled?: boolean;
  groups: readonly TimerPuzzlePickerGroup[];
  onSelect: (id: string) => void;
  puzzleLabel: string;
  selectedEvent: string;
  dataNoTimer?: boolean;
  /** Enable the puzzle/type split on timer controls; data import may keep raw modes. */
  scrambleTypeLabel?: string;
  /** The host renders training choices in its combined source menu. */
  combineScrambleTypes?: boolean;
  /** Text-only trigger for directories such as training. */
  triggerLabel?: string;
  showArrow?: boolean;
  showItemIcons?: boolean;
  showMenuHeadings?: boolean;
  showSubmenuHeading?: boolean;
  submenuLabel?: string;
  /** Mouse hover opens both levels at the current selection. Touch remains click-driven. */
  openOnHover?: boolean;
}

/**
 * The timer puzzle control shared verbatim by Web, Android, and iOS.
 * Event catalogs and scramble semantics remain the caller's domain; this
 * component owns the identical trigger, menu, focus, and viewport behavior.
 */
export function TimerPuzzlePicker({
  dataNoTimer,
  discovery,
  disabled = false,
  groups: suppliedGroups,
  onSelect,
  onOpenChange,
  open: controlledOpen,
  puzzleLabel,
  selectedEvent,
  scrambleTypeLabel,
  combineScrambleTypes = false,
  triggerLabel,
  showArrow = false,
  showItemIcons = true,
  showMenuHeadings = true,
  showSubmenuHeading = showMenuHeadings,
  submenuLabel,
  openOnHover = false,
}: TimerPuzzlePickerProps) {
  const [query, setQuery] = useState('');
  const [preferences, setPreferences] = useState<{ recent: string[]; favorites: string[] }>({ recent: [], favorites: [] });
  useEffect(() => {
    if (!discovery) return;
    try {
      const saved = JSON.parse(localStorage.getItem(discovery.storageKey) ?? '{}');
      const ids = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))].slice(0, 100) : [];
      setPreferences({ recent: ids(saved.recent).slice(0, 8), favorites: ids(saved.favorites) });
    } catch { setPreferences({ recent: [], favorites: [] }); }
  }, [discovery?.storageKey]);
  const savePreferences = (next: typeof preferences) => {
    setPreferences(next);
    if (discovery) {
      try { localStorage.setItem(discovery.storageKey, JSON.stringify(next)); } catch { /* Session preferences still work. */ }
    }
  };
  const select = (id: string) => {
    if (discovery) savePreferences({ ...preferences, recent: [id, ...preferences.recent.filter(value => value !== id)].slice(0, 8) });
    onSelect(id);
  };
  const availableItems = suppliedGroups.flatMap((group) => group.items);
  const separateTypes = Boolean(scrambleTypeLabel && availableItems.some((item) => item.id === '333'));
  const storedEvent = timerEventIdFromSelector(selectedEvent);
  const selection = storedEvent ? timerPuzzleSelection(storedEvent) : null;
  // Non-training selectors may use WCA spellings such as 333bf; keep their UI identity.
  const selectedPuzzle = combineScrambleTypes && (selectedEvent === 'eg1' || selectedEvent === 'eg2')
    ? '222' : separateTypes && selection?.puzzle === '333' ? '333' : selectedEvent;
  const groups = suppliedGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !(combineScrambleTypes && (item.id === 'eg1' || item.id === 'eg2')) && (!separateTypes || !TIMER_333_SCRAMBLE_TYPES.some(
      (type) => type.event !== '333' && type.event === item.id,
    ))),
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
  const [submenuId, setSubmenuId] = useState<string | null>(null);
  const focusSubmenu = useRef(true);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHoverClose = () => {
    if (hoverCloseTimer.current !== null) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = null;
  };
  useEffect(() => cancelHoverClose, []);
  const submenuRef = useRef<HTMLDivElement>(null);
  const parentRefs = useRef(new Map<string, HTMLButtonElement>());
  const hasSubmenus = !query.trim() && availableItems.some(item => item.children?.length);
  const leaves = groups.flatMap(group => group.items.flatMap(item => item.children?.length
    ? item.children.map(child => ({ ...child, detail: `${group.label} / ${item.label}` }))
    : [{ ...item, detail: group.label }]));
  const uniqueLeaves = [...new Map(leaves.map(item => [item.id, item])).values()];
  const shortcutItems = (ids: string[]) => ids.flatMap(id => { const item = uniqueLeaves.find(item => item.id === id); return item ? [item] : []; });
  const shortcuts: TimerPuzzlePickerGroup[] = discovery ? [
    { id: 'picker-favorites', label: discovery.favoritesLabel, items: shortcutItems(preferences.favorites) },
    { id: 'picker-recent', label: discovery.recentLabel, items: shortcutItems(preferences.recent) },
  ].filter(group => group.items.length) : [];
  const normalizeSearch = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s×_-]+/g, '');
  const needle = normalizeSearch(query);
  const menuGroups: TimerPuzzlePickerGroup[] = needle && discovery
    ? [{ id: 'picker-search', label: discovery.resultsLabel, items: uniqueLeaves.filter(item => normalizeSearch(`${item.id} ${item.label} ${item.searchText ?? ''} ${item.detail}`).includes(needle)) }]
    : [...groups.slice(0, groups[0]?.id === 'wca' ? 1 : 0), ...shortcuts, ...groups.slice(groups[0]?.id === 'wca' ? 1 : 0)];
  const submenu = availableItems.find(item => item.id === submenuId && item.children?.length);
  const selectedItem = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === selectedPuzzle || item.children?.some(child => child.id === selectedPuzzle));
  const selectedChild = selectedItem?.children?.find(item => item.id === selectedPuzzle);
  const selectedChoice = selectedChild ?? selectedItem;
  const triggerText = triggerLabel ?? (selectedChild && !selectedChild.iconClass && !selectedChild.textLabel
    ? selectedChild.label : undefined);

  const close = useCallback((reason: TimerOverlayOpenReason, restoreFocus = false) => {
    setSubmenuId(null);
    setQuery('');
    changeOpen(false, reason);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, [changeOpen]);

  const closeSubmenu = useCallback(() => {
    const parent = submenuId;
    if (parent) parentRefs.current.get(parent)?.focus();
    setSubmenuId(null);
  }, [submenuId]);

  useLayoutEffect(() => {
    if (open && submenuId && focusSubmenu.current) submenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open, submenuId]);

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
      if (event.key === 'Escape') {
        if (submenuId) closeSubmenu();
        else close('escape', true);
      }
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [close, closeSubmenu, open, submenuId]);

  // Vite's modern CSS transform can emit Media Queries level-4 range syntax,
  // which older Android System WebViews ignore. Keep the shared picker responsive
  // from the actual layout viewport as well, without lowering the repo browser target.
  useLayoutEffect(() => {
    const updateCompact = () => setCompact(document.documentElement.clientWidth <= 480);
    updateCompact();
    window.addEventListener('resize', updateCompact);
    return () => window.removeEventListener('resize', updateCompact);
  }, []);

  const panelStyle = usePopoverPosition({
    open, triggerRef, panelRef, allowAnchorOverlap: true,
    contentKey: JSON.stringify([submenuId, query, compact, menuGroups.map(group => group.items.length)]),
    scrollColumnSelector: hasSubmenus ? '.pp-cascade-column' : undefined,
  });

  if (groups.length === 0) return null;

  const renderIcon = (item: TimerPuzzlePickerItem, trigger = false) => {
    const className = trigger ? 'pp-trigger-icon' : 'pp-item-icon';
    if (item.iconClass) return <CubingIcon className={className} icon={item.iconClass} />;
    return <span className={`${className} pp-item-tag`}>{item.textLabel ?? item.id}</span>;
  };

  return (
    <>
    <div className={`pp${compact ? ' pp--compact' : ''}`} data-no-timer={dataNoTimer ? '' : undefined} ref={rootRef}
      onPointerEnter={cancelHoverClose}
      onPointerLeave={event => {
        if (!openOnHover || event.pointerType !== 'mouse') return;
        cancelHoverClose();
        hoverCloseTimer.current = setTimeout(() => close('outside'), 150);
      }}
      onKeyDown={event => {
        if (!open || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        if (submenuId) closeSubmenu();
        else close('escape', true);
      }}>
      <button
        aria-controls={open ? popupId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerLabel ?? selectedChoice?.label ?? puzzleLabel}
        className={`pp-trigger${selectedItem ? ' pp-trigger--active' : ''}`}
        disabled={disabled}
        onPointerEnter={event => {
          if (!openOnHover || disabled || event.pointerType !== 'mouse' || open) return;
          cancelHoverClose();
          focusSubmenu.current = false;
          setActiveMenu('puzzle');
          setSubmenuId(selectedItem?.children?.length ? selectedItem.id : null);
          changeOpen(true, 'trigger');
        }}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault(); setActiveMenu('puzzle'); changeOpen(true, 'trigger');
          requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('input, [role="menuitem"]')?.focus());
        }}
        onClick={() => {
          cancelHoverClose();
          focusSubmenu.current = true;
          setActiveMenu('puzzle');
          setSubmenuId(!open && openOnHover && selectedItem?.children?.length ? selectedItem.id : null);
          changeOpen(!open, 'trigger');
        }}
        ref={triggerRef}
        type="button"
      >
        {triggerText ? <span className="pp-trigger-label">{triggerText}</span> : <>
          {selectedChoice ? renderIcon(selectedChoice, true) : <Boxes className="pp-trigger-icon" size={15} />}
          {!selectedChoice && <span className="pp-trigger-label">{puzzleLabel}</span>}
        </>}
        {showArrow && <ChevronDown className="pp-trigger-chevron" size={14} />}
      </button>
      {open && (
        <div className={`pp-popup${hasSubmenus ? ' pp-popup--nested' : ''}${discovery ? ' pp-popup--discovery' : ''}`} id={popupId} ref={panelRef} role="menu"
          popover="manual" style={panelStyle}
          data-site-surface={hasSubmenus ? 'popover' : undefined}
          onKeyDown={event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            if (event.target instanceof HTMLInputElement && event.key !== 'ArrowDown') return;
            const menu = (event.target as Element).closest('[role="menu"]');
            const items = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
              .filter(item => item.closest('[role="menu"]') === menu);
            if (!items.length) return;
            event.preventDefault();
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next].focus();
          }}>

          <div className={hasSubmenus ? 'pp-cascade-column' : undefined}>
          {discovery && <div className="pp-discovery">
            <SearchInput value={query} onChange={value => { setQuery(value); setSubmenuId(null); }}
              placeholder={discovery.searchLabel} clearLabel={discovery.clearLabel} />
            {selectedChoice && <button type="button" className="pp-favorite" aria-pressed={preferences.favorites.includes(selectedPuzzle)}
              aria-label={preferences.favorites.includes(selectedPuzzle) ? discovery.unfavoriteLabel : discovery.favoriteLabel}
              onClick={() => savePreferences({ ...preferences, favorites: preferences.favorites.includes(selectedPuzzle)
                ? preferences.favorites.filter(id => id !== selectedPuzzle) : [...preferences.favorites, selectedPuzzle] })}>
              <Star size={16} aria-hidden="true" />
            </button>}
          </div>}
          {needle && !menuGroups[0]?.items.length && <p className="pp-empty" role="status">{discovery?.emptyLabel}</p>}
          {menuGroups.map((group) => (
            <div className="pp-group" key={group.id}>
              {showMenuHeadings && group.label && <div className="pp-group-title">{group.label}</div>}
              <div className="pp-group-items">
                {group.items.map((item) => {
                  const active = submenu ? submenu.id === item.id : selectedItem?.id === item.id || selectedPuzzle === item.id;
                  const hasChildren = Boolean(item.children?.length);
                  return (
                    <button
                      aria-current={selectedItem?.id === item.id || selectedPuzzle === item.id ? 'page' : undefined}
                      aria-haspopup={hasChildren ? 'menu' : undefined}
                      aria-expanded={hasChildren ? submenuId === item.id : undefined}
                      aria-controls={hasChildren && submenuId === item.id ? `${popupId}-submenu` : undefined}
                      className={`pp-item${active ? ' pp-item--active' : ''}`}
                      key={item.id}
                      ref={node => { if (node) parentRefs.current.set(item.id, node); else parentRefs.current.delete(item.id); }}
                      onPointerEnter={event => {
                        if (!openOnHover || item.disabled || event.pointerType !== 'mouse') return;
                        focusSubmenu.current = false;
                        setSubmenuId(hasChildren ? item.id : null);
                      }}
                      onKeyDown={event => {
                        if (hasChildren && event.key === 'ArrowRight') {
                          event.preventDefault();
                          focusSubmenu.current = true;
                          setSubmenuId(item.id);
                        }
                      }}
                      onClick={() => {
                        if (hasChildren) { focusSubmenu.current = true; setSubmenuId(item.id); return; }
                        select(item.id);
                        close('select', true);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      {showItemIcons && (!hasSubmenus || item.iconClass || item.textLabel) && renderIcon(item)}
                      <span className="pp-item-label">{item.label}{needle && item.detail && <small className="pp-item-path">{item.detail}</small>}</span>
                      {hasChildren && <ChevronRight className="pp-submenu-arrow" size={14} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
          {submenu && <div className="pp-cascade-column pp-cascade-options" ref={submenuRef}
            id={`${popupId}-submenu`} role="menu" aria-label={submenuLabel ?? submenu.label}
            onKeyDown={event => {
              if (event.key === 'ArrowLeft') { event.preventDefault(); closeSubmenu(); }
            }}>
            {showSubmenuHeading && <div className="pp-group-title">{submenuLabel ?? submenu.label}</div>}
            {submenu.children!.map(item => (
              <button key={item.id} type="button" role="menuitem" disabled={item.disabled}
                aria-current={item.id === selectedPuzzle ? 'page' : undefined}
                className={`pp-item${item.id === selectedPuzzle ? ' pp-item--active' : ''}`}
                onClick={() => { onSelect(item.id); close('select', true); }}>
                {showItemIcons && (item.iconClass || item.textLabel) && renderIcon(item)}
                <span className="pp-item-label">{item.label}</span>
              </button>
            ))}
          </div>}
        </div>
      )}
    </div>
    {!combineScrambleTypes && separateTypes && selectedPuzzle === '333' && scrambleTypes.length > 1 && (
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

/** Shared method/stage presentation; callers retain supported options and data identities. */
export function MethodStagePicker({ method, stage, methods, stagesOf, isZh, onSelect, disabled = false, stagesDisabled = false }: {
  method: string;
  stage: string;
  methods: readonly string[];
  stagesOf(method: string): readonly string[];
  stagesDisabled?: boolean;
  isZh: boolean;
  onSelect(method: string, stage: string): void;
  disabled?: boolean;
}) {
  const labels = { zh: '方法与阶段', en: 'Method and stage' };
  const stages = stagesOf(method);
  const methodName = variantLabel(method, isZh);
  const stageName = stages.length ? stageLabel(stage, isZh) : '';
  const label = !stageName ? methodName : method === 'std' || methodName === stageName
    ? stageName : [methodName, stageName].join(' ');
  return <TimerPuzzlePicker
    openOnHover
    disabled={disabled} showArrow={false} showItemIcons={false}
    showMenuHeadings={false} showSubmenuHeading={false}
    puzzleLabel={labels[isZh ? 'zh' : 'en']} triggerLabel={label}
    selectedEvent={stages.length ? JSON.stringify([method, stage]) : JSON.stringify([method, ''])}
    groups={[{ id: 'methods', label: '', items: methods.map(key => ({
      id: JSON.stringify([key, '']), label: variantLabel(key, isZh),
      children: stagesOf(key).map(value => ({ id: JSON.stringify([key, value]), label: stageLabel(value, isZh), disabled: stagesDisabled })),
    })) }]}
    onSelect={id => { const [nextMethod, nextStage] = JSON.parse(id) as [string, string]; onSelect(nextMethod, nextStage); }}
  />;
}
