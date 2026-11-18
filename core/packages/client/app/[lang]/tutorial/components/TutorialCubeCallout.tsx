'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import ChatBubble, { type ChatBubbleProps } from '@/components/ChatBubble';
import './tutorial-cube-callout.css';

type Placement = 'left' | 'right' | 'above' | 'hidden';

const gutter = 8; // Leave room for the bubble's tail at the pane boundary.

export default function TutorialCubeCallout({ side = 'right', anchorY = .5, ...props }: Omit<ChatBubbleProps, 'tail' | 'ref'> & {
  side?: 'left' | 'right';
  anchorY?: number;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>('hidden');

  useLayoutEffect(() => {
    const layer = overlay.current;
    const note = bubble.current;
    const pane = layer?.closest('.lbl-demonstration, .f2l-video-viewport, .f2l-case-introduction');
    const canvas = layer?.closest('.sim-stage') ?? pane?.querySelector('[data-selected="true"] .sim-stage, .f2l-concept-cube .sim-stage');
    if (!layer || !note || !pane || !canvas) return;
    const caption = pane.querySelector('.f2l-concept-caption, .f2l-case-narration');
    const viewport = window.visualViewport;
    let frame = 0;

    const update = () => {
      frame = 0;
      const origin = layer.offsetParent?.getBoundingClientRect();
      const bounds = pane.getBoundingClientRect();
      const cube = canvas.getBoundingClientRect();
      const copy = caption?.getBoundingClientRect();
      if (!origin || !cube.width || !cube.height) {
        setPlacement('hidden');
        return;
      }

      const cx = cube.left + cube.width / 2;
      const cy = cube.top + cube.height / 2;
      // The renderer centers the cube in the canvas with transparent space around it.
      const radius = Math.min(cube.width, cube.height) * .39;
      const vx = viewport?.offsetLeft ?? 0;
      const vy = viewport?.offsetTop ?? 0;
      const left = Math.max(bounds.left, vx) + gutter;
      const top = Math.max(bounds.top, vy) + gutter;
      let right = Math.min(bounds.right, vx + (viewport?.width ?? document.documentElement.clientWidth)) - gutter;
      let bottom = Math.min(bounds.bottom, vy + (viewport?.height ?? document.documentElement.clientHeight)) - gutter;
      if (copy?.width && copy.height) {
        if (copy.left > cx) right = Math.min(right, copy.left - gutter);
        else if (copy.top > cy) bottom = Math.min(bottom, copy.top - gutter);
      }

      const measure = (width: number) => {
        layer.style.width = `${Math.max(1, Math.floor(width))}px`;
        return note.getBoundingClientRect();
      };
      // ChatBubble's SVG extends beyond its border box to draw the tail.
      const fitsWidth = () => note.scrollWidth <= note.clientWidth + gutter + 1;
      const place = (next: Placement, x: number, y: number, width: number) => {
        layer.style.width = `${Math.ceil(width)}px`;
        layer.style.left = `${x - origin.left}px`;
        layer.style.top = `${y - origin.top}px`;
        setPlacement(next);
      };

      const nearEdge = cx + (radius + gutter) * (side === 'right' ? 1 : -1);
      const sideWidth = side === 'right' ? right - nearEdge : nearEdge - left;
      if (sideWidth > 0) {
        const size = measure(sideWidth);
        const text = getComputedStyle(note);
        const twoLines = 2 * parseFloat(text.lineHeight) + parseFloat(text.paddingTop) + parseFloat(text.paddingBottom);
        if (size.height <= twoLines + 1 && size.height <= bottom - top && fitsWidth()) {
          const y = Math.min(bottom - size.height, Math.max(top, cube.top + cube.height * anchorY - size.height / 2));
          place(side, side === 'right' ? nearEdge : nearEdge - size.width, y, size.width);
          return;
        }
      }

      const aboveBottom = Math.min(bottom, cy - radius - gutter);
      const size = measure(right - left);
      if (size.width <= right - left && size.height <= aboveBottom - top && fitsWidth()) {
        const x = Math.min(right - size.width, Math.max(left, cx - size.width / 2));
        place('above', x, aboveBottom - size.height, size.width);
        return;
      }
      place('hidden', origin.left, origin.top, 0);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(pane);
    observer.observe(canvas);
    observer.observe(note);
    if (caption) observer.observe(caption);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    update();
    return () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [side, anchorY]);

  return <div className="tutorial-cube-callout" ref={overlay} data-placement={placement}>
    <ChatBubble {...props} ref={bubble} tail={placement === 'left' ? 'right' : placement === 'right' ? 'left' : 'bottom'} />
  </div>;
}
