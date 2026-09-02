'use client';

import { useEffect, useRef, type RefObject } from 'react';

export type PopoverDismissReason = 'escape' | 'outside';

/** Close a popover on outside pointer-down or Escape without re-subscribing for
 * every inline close callback. Positioning remains the caller's responsibility. */
export function usePopoverDismiss(
  open: boolean,
  close: (reason: PopoverDismissReason) => void,
  panel: RefObject<HTMLElement | null>,
  trigger?: RefObject<HTMLElement | null>,
): void {
  const latest = useRef(close);
  latest.current = close;

  useEffect(() => {
    if (!open) return;
    const inside = (event: PointerEvent): boolean => {
      const target = event.target as Node | null;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const contains = (element: HTMLElement | null | undefined) => !!element
        && (path.includes(element) || (!!target && element.contains(target)));
      return contains(panel.current) || contains(trigger?.current);
    };
    const onDown = (event: PointerEvent) => {
      if (!inside(event)) latest.current('outside');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      latest.current('escape');
      trigger?.current?.focus();
    };
    // Capture observes the stable composed path before another document handler
    // can unmount a body-portal panel. The path check still distinguishes a real
    // outside press from a press inside that portal.
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, panel, trigger]);
}
