'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLeave = () => { if (timer.current !== null) clearTimeout(timer.current); };
  const leave = () => {
    clearLeave();
    timer.current = setTimeout(() => {
      if (!focused.current && !hovered.current && !pinned.current) setAnchor(null);
    }, 120);
  };
  useEffect(() => clearLeave, []);
  const canOpen = (element: HTMLElement) => !disabled && !!content && (!onlyWhenOverflow || element.scrollWidth > element.clientWidth);
  // Fullscreen content lives above body portals; close on transitions and reopen in that root.
  useEffect(() => {
    const close = () => { pinned.current = false; setAnchor(null); };
    document.addEventListener('fullscreenchange', close);
    return () => document.removeEventListener('fullscreenchange', close);
  }, []);
  useEffect(() => { if (disabled || !content) { pinned.current = false; setAnchor(null); } }, [disabled, content]);
  useEffect(() => {
    if (!anchor) return;
    const close = () => { pinned.current = false; setAnchor(null); };
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
  }, [anchor, openOnClick]);
  useLayoutEffect(() => {
    const tip = panel.current;
    if (!anchor || !tip) return;
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const top = rect.top - tip.offsetHeight - 6;
      tip.style.left = `${Math.max(8, Math.min(rect.left + (rect.width - tip.offsetWidth) / 2, width - tip.offsetWidth - 8))}px`;
      tip.style.top = `${Math.max(8, Math.min(top >= 8 ? top : rect.bottom + 6, height - tip.offsetHeight - 8))}px`;
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
          clearLeave();
          pinned.current = !pinned.current;
          setAnchor(pinned.current ? event.currentTarget : null);
        },
      } : {}),
      onPointerEnter: (event) => {
        if (event.pointerType === 'touch' || !canOpen(event.currentTarget)) return;
        hovered.current = true;
        clearLeave();
        setAnchor(event.currentTarget);
      },
      onPointerLeave: () => { hovered.current = false; leave(); },
      onFocus: (event) => { if (!canOpen(event.currentTarget)) return; focused.current = true; clearLeave(); setAnchor(event.currentTarget); },
      onBlur: () => { focused.current = false; leave(); },
    })}
    {anchor && createPortal(<div
      ref={panel} id={id} role="tooltip" className="site-tooltip" data-site-surface="popover"
      onPointerEnter={() => { hovered.current = true; clearLeave(); }}
      onPointerLeave={() => { hovered.current = false; leave(); }}
    >{content}</div>, document.fullscreenElement?.contains(anchor) ? document.fullscreenElement : document.body)}
  </>;
}
