'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import './reading-fit.css';

/** Fit a reading composition within its available space while preserving proportions. */
export default function ReadingFit({ children, layout = 'E', pane = false, onFit }: { children: ReactNode; layout?: 'E' | 'A' | 'F'; pane?: boolean; onFit?: (scale: number) => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = viewport.current;
    const inner = content.current;
    if (!outer || !inner) return;
    const desktop = window.matchMedia('(min-width: 761px)');
    const shortLandscape = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    let frame = 0;
    const fit = () => {
      frame = 0;
      const type = outer.closest('[data-tutorial-layout]')?.getAttribute('data-tutorial-layout');
      const compactReference = pane && type === 'C'
        && getComputedStyle(outer).getPropertyValue('--tutorial-compact-reference').trim() === '1';
      const compactReading = !pane && layout === 'E' && shortLandscape.matches;
      const enabled = pane
        ? type === 'A' || compactReference
        : layout === 'F' || (layout === 'E' && (desktop.matches || compactReading));
      if (pane) {
        outer.dataset.fitActive = String(enabled);
        outer.parentElement?.toggleAttribute('data-copy-fitting', enabled);
      }
      if (!enabled) {
        outer.removeAttribute('data-fit-fallback');
        inner.style.removeProperty('transform');
        return;
      }
      const width = Math.max(inner.offsetWidth, inner.scrollWidth);
      const height = Math.max(inner.offsetHeight, inner.scrollHeight);
      if (!width || !height) return;
      // DOM layout sizes are rounded to integer pixels; leave one pixel for fractions.
      const scale = Math.min(1, outer.clientWidth / width, outer.clientHeight / (height + 1));
      onFit?.(scale);
      const fallback = (compactReference || compactReading) && scale < .72;
      if (outer.hasAttribute('data-fit-fallback') !== fallback) outer.toggleAttribute('data-fit-fallback', fallback);
      if (fallback) {
        inner.style.removeProperty('transform');
        return;
      }
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
      if (scene) {
        // A disabled pane has no box, so observe the scene across layout changes.
        observer.observe(scene);
        changes.observe(scene, { attributes: true, attributeFilter: ['data-tutorial-layout'] });
      }
    }
    desktop.addEventListener('change', schedule);
    shortLandscape.addEventListener('change', schedule);
    fit();
    return () => {
      observer.disconnect();
      changes.disconnect();
      if (pane) outer.parentElement?.removeAttribute('data-copy-fitting');
      desktop.removeEventListener('change', schedule);
      shortLandscape.removeEventListener('change', schedule);
      cancelAnimationFrame(frame);
    };
  }, [layout, pane, onFit]);
  return <div className={`tutorial-reading-fit${pane ? ' tutorial-pane-fit' : ''}`} data-fit-layout={layout} ref={viewport}>
    <div className="tutorial-reading-fit-content" ref={content}>{children}</div>
  </div>;
}
