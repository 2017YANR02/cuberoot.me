'use client';

/**
 * useGestureWheel — press-and-drag radial gesture input for a timing surface.
 *
 * Extracted from /timer SoloView so /timer and the /alg trainer run page share one implementation
 * (cstimer-style dial). Attaches native pointer listeners ({ passive:false } so
 * preventDefault works on iOS) to `surfaceRef`. A plain press/hold still times
 * (onPressDown → onPressUp); only a drag past the dead-zone switches to gesture
 * mode, cancels the arm, and fires the nearest direction on release.
 *
 * Callbacks are read through a ref refreshed every render, so the listeners
 * attach once and always see current state. The surface needs `touch-action:
 * none` in CSS for touch drags to reach pointermove.
 */

import { useEffect, useRef } from 'react';
import type { GestureWheelHandle } from '@/components/GestureWheel';

export interface UseGestureWheelOptions {
  /** The timing surface element (where presses/drags happen). */
  surfaceRef: React.RefObject<HTMLElement | null>;
  /** Re-attach trigger: true once the surface is mounted/active. */
  active?: boolean;
  /** A gesture may begin now (idle/stopped). When false, a press still times. */
  canGesture: () => boolean;
  /** enabled[i] for the 8 directions — greys out (and no-ops) absent actions. */
  enabledFor: () => boolean[];
  /** Fire direction i (0..7). */
  fireAction: (i: number) => void;
  /** Press began (mouse/touch down). Host warms up + arms the timer. */
  onPressDown: () => void;
  /** Press released without a gesture. Host does the normal timing release. */
  onPressUp: () => void;
  /** A drag started → host cancels the arm so timing never fires on a gesture. */
  onArmCancel: () => void;
  /** Skip presses that start on interactive children (buttons, links, inputs). */
  ignoreTarget?: (t: EventTarget | null) => boolean;
}

export function useGestureWheel(opts: UseGestureWheelOptions): {
  wheelRef: React.RefObject<GestureWheelHandle | null>;
} {
  const wheelRef = useRef<GestureWheelHandle | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const { surfaceRef, active = true } = opts;

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !active) return;

    const TAP_SLOP = 10;   // px wobble still counts as a press, not a drag
    const DEAD_ZONE = 44;  // px the drag must travel before a direction locks in

    let touchActive = false;
    let swipeStart: { x: number; y: number } | null = null;
    let swipeMoved = false;
    let gestureHit = -1;

    // Direction index from a drag delta: 0=right, then counter-clockwise
    // (matches GestureWheel's label order). -1 inside the dead-zone.
    const hitFor = (dx: number, dy: number): number => {
      if (Math.hypot(dx, dy) < DEAD_ZONE) return -1;
      const theta = -Math.atan2(dy, dx);
      return ((Math.floor((theta / Math.PI) * 4 + 8.5) % 8) + 8) % 8;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const o = optsRef.current;
      if (o.ignoreTarget?.(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      touchActive = true;
      swipeMoved = false;
      gestureHit = -1;
      // Works for mouse too: a plain click/hold still times — only a drag past
      // TAP_SLOP switches to gesture mode.
      const canGesture = o.canGesture();
      swipeStart = canGesture ? { x: e.clientX, y: e.clientY } : null;
      if (canGesture) wheelRef.current?.show(e.clientX, e.clientY, o.enabledFor());
      o.onPressDown();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!swipeStart) return;
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      const dist = Math.hypot(dx, dy);
      if (!swipeMoved && dist > TAP_SLOP) {
        // Crossed the tap-slop: this is a drag, not a hold. Soft-cancel the arm
        // so we never start the timer on a gesture (host keeps the last result).
        swipeMoved = true;
        touchActive = false;
        optsRef.current.onArmCancel();
      }
      if (swipeMoved) {
        const hit = hitFor(dx, dy);
        gestureHit = hit;
        wheelRef.current?.update(hit, Math.min(1, dist / DEAD_ZONE));
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const start = swipeStart;
      swipeStart = null;
      if (start) wheelRef.current?.hide();
      // Gesture path: a drag that already cancelled the arm.
      if (start && swipeMoved) {
        const hit = gestureHit;
        swipeMoved = false;
        gestureHit = -1;
        if (hit >= 0) optsRef.current.fireAction(hit);
        return;
      }
      if (!touchActive) return;
      e.preventDefault();
      touchActive = false;
      optsRef.current.onPressUp();
    };

    const handlePointerCancel = () => {
      if (swipeStart) wheelRef.current?.hide();
      swipeStart = null;
      swipeMoved = false;
      gestureHit = -1;
      if (!touchActive) return;
      touchActive = false;
      optsRef.current.onPressUp();
    };

    el.addEventListener('pointerdown', handlePointerDown, { passive: false });
    el.addEventListener('pointermove', handlePointerMove, { passive: false });
    el.addEventListener('pointerup', handlePointerUp, { passive: false });
    el.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [surfaceRef, active]);

  return { wheelRef };
}
