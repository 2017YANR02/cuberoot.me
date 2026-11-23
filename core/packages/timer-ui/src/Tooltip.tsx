'use client';

import { getUsableViewport } from './host-viewport';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

const HOVER_DELAY_MS = 500; // Chromium Aura's default tooltip delay.

/** Short, non-interactive hover/focus labels. Spread trigger props onto the actual button/link. */
export function Tooltip({ content, children, disabled = false, onlyWhenOverflow = false, openOnClick = false }: {
  content: string;
  disabled?: boolean;
  /** Truncated table cells keep their existing overflow-only behavior. */
  onlyWhenOverflow?: boolean;
  /** Help buttons also toggle on touch/click, with outside-press dismissal. */
  openOnClick?: boolean;
  children: (props: HTMLAttributes<HTMLElement>) => ReactNode;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const hovered = useRef(false);
  const pinned = useRef(false);
  const cancelPendingHover = useRef<(() => void) | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHover = useCallback(() => {
    cancelPendingHover.current?.();
    cancelPendingHover.current = null;
  }, []);
  const clearLeave = useCallback(() => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const close = useCallback(() => {
    clearHover();
    clearLeave();
    pinned.current = false;
    setAnchor(null);
  }, [clearHover, clearLeave]);
  const leave = () => {
    clearLeave();
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      if (!focused.current && !hovered.current && !pinned.current) setAnchor(null);
    }, 120);
  };
  useEffect(() => () => {
    clearHover();
    clearLeave();
  }, [clearHover, clearLeave]);
  const canOpen = (element: HTMLElement) => !disabled && !!content && (!onlyWhenOverflow || element.scrollWidth > element.clientWidth);
  const scheduleHover = (element: HTMLElement) => {
    clearHover();
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') clearHover(); };
    const timeout = setTimeout(() => {
      clearHover();
      if (element.isConnected && canOpen(element)) setAnchor(element);
    }, HOVER_DELAY_MS);
    document.addEventListener('keydown', dismiss);
    cancelPendingHover.current = () => {
      clearTimeout(timeout);
      document.removeEventListener('keydown', dismiss);
    };
  };
  // Fullscreen content lives above body portals; close on transitions and reopen in that root.
  useEffect(() => {
    document.addEventListener('fullscreenchange', close);
    return () => document.removeEventListener('fullscreenchange', close);
  }, [close]);
  useEffect(() => { if (disabled || !content) close(); }, [close, disabled, content]);
  useEffect(() => {
    if (!anchor) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const outside = (event: PointerEvent) => {
      if (!anchor.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', dismiss);
    if (openOnClick) document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
    };
  }, [anchor, close, openOnClick]);
  useLayoutEffect(() => {
    const tip = panel.current;
    if (!anchor || !tip) return;
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = getUsableViewport(rect);
      tip.style.maxWidth = `${Math.max(0, viewport.width - 16)}px`;
      tip.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`;
      const width = viewport.offsetLeft + viewport.width;
      const height = viewport.offsetTop + viewport.height;
      const top = rect.top - tip.offsetHeight - 6;
      tip.style.left = `${Math.max(viewport.offsetLeft + 8, Math.min(rect.left + (rect.width - tip.offsetWidth) / 2, width - tip.offsetWidth - 8))}px`;
      tip.style.top = `${Math.max(viewport.offsetTop + 8, Math.min(top >= viewport.offsetTop + 8 ? top : rect.bottom + 6, height - tip.offsetHeight - 8))}px`;
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    observer?.observe(anchor);
    observer?.observe(tip);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [anchor, content]);
  return <>
    {children({
      'aria-describedby': anchor ? id : undefined,
      ...(openOnClick ? {
        'aria-expanded': !!anchor,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          if (!canOpen(event.currentTarget)) return;
          clearHover();
          clearLeave();
          pinned.current = !pinned.current;
          setAnchor(pinned.current ? event.currentTarget : null);
        },
      } : {}),
      onPointerEnter: (event) => {
        if (event.pointerType === 'touch' || !canOpen(event.currentTarget)) return;
        hovered.current = true;
        clearLeave();
        if (!anchor) scheduleHover(event.currentTarget);
      },
      onPointerLeave: () => {
        hovered.current = false;
        clearHover();
        if (anchor) leave();
      },
      onFocus: (event) => {
        if (!canOpen(event.currentTarget)) return;
        focused.current = true;
        clearHover();
        clearLeave();
        setAnchor(event.currentTarget);
      },
      onBlur: () => { focused.current = false; leave(); },
    })}
    {anchor && createPortal(<div
      ref={panel} id={id} role="tooltip" className="site-tooltip"
      onPointerEnter={() => { hovered.current = true; clearLeave(); }}
      onPointerLeave={() => { hovered.current = false; leave(); }}
    >{content}</div>, anchor.closest('dialog[open]') ?? (document.fullscreenElement?.contains(anchor) ? document.fullscreenElement : document.body))}
  </>;
}
