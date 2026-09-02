'use client';

import {
  TIMER_SESSION_UI_COPY,
  timerSessionClearConfirmation,
  timerSessionDeleteConfirmation,
  type EventId,
  type TimerSessionMeta,
} from '@cuberoot/shared/timer';
import { Check, ChevronDown, Eraser, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { ClearButton } from './ClearButton';
import { modalFocusableElements } from './modal-focus';
import { usePopoverDismiss } from './usePopoverDismiss';
import {
  TIMER_OVERLAY_IDS,
  type TimerOverlayControlProps,
  useTimerOverlayControl,
} from './timer-overlay-control';

type Awaitable<T> = T | PromiseLike<T>;

export type TimerSessionOperation = 'activate' | 'clear' | 'create' | 'delete' | 'rename';

export interface TimerSessionSwitcherHost {
  activate(sessionId: string): Awaitable<void>;
  /** Create and activate one session as a single logical host operation. */
  create(name: string, event: EventId): Awaitable<void>;
  rename(sessionId: string, name: string): Awaitable<void>;
  clear(sessionId: string): Awaitable<void>;
  delete(sessionId: string): Awaitable<void>;
}

export interface TimerSessionSwitcherLabels {
  session: string;
  sessions: string;
  switchSession: string;
  newSession: string;
  newSessionDefault: string;
  sessionName: string;
  newSessionName: string;
  clear: string;
  confirm: string;
  confirmRename: string;
  rename: string;
  renameSession: string;
  clearSolves: string;
  clearSessionSolves: string;
  keepOneSession: string;
  deleteSession: string;
  create: string;
  createSession: string;
  operationFailed: string;
  clearConfirmation(name: string): string;
  deleteConfirmation(name: string): string;
}

export function timerSessionSwitcherLabels(
  language: 'en' | 'zh',
): TimerSessionSwitcherLabels {
  const text = (copy: { en: string; zh: string }) => copy[language];
  return {
    session: text(TIMER_SESSION_UI_COPY.session),
    sessions: text(TIMER_SESSION_UI_COPY.sessions),
    switchSession: text(TIMER_SESSION_UI_COPY.switchSession),
    newSession: text(TIMER_SESSION_UI_COPY.newSession),
    newSessionDefault: text(TIMER_SESSION_UI_COPY.newSessionDefault),
    sessionName: text(TIMER_SESSION_UI_COPY.sessionName),
    newSessionName: text(TIMER_SESSION_UI_COPY.newSessionName),
    clear: text(TIMER_SESSION_UI_COPY.clear),
    confirm: text(TIMER_SESSION_UI_COPY.confirm),
    confirmRename: text(TIMER_SESSION_UI_COPY.confirmRename),
    rename: text(TIMER_SESSION_UI_COPY.rename),
    renameSession: text(TIMER_SESSION_UI_COPY.renameSession),
    clearSolves: text(TIMER_SESSION_UI_COPY.clearSolves),
    clearSessionSolves: text(TIMER_SESSION_UI_COPY.clearSessionSolves),
    keepOneSession: text(TIMER_SESSION_UI_COPY.keepOneSession),
    deleteSession: text(TIMER_SESSION_UI_COPY.deleteSession),
    create: text(TIMER_SESSION_UI_COPY.create),
    createSession: text(TIMER_SESSION_UI_COPY.createSession),
    operationFailed: text(TIMER_SESSION_UI_COPY.operationFailed),
    clearConfirmation: (name) => text(timerSessionClearConfirmation(name)),
    deleteConfirmation: (name) => text(timerSessionDeleteConfirmation(name)),
  };
}

export interface TimerSessionSwitcherProps extends TimerOverlayControlProps {
  activeSessionId: string;
  className?: string;
  event: EventId;
  host: TimerSessionSwitcherHost;
  labels: TimerSessionSwitcherLabels;
  sessions: readonly TimerSessionMeta[];
  /** Fixed content below the popover (for example a native bottom nav). */
  viewportBottomInset?: number;
  confirm?: (message: string) => Awaitable<boolean>;
  onOperationError?: (error: unknown, operation: TimerSessionOperation) => void;
}

interface PanelGeometry {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 6;
const MIN_PANEL_HEIGHT = 96;

function defaultConfirm(message: string): boolean {
  return window.confirm(message);
}

/**
 * Named-session control shared by Web, Android, and iOS. The host owns only
 * persistence; this component owns the exact dropdown, draft, focus, and
 * async-success interaction contract.
 */
export function TimerSessionSwitcher({
  activeSessionId,
  className,
  confirm = defaultConfirm,
  event,
  host,
  labels,
  onOpenChange,
  onOperationError,
  sessions,
  open: controlledOpen,
  viewportBottomInset = 0,
}: TimerSessionSwitcherProps) {
  const [open, changeOpen] = useTimerOverlayControl({
    id: TIMER_OVERLAY_IDS.sessionSwitcher,
    onOpenChange,
    open: controlledOpen,
  });
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<TimerSessionOperation | null>(null);
  const [operationError, setOperationError] = useState(false);
  const [geometry, setGeometry] = useState<PanelGeometry | null>(null);
  const busyRef = useRef<TimerSessionOperation | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const successFocusRef = useRef<string | 'active' | null>(null);
  const previousOpenRef = useRef(open);
  const popupId = useId();
  const active = sessions.find((session) => session.id === activeSessionId);

  const closeAll = useCallback((restoreFocus = false, afterSuccessfulOperation = false) => {
    if (busyRef.current && !afterSuccessfulOperation) return;
    changeOpen(false, afterSuccessfulOperation ? 'operation' : 'trigger');
    setCreating(false);
    setRenamingId(null);
    setDraft('');
    setOperationError(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, [changeOpen]);

  usePopoverDismiss(open && !busy, (reason) => {
    if (busyRef.current) return;
    setCreating(false);
    setRenamingId(null);
    setDraft('');
    setOperationError(false);
    changeOpen(false, reason);
  }, panelRef, triggerRef);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;
    if (controlledOpen !== undefined && wasOpen && !open) {
      setCreating(false);
      setRenamingId(null);
      setDraft('');
      setOperationError(false);
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || active === document.body || panelRef.current?.contains(active)) {
          triggerRef.current?.focus();
        }
      });
    }
  }, [controlledOpen, open]);

  useLayoutEffect(() => {
    if (!open) return;
    if (busy) {
      panelRef.current?.focus();
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (creating || renamingId) {
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      const successFocus = successFocusRef.current;
      successFocusRef.current = null;
      const target = successFocus && successFocus !== 'active'
        ? Array.from(
            panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-session-id]') ?? [],
          ).find((button) => button.dataset.sessionId === successFocus)
        : panelRef.current
            ?.querySelector<HTMLButtonElement>('[data-session-active="true"]');
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, creating, open, renamingId]);

  useLayoutEffect(() => {
    if (!open) {
      setGeometry(null);
      return;
    }
    const update = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
      const safeLeft = viewportLeft + VIEWPORT_MARGIN;
      const safeRight = viewportLeft + viewportWidth - VIEWPORT_MARGIN;
      const safeTop = viewportTop + VIEWPORT_MARGIN;
      const safeBottom = Math.max(
        safeTop + MIN_PANEL_HEIGHT,
        viewportTop + viewportHeight - VIEWPORT_MARGIN - Math.max(0, viewportBottomInset),
      );
      const triggerRect = trigger.getBoundingClientRect();
      const width = Math.max(0, Math.min(triggerRect.width, safeRight - safeLeft));
      const left = Math.min(Math.max(triggerRect.left, safeLeft), safeRight - width);
      const belowTop = triggerRect.bottom + PANEL_GAP;
      const belowSpace = safeBottom - belowTop;
      const aboveSpace = triggerRect.top - PANEL_GAP - safeTop;
      const desiredHeight = Math.max(MIN_PANEL_HEIGHT, panel.scrollHeight);
      const placeBelow = belowSpace >= Math.min(desiredHeight, MIN_PANEL_HEIGHT)
        || belowSpace >= aboveSpace;
      const maxHeight = Math.max(
        MIN_PANEL_HEIGHT,
        Math.min(desiredHeight, placeBelow ? belowSpace : aboveSpace),
      );
      const top = placeBelow
        ? Math.max(safeTop, belowTop)
        : Math.max(safeTop, triggerRect.top - PANEL_GAP - maxHeight);
      setGeometry({ left, top, width, maxHeight });
    };

    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [creating, open, operationError, renamingId, sessions, viewportBottomInset]);

  const run = useCallback(async (
    operation: TimerSessionOperation,
    action: () => Awaitable<boolean | void>,
    onSuccess?: () => void,
  ) => {
    if (busyRef.current) return;
    busyRef.current = operation;
    setBusy(operation);
    setOperationError(false);
    try {
      const completed = await action();
      if (completed === false) return;
      onSuccess?.();
    } catch (error) {
      setOperationError(true);
      onOperationError?.(error, operation);
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, [onOperationError]);

  const handleActivate = (sessionId: string) => {
    if (sessionId === activeSessionId) {
      closeAll(true);
      return;
    }
    void run('activate', () => host.activate(sessionId), () => closeAll(true, true));
  };

  const startCreate = () => {
    if (busyRef.current) return;
    setRenamingId(null);
    setCreating(true);
    setDraft(labels.newSessionDefault);
  };

  const commitCreate = () => {
    const name = draft.trim();
    if (!name) {
      setCreating(false);
      setDraft('');
      return;
    }
    void run('create', () => host.create(name, event), () => closeAll(true, true));
  };

  const startRename = (session: TimerSessionMeta) => {
    if (busyRef.current) return;
    setCreating(false);
    setRenamingId(session.id);
    setDraft(session.name);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const name = draft.trim();
    if (!name) {
      setRenamingId(null);
      setDraft('');
      return;
    }
    const sessionId = renamingId;
    void run('rename', () => host.rename(sessionId, name), () => {
      successFocusRef.current = sessionId;
      setRenamingId(null);
      setDraft('');
    });
  };

  const handleClear = (session: TimerSessionMeta) => {
    void run('clear', async () => {
      if (!await confirm(labels.clearConfirmation(session.name))) return false;
      await host.clear(session.id);
    });
  };

  const handleDelete = (session: TimerSessionMeta) => {
    if (sessions.length <= 1) return;
    void run('delete', async () => {
      if (!await confirm(labels.deleteConfirmation(session.name))) return false;
      await host.delete(session.id);
    }, () => { successFocusRef.current = 'active'; });
  };

  const handlePanelKeyDown = (keyboardEvent: ReactKeyboardEvent<HTMLDivElement>) => {
    if (keyboardEvent.key !== 'Tab' || !panelRef.current) return;
    const focusable = modalFocusableElements(panelRef.current);
    if (focusable.length === 0) {
      keyboardEvent.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  };

  const inputKeyDown = (kind: 'create' | 'rename') => (keyboardEvent: ReactKeyboardEvent) => {
    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      if (kind === 'create') commitCreate();
      else commitRename();
    }
    // Let Escape bubble to usePopoverDismiss: Web's established behavior is to
    // close the whole dropdown, clear the draft, and restore trigger focus.
  };

  const panelStyle: CSSProperties | undefined = geometry ? {
    left: geometry.left,
    top: geometry.top,
    width: geometry.width,
    maxHeight: geometry.maxHeight,
    visibility: 'visible',
  } : undefined;

  const panel = open && typeof document !== 'undefined' ? createPortal((
    <div
      aria-busy={busy !== null}
      aria-label={labels.sessions}
      aria-modal="true"
      className="tsession-panel"
      data-no-timer
      id={popupId}
      onKeyDown={handlePanelKeyDown}
      ref={panelRef}
      role="dialog"
      style={panelStyle}
      tabIndex={-1}
    >
      <div className="tsession-list">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isRenaming = renamingId === session.id;
          return (
            <div className={`tsession-item${isActive ? ' tsession-item--active' : ''}`} key={session.id}>
              {isRenaming ? (
                <div className="tsession-edit">
                  <div className="tsession-input-wrap">
                    <input
                      aria-label={labels.sessionName}
                      className="tsession-input"
                      disabled={busy !== null}
                      onChange={(changeEvent) => setDraft(changeEvent.target.value)}
                      onKeyDown={inputKeyDown('rename')}
                      ref={inputRef}
                      type="text"
                      value={draft}
                    />
                    {draft && (
                      <ClearButton
                        ariaLabel={labels.clear}
                        onClick={() => setDraft('')}
                        preserveFocus
                      />
                    )}
                  </div>
                  <button
                    aria-label={labels.confirmRename}
                    className="tsession-icon-btn tsession-icon-btn--confirm"
                    disabled={busy !== null}
                    onClick={commitRename}
                    title={labels.confirm}
                    type="button"
                  ><Check aria-hidden="true" size={14} /></button>
                </div>
              ) : (
                <>
                  <button
                    aria-pressed={isActive}
                    className="tsession-name-btn"
                    data-session-active={isActive ? 'true' : undefined}
                    data-session-id={session.id}
                    disabled={busy !== null}
                    onClick={() => handleActivate(session.id)}
                    title={session.name}
                    type="button"
                  >
                    {isActive && <Check aria-hidden="true" className="tsession-check" size={13} />}
                    <span className="tsession-name-text">{session.name}</span>
                  </button>
                  <div className="tsession-actions">
                    <button
                      aria-label={`${labels.renameSession}: ${session.name}`}
                      className="tsession-icon-btn"
                      disabled={busy !== null}
                      onClick={() => startRename(session)}
                      title={labels.rename}
                      type="button"
                    ><Pencil aria-hidden="true" size={13} /></button>
                    <button
                      aria-label={`${labels.clearSessionSolves}: ${session.name}`}
                      className="tsession-icon-btn"
                      disabled={busy !== null}
                      onClick={() => handleClear(session)}
                      title={labels.clearSolves}
                      type="button"
                    ><Eraser aria-hidden="true" size={13} /></button>
                    <button
                      aria-label={`${labels.deleteSession}: ${session.name}`}
                      className="tsession-icon-btn tsession-icon-btn--danger"
                      disabled={busy !== null || sessions.length <= 1}
                      onClick={() => handleDelete(session)}
                      title={sessions.length <= 1 ? labels.keepOneSession : labels.deleteSession}
                      type="button"
                    ><Trash2 aria-hidden="true" size={13} /></button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="tsession-footer">
        {operationError && <p className="tsession-error" role="alert">{labels.operationFailed}</p>}
        {creating ? (
          <div className="tsession-edit">
            <div className="tsession-input-wrap">
              <input
                aria-label={labels.newSessionName}
                className="tsession-input"
                disabled={busy !== null}
                onChange={(changeEvent) => setDraft(changeEvent.target.value)}
                onKeyDown={inputKeyDown('create')}
                ref={inputRef}
                type="text"
                value={draft}
              />
              {draft && (
                <ClearButton
                  ariaLabel={labels.clear}
                  onClick={() => setDraft('')}
                  preserveFocus
                />
              )}
            </div>
            <button
              aria-label={labels.createSession}
              className="tsession-icon-btn tsession-icon-btn--confirm"
              disabled={busy !== null}
              onClick={commitCreate}
              title={labels.create}
              type="button"
            ><Check aria-hidden="true" size={14} /></button>
          </div>
        ) : (
          <button
            className="tsession-add-btn"
            disabled={busy !== null}
            onClick={startCreate}
            type="button"
          >
            <Plus aria-hidden="true" size={14} />
            <span>{labels.newSession}</span>
          </button>
        )}
      </div>
    </div>
  ), document.body) : null;

  return (
    <div className={`tsession${className ? ` ${className}` : ''}`} data-no-timer>
      <button
        aria-controls={open ? popupId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${labels.switchSession}: ${active?.name ?? labels.session}`}
        className="tsession-trigger"
        disabled={busy !== null}
        onClick={() => {
          if (open) closeAll(false);
          else changeOpen(true, 'trigger');
        }}
        ref={triggerRef}
        title={labels.switchSession}
        type="button"
      >
        <span className="tsession-trigger-name">{active?.name ?? labels.session}</span>
        <ChevronDown aria-hidden="true" className="tsession-trigger-caret" size={14} />
      </button>
      {panel}
    </div>
  );
}
