'use client';

/**
 * Press-and-drag radial input shared by Web and native-app timer surfaces.
 *
 * A plain press keeps the host's normal hold-to-time path. Only a motion that
 * passes the canonical shared pointer profile cancels that arm and becomes an
 * eight-direction gesture. Platform hosts retain target classification and
 * action effects; this hook owns the DOM pointer lifecycle only.
 */

import {
  timerRadialGestureDirection,
  timerRadialGestureStarts,
  timerRadialPointerProfile,
  type TimerKeyboardTargetContext,
  type TimerRadialPointerProfile,
} from '@cuberoot/shared/timer';
import { useEffect, useRef, type RefObject } from 'react';
import type { GestureWheelHandle } from './GestureWheel';

/** Shared timing-surface child guard used by Web, Android and trainer hosts. */
export function shouldIgnoreTimerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    'button, a, input, textarea, select, .scramble-strip, [contenteditable="true"], [data-no-timer]',
  ) !== null;
}

/** DOM adapter for the runtime-neutral keyboard decision table. */
export function timerKeyboardTargetContext(
  target: EventTarget | null,
): TimerKeyboardTargetContext {
  const element = typeof HTMLElement !== 'undefined' && target instanceof HTMLElement
    ? target
    : null;
  const tagName = element?.tagName ?? '';
  return {
    textEntry: tagName === 'INPUT'
      || tagName === 'TEXTAREA'
      || element?.isContentEditable === true,
    select: tagName === 'SELECT',
    noTimerRegion: element?.closest('[data-no-timer]') !== null,
  };
}

export interface UseGestureWheelOptions {
  surfaceRef: RefObject<HTMLElement | null>;
  /** Re-attach trigger for conditionally mounted timing surfaces. */
  active?: boolean;
  canGesture: () => boolean;
  enabledFor: () => boolean[];
  fireAction: (direction: number) => void;
  /** Cancel a planted press without treating pointer cancellation as release. */
  onPressCancel: () => void;
  onPressDown: () => void;
  onPressUp: () => void;
  onArmCancel: () => void;
  /** Skip presses originating from interactive or otherwise exempt children. */
  ignoreTarget?: (target: EventTarget | null) => boolean;
}

export function useGestureWheel(options: UseGestureWheelOptions): {
  wheelRef: RefObject<GestureWheelHandle | null>;
} {
  const wheelRef = useRef<GestureWheelHandle | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const { surfaceRef, active = true } = options;

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !active) return;

    let pressActive = false;
    let gestureStart: { x: number; y: number } | null = null;
    let gestureStarted = false;
    let gestureHit = -1;
    let gestureEnabled: boolean[] = [];
    let pointerProfile: TimerRadialPointerProfile = timerRadialPointerProfile('mouse');
    let downTime = 0;
    let activePointerId: number | null = null;

    const releasePointerCapture = (pointerId: number) => {
      try {
        if (surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
      } catch { /* unsupported WebView or capture already lost */ }
    };

    const cancelActivePointer = () => {
      const pointerId = activePointerId;
      activePointerId = null;
      if (gestureStart) wheelRef.current?.hide();
      gestureStart = null;
      gestureStarted = false;
      gestureHit = -1;
      gestureEnabled = [];
      if (pointerId !== null) releasePointerCapture(pointerId);
      if (!pressActive) return;
      pressActive = false;
      optionsRef.current.onPressCancel();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const current = optionsRef.current;
      if (current.ignoreTarget?.(event.target)) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (activePointerId !== null) return;
      event.preventDefault();
      activePointerId = event.pointerId;
      try { surface.setPointerCapture(event.pointerId); } catch { /* unsupported WebView */ }
      pressActive = true;
      gestureStarted = false;
      gestureHit = -1;
      pointerProfile = timerRadialPointerProfile(event.pointerType);
      downTime = event.timeStamp;
      const canGesture = current.canGesture();
      gestureStart = canGesture ? { x: event.clientX, y: event.clientY } : null;
      if (canGesture) {
        gestureEnabled = current.enabledFor();
        wheelRef.current?.show(event.clientX, event.clientY, gestureEnabled);
      } else {
        gestureEnabled = [];
      }
      current.onPressDown();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      if (!gestureStart) return;
      const dx = event.clientX - gestureStart.x;
      const dy = event.clientY - gestureStart.y;
      const distance = Math.hypot(dx, dy);
      if (!gestureStarted) {
        const isGesture = timerRadialGestureStarts(
          distance,
          event.timeStamp - downTime,
          pointerProfile,
        );
        if (!isGesture) return;
        gestureStarted = true;
        pressActive = false;
        optionsRef.current.onArmCancel();
      }
      const hit = timerRadialGestureDirection(dx, dy, pointerProfile.deadZonePx);
      gestureHit = hit;
      wheelRef.current?.update(
        hit,
        Math.min(1, distance / pointerProfile.deadZonePx),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      releasePointerCapture(event.pointerId);
      const start = gestureStart;
      gestureStart = null;
      if (start) wheelRef.current?.hide();
      if (start && gestureStarted) {
        const hit = gestureHit;
        gestureStarted = false;
        gestureHit = -1;
        if (hit >= 0 && gestureEnabled[hit]) optionsRef.current.fireAction(hit);
        gestureEnabled = [];
        return;
      }
      if (!pressActive) return;
      event.preventDefault();
      pressActive = false;
      optionsRef.current.onPressUp();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      cancelActivePointer();
    };

    const handleLostPointerCapture = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      cancelActivePointer();
    };

    surface.addEventListener('pointerdown', handlePointerDown, { passive: false });
    surface.addEventListener('pointermove', handlePointerMove, { passive: false });
    surface.addEventListener('pointerup', handlePointerUp, { passive: false });
    surface.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    surface.addEventListener('lostpointercapture', handleLostPointerCapture);
    window.addEventListener('blur', cancelActivePointer);
    return () => {
      cancelActivePointer();
      surface.removeEventListener('pointerdown', handlePointerDown);
      surface.removeEventListener('pointermove', handlePointerMove);
      surface.removeEventListener('pointerup', handlePointerUp);
      surface.removeEventListener('pointercancel', handlePointerCancel);
      surface.removeEventListener('lostpointercapture', handleLostPointerCapture);
      window.removeEventListener('blur', cancelActivePointer);
    };
  }, [surfaceRef, active]);

  return { wheelRef };
}
