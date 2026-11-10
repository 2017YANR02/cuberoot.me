'use client';

import { useLayoutEffect, type RefObject } from 'react';
import { getUsableViewport } from './host-viewport';

const MARGIN = 8;
const GAP = 6;

/** Clamp anchored panels without replacing their transform (for example centering).
 * Pass the trigger to also choose above/below and constrain the scrollable height.
 * Existing callers without a trigger retain their own vertical positioning.
 */
export function usePanelClamp(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  triggerRef?: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const original = {
      marginLeft: el.style.marginLeft, marginRight: el.style.marginRight,
      marginTop: el.style.marginTop, maxHeight: el.style.maxHeight,
      overflowY: el.style.overflowY,
    };
    const restore = () => Object.assign(el.style, original);
    const apply = () => {
      restore();
      const root = document.documentElement;
      const viewport = getUsableViewport();
      const vw = Math.min(root.clientWidth, root.getBoundingClientRect().right, viewport.offsetLeft + viewport.width);
      const left = el.getBoundingClientRect().left;
      const overRight = left + el.offsetWidth - (vw - MARGIN);
      const shift = Math.max(viewport.offsetLeft + MARGIN - left, -Math.max(0, overRight));
      if (shift !== 0) {
        // Both edges matter: margin-left alone cannot move a right-anchored panel.
        const style = getComputedStyle(el);
        el.style.marginLeft = `${(parseFloat(style.marginLeft) || 0) + shift}px`;
        el.style.marginRight = `${(parseFloat(style.marginRight) || 0) - shift}px`;
      }
      const trigger = triggerRef?.current;
      if (!trigger) return;
      const anchor = trigger.getBoundingClientRect();
      const top = viewport.offsetTop + MARGIN;
      const bottom = viewport.offsetTop + viewport.height - MARGIN;
      const below = Math.max(0, bottom - Math.max(top, anchor.bottom + GAP));
      const above = Math.max(0, Math.min(bottom, anchor.top - GAP) - top);
      const up = el.offsetHeight > below && above > below;
      const space = up ? above : below;
      const style = getComputedStyle(el);
      const extra = style.boxSizing === 'border-box' ? 0
        : (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
          + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      const cssLimit = parseFloat(style.maxHeight);
      el.style.maxHeight = `${Math.max(0, Math.min(Number.isFinite(cssLimit) ? cssLimit : Infinity, space - extra))}px`;
      el.style.overflowY = 'auto';
      const target = up ? Math.min(bottom, anchor.top - GAP) - el.offsetHeight : Math.max(top, anchor.bottom + GAP);
      const delta = target - el.getBoundingClientRect().top;
      if (delta !== 0) el.style.marginTop = `${(parseFloat(style.marginTop) || 0) + delta}px`;
    };
    apply();
    // Re-measure dynamic contents; writing the same final geometry does not
    // generate another ResizeObserver delivery. Ignore internal menu scrolling.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(el);
    if (triggerRef?.current) observer?.observe(triggerRef.current);
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && el.contains(event.target)) return;
      apply();
    };
    window.addEventListener('resize', apply);
    window.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
    el.addEventListener('animationend', apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', onScroll, true);
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
      el.removeEventListener('animationend', apply);
      restore();
    };
  }, [open, ref, triggerRef]);
}
