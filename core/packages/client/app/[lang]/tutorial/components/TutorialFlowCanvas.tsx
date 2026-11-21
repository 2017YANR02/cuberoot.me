'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import './tutorial-flow-canvas.css';

export default function TutorialFlowCanvas({ label, children }: { label: string; children: ReactNode }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gesture: { id: number; x: number; y: number; left: number; top: number; dragging: boolean } | null = null;
    let suppressClick = false;
    const finish = () => {
      const current = gesture;
      gesture = null;
      canvas.removeAttribute('data-panning');
      if (current?.dragging) suppressClick = true;
      if (current && canvas.hasPointerCapture(current.id)) canvas.releasePointerCapture(current.id);
    };
    const down = (event: PointerEvent) => {
      // Leave multi-touch to browser pinch zoom, and native scrollbar drags alone.
      if (!event.isPrimary) { finish(); return; }
      if (event.button !== 0) return;
      const bounds = canvas.getBoundingClientRect();
      if (event.clientX >= bounds.left + canvas.clientWidth || event.clientY >= bounds.top + canvas.clientHeight) return;
      suppressClick = false;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
        left: canvas.scrollLeft, top: canvas.scrollTop, dragging: false };
    };
    const move = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) { finish(); return; }
      const dx = gesture.x - event.clientX, dy = gesture.y - event.clientY;
      if (!gesture.dragging) {
        if (Math.hypot(dx, dy) < 6) return;
        gesture.dragging = true;
        canvas.setPointerCapture(event.pointerId);
        canvas.setAttribute('data-panning', '');
      }
      event.preventDefault();
      canvas.scrollTo({ left: gesture.left + dx, top: gesture.top + dy, behavior: 'instant' });
    };
    const up = (event: PointerEvent) => { if (gesture?.id === event.pointerId) finish(); };
    const lostCapture = (event: PointerEvent) => {
      // Taking capture from a touched SVG child also bubbles its lost-capture event.
      if (event.target === canvas && !canvas.hasPointerCapture(event.pointerId)) up(event);
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const keydown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        // Let the focused canvas scroll without also navigating to another lesson.
        event.stopPropagation();
      }
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move, { passive: false });
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', lostCapture);
    canvas.addEventListener('click', click, true);
    canvas.addEventListener('keydown', keydown);
    return () => {
      finish();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', lostCapture);
      canvas.removeEventListener('click', click, true);
      canvas.removeEventListener('keydown', keydown);
    };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const showScrollbar = () => {
      if (!canvas.hasAttribute('data-flow-scrolling')) canvas.setAttribute('data-flow-scrolling', '');
      clearTimeout(timeout);
      timeout = setTimeout(() => canvas.removeAttribute('data-flow-scrolling'), 1000);
    };
    canvas.addEventListener('scroll', showScrollbar, { passive: true });
    return () => {
      canvas.removeEventListener('scroll', showScrollbar);
      clearTimeout(timeout);
      canvas.removeAttribute('data-flow-scrolling');
    };
  }, []);
  return <div ref={canvasRef} className="lbl-flow-canvas" tabIndex={0} role="region" aria-label={label}>
    {children}
  </div>;
}
