'use client';

// Shared scroll / animation hooks for the /why-cube interactive widgets.

import { useEffect, useRef, useState, type RefObject } from 'react';

/** Fires `inView` true once the element scrolls near the viewport. `once`
 *  (default) latches it true so heavy children stay mounted. SSR / no-IO
 *  environments fall back to always-true. */
export function useInView<T extends Element = HTMLDivElement>(
  opts?: { rootMargin?: string; once?: boolean },
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const once = opts?.once ?? true;
  const rootMargin = opts?.rootMargin ?? '160px';
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin]);
  return [ref, inView];
}

/** Respects prefers-reduced-motion so animations can degrade to a static end state. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Eases a number from 0 → `target` once `active` flips true. Returns the live
 *  value (caller formats it). Reduced-motion jumps straight to target. */
export function useCountUp(target: number, active: boolean, opts?: { duration?: number }): number {
  const [val, setVal] = useState(0);
  const reduced = useReducedMotion();
  const duration = opts?.duration ?? 1400;
  useEffect(() => {
    if (!active) return;
    if (reduced) { setVal(target); return; }
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else setVal(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduced, duration]);
  return val;
}
