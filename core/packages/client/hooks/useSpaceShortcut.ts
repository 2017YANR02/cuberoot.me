'use client';

import { useEffect } from 'react';

const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [contenteditable="true"], [role="button"]';

export function isSpaceShortcut(event: KeyboardEvent): boolean {
  return event.code === 'Space'
    && !event.repeat
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
    && !(event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR));
}

export function useSpaceShortcut(action: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSpaceShortcut(event)) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [action, enabled]);
}
