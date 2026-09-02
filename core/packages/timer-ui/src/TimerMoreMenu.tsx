'use client';

import type { TimerMoreActionId, TimerMoreActionState } from '@cuberoot/shared/timer';
import {
  BarChart3,
  Brain,
  Crosshair,
  Footprints,
  Globe,
  Link2,
  ListPlus,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  Printer,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { usePopoverDismiss } from './usePopoverDismiss';

export interface TimerMoreMenuItem extends TimerMoreActionState {
  href?: string;
  label: string;
  onSelect?: () => void;
}

export interface TimerMoreMenuLinkRenderProps {
  'aria-current'?: 'true';
  children: ReactNode;
  className: string;
  href: string;
  onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
  role: 'menuitem';
}

export interface TimerMoreMenuProps {
  className?: string;
  defaultOpen?: boolean;
  items: readonly TimerMoreMenuItem[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  renderLink?: (props: TimerMoreMenuLinkRenderProps) => ReactNode;
  triggerClassName?: string;
  triggerDisabled?: boolean;
  triggerLabel: string;
  /** Fixed content below the popover, such as Mobile's primary navigation. */
  viewportBottomInset?: number;
}

interface PanelGeometry {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 4;

function actionIcon(id: TimerMoreActionId, active: boolean): ReactNode {
  switch (id) {
    case 'more.marks': return <Footprints aria-hidden="true" size={14} />;
    case 'more.stats-mobile': return <BarChart3 aria-hidden="true" size={14} />;
    case 'more.language-mobile': return <Globe aria-hidden="true" size={14} />;
    case 'more.drill': return <Crosshair aria-hidden="true" size={14} />;
    case 'more.bld-helper': return <Brain aria-hidden="true" size={14} />;
    case 'more.fullscreen': return active
      ? <Minimize2 aria-hidden="true" size={14} />
      : <Maximize2 aria-hidden="true" size={14} />;
    case 'more.manual-entry': return <Plus aria-hidden="true" size={14} />;
    case 'more.replay': return <Link2 aria-hidden="true" size={14} />;
    case 'more.solver': return <Wrench aria-hidden="true" size={14} />;
    case 'more.bulk': return <ListPlus aria-hidden="true" size={14} />;
    case 'more.print': return <Printer aria-hidden="true" size={14} />;
    case 'more.clear-event': return <Trash2 aria-hidden="true" size={14} />;
  }
}

function focusableMenuItems(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .filter((item) => !item.matches(':disabled') && item.getAttribute('aria-disabled') !== 'true');
}

/**
 * Web/Mobile shared More popover. Hosts bind platform effects, while this
 * component owns icons, menu semantics, dismiss/focus behavior, and viewport
 * clamping. An item without a real href or callback is rendered disabled.
 */
export function TimerMoreMenu({
  className,
  defaultOpen = false,
  items,
  onOpenChange,
  open: controlledOpen,
  renderLink,
  triggerClassName,
  triggerDisabled = false,
  triggerLabel,
  viewportBottomInset = 0,
}: TimerMoreMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const [geometry, setGeometry] = useState<PanelGeometry | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const visibleItems = useMemo(() => items.filter((item) => item.visible), [items]);
  const contentSignature = visibleItems
    .map((item) => `${item.id}:${item.label}:${item.disabled ? 1 : 0}:${item.active ? 1 : 0}`)
    .join('|');

  const changeOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);

  const restoreFocusWhenSafe = useCallback(() => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || panelRef.current?.contains(active)) {
        triggerRef.current?.focus();
      }
    });
  }, []);

  const closeAfterSelection = useCallback(() => {
    changeOpen(false);
    restoreFocusWhenSafe();
  }, [changeOpen, restoreFocusWhenSafe]);

  usePopoverDismiss(open, () => changeOpen(false), panelRef, triggerRef);

  useEffect(() => {
    if (!triggerDisabled || !open) return;
    changeOpen(false);
  }, [changeOpen, open, triggerDisabled]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => focusableMenuItems(panelRef.current)[0]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [contentSignature, open]);

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
        safeTop,
        viewportTop + viewportHeight - VIEWPORT_MARGIN - Math.max(0, viewportBottomInset),
      );
      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const safeWidth = Math.max(0, safeRight - safeLeft);
      const naturalWidth = panel.scrollWidth || panelRect.width || triggerRect.width;
      const width = Math.min(Math.max(0, naturalWidth), safeWidth);
      const left = Math.min(
        Math.max(triggerRect.right - width, safeLeft),
        Math.max(safeLeft, safeRight - width),
      );
      const belowTop = triggerRect.bottom + PANEL_GAP;
      const belowSpace = Math.max(0, safeBottom - belowTop);
      const aboveSpace = Math.max(0, triggerRect.top - PANEL_GAP - safeTop);
      const desiredHeight = panel.scrollHeight || panelRect.height;
      const placeBelow = belowSpace >= Math.min(desiredHeight, aboveSpace);
      const availableHeight = placeBelow ? belowSpace : aboveSpace;
      const maxHeight = Math.min(Math.max(0, desiredHeight), availableHeight);
      const top = placeBelow
        ? Math.max(safeTop, belowTop)
        : Math.max(safeTop, triggerRect.top - PANEL_GAP - maxHeight);
      setGeometry({ left, maxHeight, top, width });
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
  }, [contentSignature, open, viewportBottomInset]);

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const focusable = focusableMenuItems(panelRef.current);
    if (focusable.length === 0) return;
    event.preventDefault();
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Home') focusable[0]?.focus();
    else if (event.key === 'End') focusable[focusable.length - 1]?.focus();
    else if (event.key === 'ArrowDown') focusable[(current + 1 + focusable.length) % focusable.length]?.focus();
    else focusable[(current - 1 + focusable.length) % focusable.length]?.focus();
  };

  const panelStyle = geometry ? {
    left: geometry.left,
    maxHeight: geometry.maxHeight,
    top: geometry.top,
    visibility: 'visible',
    width: geometry.width,
  } satisfies CSSProperties : undefined;

  const menu = open && typeof document !== 'undefined' ? createPortal(
    <div
      aria-label={triggerLabel}
      className="more-menu-panel"
      data-no-timer
      id={panelId}
      onKeyDown={handlePanelKeyDown}
      ref={panelRef}
      role="menu"
      style={panelStyle}
    >
      {visibleItems.map((item) => {
        const content = (
          <>
            <span className="more-menu-icon">{actionIcon(item.id, item.active)}</span>
            <span className="more-menu-label">{item.label}</span>
          </>
        );
        const ariaCurrent = item.active ? 'true' as const : undefined;
        const classNames = `more-menu-item${item.active ? ' active' : ''}${item.danger ? ' danger' : ''}`;
        if (item.href && !item.disabled) {
          const onClick = (_event: ReactMouseEvent<HTMLAnchorElement>) => closeAfterSelection();
          if (renderLink) {
            return <span className="more-menu-link-slot" key={item.id}>{renderLink({
              children: content,
              'aria-current': ariaCurrent,
              className: classNames,
              href: item.href,
              onClick,
              role: 'menuitem',
            })}</span>;
          }
          return (
            <a aria-current={ariaCurrent} className={classNames} href={item.href} key={item.id} onClick={onClick} role="menuitem">
              {content}
            </a>
          );
        }
        const disabled = item.disabled || !item.onSelect;
        return (
          <button
            aria-current={ariaCurrent}
            className={classNames}
            disabled={disabled}
            key={item.id}
            onClick={() => {
              if (disabled) return;
              closeAfterSelection();
              item.onSelect?.();
            }}
            role="menuitem"
            type="button"
          >
            {content}
          </button>
        );
      })}
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`more-menu${className ? ` ${className}` : ''}`} data-no-timer>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerLabel}
        className={`${triggerClassName ? `${triggerClassName} ` : ''}more-menu-btn${open ? ' open' : ''}`}
        disabled={triggerDisabled}
        onClick={() => changeOpen(!open)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          changeOpen(true);
        }}
        ref={triggerRef}
        title={triggerLabel}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={14} />
      </button>
      {menu}
    </div>
  );
}
