'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import './reading-fit.css';

/** Desktop preview: fit the entire reading composition without changing its proportions. */
export default function ReadingFit({ children, layout = 'F', pane = false }: { children: ReactNode; layout?: 'F' | 'A'; pane?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = viewport.current;
    const inner = content.current;
    if (!outer || !inner) return;
    const desktop = window.matchMedia('(min-width: 761px)');
    let frame = 0;
    const fit = () => {
      frame = 0;
      const type = outer.closest('[data-tutorial-layout]')?.getAttribute('data-tutorial-layout');
      const enabled = pane ? type === 'A' || type === 'B' && desktop.matches : desktop.matches && layout !== 'A';
      if (pane) {
        outer.dataset.fitActive = String(enabled);
        outer.parentElement?.toggleAttribute('data-copy-fitting', enabled);
      }
      if (!enabled) {
        inner.style.removeProperty('transform');
        return;
      }
      const width = Math.max(inner.offsetWidth, inner.scrollWidth);
      const height = Math.max(inner.offsetHeight, inner.scrollHeight);
      if (!width || !height) return;
      // DOM layout sizes are rounded to integer pixels; leave one pixel for fractions.
      const scale = Math.min(1, outer.clientWidth / width, outer.clientHeight / (height + 1));
      const transform = `translate(${(outer.clientWidth - width * scale) / 2}px, ${(outer.clientHeight - height * scale) / 2}px) scale(${scale})`;
      // Transforms do not change the observed layout dimensions.
      if (inner.style.transform !== transform) inner.style.transform = transform;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(outer);
    observer.observe(inner);
    const changes = new MutationObserver(schedule);
    if (pane) {
      changes.observe(inner, { childList: true, subtree: true, characterData: true });
      const scene = outer.closest('[data-tutorial-layout]');
      if (scene) changes.observe(scene, { attributes: true, attributeFilter: ['data-tutorial-layout'] });
    }
    desktop.addEventListener('change', schedule);
    fit();
    return () => {
      observer.disconnect();
      changes.disconnect();
      if (pane) outer.parentElement?.removeAttribute('data-copy-fitting');
      desktop.removeEventListener('change', schedule);
      cancelAnimationFrame(frame);
    };
  }, [layout, pane]);
  return <div className={`tutorial-reading-fit${pane ? ' tutorial-pane-fit' : ''}`} data-fit-layout={layout} ref={viewport}>
    <div className="tutorial-reading-fit-content" ref={content}>{children}</div>
  </div>;
}
