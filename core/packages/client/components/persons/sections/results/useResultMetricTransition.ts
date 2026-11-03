'use client';

import { useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

/** Animate the visible result cells without taking a snapshot of the whole page. */
export function useResultMetricTransition() {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const running = useRef<Animation[]>([]);
  const cancel = useCallback(() => {
    running.current.forEach(animation => animation.cancel());
    running.current = [];
  }, []);
  useEffect(() => cancel, [cancel]);

  const changeMetric = useCallback((commit: () => void) => {
    const body = bodyRef.current;
    if (!body || typeof body.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancel();
      commit();
      return;
    }
    const capture = () => {
      const cells = new Map<HTMLElement, DOMRect>();
      for (const row of body.rows) {
        const bounds = row.getBoundingClientRect();
        if (bounds.top >= window.innerHeight) break;
        if (bounds.bottom <= 0) continue;
        for (const cell of row.cells) {
          const rect = cell.getBoundingClientRect();
          if (rect.right > 0 && rect.left < window.innerWidth) cells.set(cell, rect);
        }
      }
      return cells;
    };
    // Capture the current animated positions before cancelling a rapid reversal.
    const before = capture();
    cancel();
    flushSync(commit);
    const after = capture();
    running.current = [...after].flatMap(([cell, rect]) => {
      const old = before.get(cell);
      const dx = old ? old.left - rect.left : 0;
      const dy = old ? old.top - rect.top : 0;
      if (old && Math.abs(dx) + Math.abs(dy) < 0.5) return [];
      return [cell.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: old ? 1 : 0.85 },
        { transform: 'translate(0, 0)', opacity: 1 },
      ], { duration: 180, easing: 'cubic-bezier(.22, 1, .36, 1)' })];
    });
  }, [cancel]);

  return { bodyRef, changeMetric };
}
