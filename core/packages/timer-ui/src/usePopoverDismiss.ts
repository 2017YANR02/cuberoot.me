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
    const inside = (target: Node | null): boolean => (
      !!target && (!!panel.current?.contains(target) || !!trigger?.current?.contains(target))
    );
    const onDown = (event: PointerEvent) => {
      if (!inside(event.target as Node)) latest.current('outside');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      latest.current('escape');
      trigger?.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, panel, trigger]);
}
