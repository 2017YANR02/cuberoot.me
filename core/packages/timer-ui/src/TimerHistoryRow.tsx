'use client';

import {
  TIMER_HISTORY_QUICK_ACTION_CONTRACTS,
  formatSolveResult,
  timerHistoryQuickActionStates,
  type Penalty,
  type Solve,
  type TimerHistoryQuickActionId,
  type TimerHistoryQuickActionState,
} from '@cuberoot/shared/timer';
import { Check, Clipboard, MessageSquare, Trash2 } from 'lucide-react';
import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';

import {
  TIMER_OVERLAY_IDS,
  useTimerOverlayControl,
  type TimerOverlayControlProps,
  type TimerOverlayOpenReason,
} from './timer-overlay-control';
import { usePopoverDismiss } from './usePopoverDismiss';

export type TimerHistoryQuickMenuVariant = 'popup' | 'sheet';
export type TimerHistorySelectionMode = 'none' | 'compare' | 'select';

export interface TimerHistoryQuickMenuLabels {
  actions: Readonly<Record<TimerHistoryQuickActionId, string>>;
  /** Optional explanatory tooltips, keyed by the same shared action IDs. */
  actionTitles?: Readonly<Partial<Record<TimerHistoryQuickActionId, string>>>;
  menu: string;
}

/**
 * Platform effects for the shared row menu. Missing effects are omitted rather
 * than rendered as fake controls. Web and Mobile normally provide all four.
 */
export interface TimerHistoryQuickMenuActions {
  onChangePenalty?: (solve: Solve, penalty: Penalty) => void;
  onComment?: (solve: Solve, index: number) => void;
  onCopyScramble?: (solve: Solve) => void | Promise<void>;
  onDelete?: (solve: Solve) => void;
}

export interface TimerHistoryRowQuickMenu extends TimerHistoryQuickMenuActions, TimerOverlayControlProps {
  labels: TimerHistoryQuickMenuLabels;
  variant: TimerHistoryQuickMenuVariant;
  /** Fixed native chrome below the sheet, such as Mobile's three-tab bar. */
  viewportBottomInset?: number;
}

export interface TimerHistoryRowProps {
  className?: string;
  /** Zero-based index in the canonical oldest-to-newest solve list. */
  index: number;
  onActivate: (solve: Solve, index: number) => void;
  quickMenu?: TimerHistoryRowQuickMenu;
  /** Host-owned tags/badges appended to the canonical result cell. */
  resultExtras?: ReactNode;
  selected?: boolean;
  selectionMode?: TimerHistorySelectionMode;
  solve: Solve;
  style?: CSSProperties;
  /** Host-owned rolling-stat cells rendered after the result cell. */
  trailing?: ReactNode;
}

interface QuickMenuRequest {
  x: number;
  y: number;
}

interface MenuGeometry {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

const VIEWPORT_MARGIN = 8;
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP_PX = 10;
const MIN_POPUP_WIDTH = 180;

function actionHasEffect(
  action: Pick<TimerHistoryQuickActionState, 'effect'>,
  actions: TimerHistoryQuickMenuActions,
): boolean {
  switch (action.effect) {
    case 'set-penalty': return !!actions.onChangePenalty;
    case 'open-solve-comment': return !!actions.onComment;
    case 'copy-scramble': return !!actions.onCopyScramble;
    case 'delete-solve': return !!actions.onDelete;
  }
}

function hasAnyQuickEffect(actions: TimerHistoryQuickMenuActions | undefined): boolean {
  return !!actions && TIMER_HISTORY_QUICK_ACTION_CONTRACTS.some(action => actionHasEffect(action, actions));
}

function menuItems(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .filter(item => !item.matches(':disabled'));
}

function actionIcon(action: TimerHistoryQuickActionState): ReactNode {
  switch (action.effect) {
    case 'set-penalty':
      return action.penalty === 'ok'
        ? <Check aria-hidden="true" size={14} />
        : <span className="timer-history-quick-glyph">{action.penalty}</span>;
    case 'open-solve-comment': return <MessageSquare aria-hidden="true" size={14} />;
    case 'copy-scramble': return <Clipboard aria-hidden="true" size={14} />;
    case 'delete-solve': return <Trash2 aria-hidden="true" size={14} />;
  }
}

interface TimerHistoryQuickMenuProps {
  actions: TimerHistoryQuickMenuActions;
  index: number;
  labels: TimerHistoryQuickMenuLabels;
  onClose: () => void;
  request: QuickMenuRequest;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  solve: Solve;
  variant: TimerHistoryQuickMenuVariant;
  viewportBottomInset: number;
}

/** One DOM/menu implementation; CSS switches it between popup and bottom sheet. */
function TimerHistoryQuickMenu({
  actions,
  index,
  labels,
  onClose,
  request,
  returnFocusRef,
  solve,
  variant,
  viewportBottomInset,
}: TimerHistoryQuickMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<MenuGeometry | null>(null);
  const [sheetMaxHeight, setSheetMaxHeight] = useState<number | null>(null);
  const actionStates = timerHistoryQuickActionStates({
    menuOpen: true,
    currentPenalty: solve.penalty,
    canChangePenalty: !!actions.onChangePenalty,
    canComment: !!actions.onComment,
    canDelete: !!actions.onDelete,
  }).filter(action => action.visible && actionHasEffect(action, actions));
  const groups = actionStates.reduce<TimerHistoryQuickActionState[][]>((result, action) => {
    const groupKey = action.effect === 'set-penalty'
      ? 'penalty'
      : action.danger ? 'danger' : 'content';
    const previous = result[result.length - 1];
    const previousAction = previous?.[0];
    const previousKey = previousAction
      ? (previousAction.effect === 'set-penalty'
          ? 'penalty'
          : previousAction.danger ? 'danger' : 'content')
      : null;
    if (!previous || previousKey !== groupKey) result.push([action]);
    else previous.push(action);
    return result;
  }, []);

  usePopoverDismiss(true, onClose, panelRef, returnFocusRef);

  useEffect(() => {
    const frame = requestAnimationFrame(() => menuItems(panelRef.current)[0]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [request.x, request.y, solve.id, variant]);

  // A contextual menu anchored to stale coordinates is misleading after any
  // scroll/resize. Close instead of guessing a new row position.
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.visualViewport?.addEventListener('resize', close);
    window.visualViewport?.addEventListener('scroll', close);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.visualViewport?.removeEventListener('resize', close);
      window.visualViewport?.removeEventListener('scroll', close);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
    const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
    const safeLeft = viewportLeft + VIEWPORT_MARGIN;
    const safeRight = viewportLeft + viewportWidth - VIEWPORT_MARGIN;
    const safeTop = viewportTop + VIEWPORT_MARGIN;
    const safeBottom = Math.max(
      safeTop,
      viewportTop + viewportHeight - VIEWPORT_MARGIN - Math.max(0, viewportBottomInset),
    );

    if (variant === 'sheet') {
      setGeometry(null);
      setSheetMaxHeight(Math.max(0, safeBottom - safeTop));
      return;
    }

    setSheetMaxHeight(null);
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const safeWidth = Math.max(0, safeRight - safeLeft);
    const naturalWidth = Math.max(MIN_POPUP_WIDTH, panel.scrollWidth || rect.width);
    const width = Math.min(naturalWidth, safeWidth);
    const naturalHeight = panel.scrollHeight || rect.height;
    const maxHeight = Math.min(Math.max(0, naturalHeight), Math.max(0, safeBottom - safeTop));
    const left = Math.min(
      Math.max(request.x, safeLeft),
      Math.max(safeLeft, safeRight - width),
    );
    const top = Math.min(
      Math.max(request.y, safeTop),
      Math.max(safeTop, safeBottom - maxHeight),
    );
    setGeometry({ left, maxHeight, top, width });
  }, [request.x, request.y, variant, viewportBottomInset]);

  const restoreRowFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || panelRef.current?.contains(active)) {
        returnFocusRef.current?.focus();
      }
    });
  }, [returnFocusRef]);

  const runAction = (action: TimerHistoryQuickActionState) => {
    // Close before invoking a host mutation: delete can synchronously unmount
    // this row, and comment can synchronously mount/focus the detail surface.
    onClose();
    switch (action.effect) {
      case 'set-penalty':
        if (action.penalty) actions.onChangePenalty?.(solve, action.penalty);
        restoreRowFocus();
        return;
      case 'open-solve-comment':
        actions.onComment?.(solve, index);
        return;
      case 'copy-scramble':
        try {
          void actions.onCopyScramble?.(solve);
        } finally {
          restoreRowFocus();
        }
        return;
      case 'delete-solve':
        // Quick delete intentionally has no confirmation step. The host owns
        // persistence/undo; this menu invokes the bound effect exactly once.
        actions.onDelete?.(solve);
        return;
      default:
        return;
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = menuItems(panelRef.current);
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Home') items[0]?.focus();
    else if (event.key === 'End') items[items.length - 1]?.focus();
    else if (event.key === 'ArrowDown') items[(current + 1 + items.length) % items.length]?.focus();
    else items[(current - 1 + items.length) % items.length]?.focus();
  };

  const items = groups.map((group, groupIndex) => (
    <Fragment key={group[0]!.id}>
      {groupIndex > 0 && <div className="timer-history-quick-separator" role="separator" />}
      {group.map(action => (
        <button
          aria-pressed={action.penalty === undefined ? undefined : action.active}
          className={[
            'timer-history-quick-item',
            action.active ? 'active' : '',
            action.danger ? 'danger' : '',
          ].filter(Boolean).join(' ')}
          data-history-action-id={action.id}
          disabled={action.disabled}
          key={action.id}
          onClick={() => runAction(action)}
          role="menuitem"
          title={labels.actionTitles?.[action.id]}
          type="button"
        >
          <span className="timer-history-quick-icon">{actionIcon(action)}</span>
          <span className="timer-history-quick-label">{labels.actions[action.id]}</span>
        </button>
      ))}
    </Fragment>
  ));

  if (typeof document === 'undefined') return null;
  if (variant === 'sheet') {
    return createPortal(
      <div
        className="timer-history-quick-backdrop"
        data-no-timer
        style={{ paddingBottom: Math.max(0, viewportBottomInset) }}
      >
        <div
          aria-label={labels.menu}
          className="timer-history-quick-panel timer-history-quick-sheet"
          onKeyDown={onKeyDown}
          ref={panelRef}
          role="menu"
          style={{ maxHeight: sheetMaxHeight ?? undefined }}
        >
          <div className="timer-history-quick-heading">
            #{index + 1} · {formatSolveResult(solve)}
          </div>
          {items}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      aria-label={labels.menu}
      className="timer-history-quick-panel timer-history-quick-popup"
      data-no-timer
      onKeyDown={onKeyDown}
      ref={panelRef}
      role="menu"
      style={geometry ? {
        left: geometry.left,
        maxHeight: geometry.maxHeight,
        top: geometry.top,
        visibility: 'visible',
        width: geometry.width,
      } : undefined}
    >
      {items}
    </div>,
    document.body,
  );
}

/**
 * Shared, keyboard-operable solve row. Hosts inject only their tag/stat slots
 * and real data effects; result formatting and quick-action interaction stay
 * identical across Web, Android, and iOS.
 */
export function TimerHistoryRow({
  className,
  index,
  onActivate,
  quickMenu,
  resultExtras,
  selected = false,
  selectionMode = 'none',
  solve,
  style,
  trailing,
}: TimerHistoryRowProps) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [menuRequest, setMenuRequest] = useState<QuickMenuRequest | null>(null);
  const [quickMenuOpen, changeQuickMenuOpen] = useTimerOverlayControl({
    id: TIMER_OVERLAY_IDS.historyQuickMenu,
    onOpenChange: quickMenu?.onOpenChange,
    open: quickMenu?.open,
  });
  const quickEnabled = selectionMode === 'none' && hasAnyQuickEffect(quickMenu);

  const closeMenu = useCallback(() => {
    setMenuRequest(null);
    changeQuickMenuOpen(false, 'outside');
  }, [changeQuickMenuOpen]);
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelLongPress, [cancelLongPress]);
  useEffect(() => {
    closeMenu();
    cancelLongPress();
  }, [cancelLongPress, closeMenu, selectionMode, solve.id]);

  const openMenu = useCallback((x: number, y: number, reason: TimerOverlayOpenReason = 'trigger') => {
    if (!quickEnabled) return;
    setMenuRequest({ x, y });
    changeQuickMenuOpen(true, reason);
  }, [changeQuickMenuOpen, quickEnabled]);

  useEffect(() => {
    if (quickMenuOpen) return;
    setMenuRequest(null);
    cancelLongPress();
  }, [cancelLongPress, quickMenuOpen]);

  const onTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (!quickEnabled) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressFiredRef.current = false;
    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      openMenu(touch.clientX, touch.clientY);
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > LONG_PRESS_SLOP_PX) {
      cancelLongPress();
      touchStartRef.current = null;
    }
  };

  const onTouchEnd = () => {
    cancelLongPress();
    touchStartRef.current = null;
  };

  const activate = () => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (menuRequest) {
      closeMenu();
      return;
    }
    onActivate(solve, index);
  };

  return (
    <>
      <button
        aria-expanded={quickEnabled ? quickMenuOpen && menuRequest !== null : undefined}
        aria-haspopup={quickEnabled ? 'menu' : undefined}
        aria-pressed={selectionMode === 'none' ? undefined : selected}
        className={[
          'history-row',
          'timer-history-row',
          selectionMode !== 'none' ? `timer-history-row--${selectionMode}` : '',
          selected ? 'is-selected' : '',
          className ?? '',
        ].filter(Boolean).join(' ')}
        onClick={activate}
        onContextMenu={(event) => {
          if (!quickEnabled) return;
          event.preventDefault();
          openMenu(event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
          if (!quickEnabled) return;
          event.preventDefault();
          const rect = rowRef.current?.getBoundingClientRect();
          openMenu(rect?.left ?? VIEWPORT_MARGIN, rect?.bottom ?? VIEWPORT_MARGIN, 'keyboard');
        }}
        onTouchCancel={onTouchEnd}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}
        ref={rowRef}
        style={style}
        type="button"
      >
        {selectionMode !== 'none' && (
          <span aria-hidden="true" className="timer-history-selection-indicator" />
        )}
        <span className="idx">{index + 1}</span>
        <span className="time">
          {formatSolveResult(solve)}
          {solve.penalty === '+2' && <span className="penalty-flag">(+2)</span>}
          {solve.comment && <span className="comment-flag" title={solve.comment}>·</span>}
          {resultExtras}
        </span>
        {trailing}
      </button>
      {menuRequest && quickMenuOpen && quickMenu && (
        <TimerHistoryQuickMenu
          actions={quickMenu}
          index={index}
          labels={quickMenu.labels}
          onClose={closeMenu}
          request={menuRequest}
          returnFocusRef={rowRef}
          solve={solve}
          variant={quickMenu.variant}
          viewportBottomInset={quickMenu.viewportBottomInset ?? 0}
        />
      )}
    </>
  );
}

export interface TimerHistoryCommentEditorProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  onBlurSave: (comment: string) => void;
  onEditingChange?: (editing: boolean) => void;
  placeholder?: string;
  rows?: number;
  value?: string;
}

/** Canonical detail comment editor: exact text, save once on blur, no Save button. */
export const TimerHistoryCommentEditor = forwardRef<
  HTMLTextAreaElement,
  TimerHistoryCommentEditorProps
>(function TimerHistoryCommentEditor({
  ariaLabel,
  className,
  disabled = false,
  maxLength,
  onBlurSave,
  onEditingChange,
  placeholder,
  rows = 3,
  value,
}, ref) {
  const normalizedValue = value ?? '';
  const [draft, setDraft] = useState(normalizedValue);
  const editingRef = useRef(false);
  const committedRef = useRef(normalizedValue);

  useEffect(() => {
    if (editingRef.current) return;
    setDraft(normalizedValue);
    committedRef.current = normalizedValue;
  }, [normalizedValue]);

  return (
    <textarea
      aria-label={ariaLabel}
      className={['timer-history-comment-textarea', className ?? ''].filter(Boolean).join(' ')}
      data-history-action-id="solve.detail.comment"
      disabled={disabled}
      maxLength={maxLength}
      onBlur={() => {
        editingRef.current = false;
        onEditingChange?.(false);
        if (draft === committedRef.current) return;
        committedRef.current = draft;
        onBlurSave(draft);
      }}
      onChange={event => setDraft(event.target.value)}
      onFocus={() => {
        editingRef.current = true;
        onEditingChange?.(true);
      }}
      placeholder={placeholder}
      ref={ref}
      rows={rows}
      value={draft}
    />
  );
});
