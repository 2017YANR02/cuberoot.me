'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import ChatBubble, { type ChatBubbleProps } from '@/components/ChatBubble';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import './tutorial-cube-callout.css';

type Placement = 'left' | 'right' | 'above' | 'hidden';

const gutter = 8; // Leave room for the bubble's tail at the pane boundary.

export default function TutorialCubeCallout({
  side = 'right', anchorY = .5, player, targetStickers, paneRef, requireAnchor, ...props
}: Omit<ChatBubbleProps, 'tail' | 'ref'> & {
  side?: 'left' | 'right';
  anchorY?: number;
  player?: RefObject<AlgPlayerHandle | null> | (() => AlgPlayerHandle | null);
  targetStickers?: readonly string[];
  paneRef?: RefObject<HTMLElement | null>;
  requireAnchor?: boolean;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>('hidden');
  const targetKey = targetStickers?.join(',');

  useLayoutEffect(() => {
    const layer = overlay.current;
    const note = bubble.current;
    const pane = paneRef?.current ?? layer?.closest('.lbl-demonstration, .f2l-video-viewport, .f2l-case-introduction');
    const canvas = layer?.closest('.sim-stage') ?? pane?.querySelector('[data-selected="true"] .sim-stage, .f2l-concept-cube .sim-stage');
    if (!layer || !note || !pane || !canvas) return;
    const caption = pane.querySelector('.f2l-concept-caption, .f2l-case-narration');
    const viewport = window.visualViewport;
    let frame = 0;
    const stickers = targetKey ? targetKey.split(',') : [];
    const getPlayer = () => typeof player === 'function' ? player() : player?.current;

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

      const anchor = stickers.length ? getPlayer()?.getStickerAnchor?.(stickers) : null;
      if (requireAnchor && !anchor) {
        place('hidden', origin.left, origin.top, 0);
        return;
      }
      const targetX = anchor?.x ?? cx;
      const targetY = anchor?.y ?? cube.top + cube.height * anchorY;
      let fallback: { placement: Placement; x: number; y: number; width: number } | undefined;
      const preferredSides = anchor ? [side, side === 'right' ? 'left' : 'right'] as const : [side];
      for (const direction of preferredSides) {
        const nearEdge = cx + (radius + gutter) * (direction === 'right' ? 1 : -1);
        const sideWidth = direction === 'right' ? right - nearEdge : nearEdge - left;
        if (sideWidth <= 0) continue;
        const size = measure(sideWidth);
        const text = getComputedStyle(note);
        const twoLines = 2 * parseFloat(text.lineHeight) + parseFloat(text.paddingTop) + parseFloat(text.paddingBottom);
        if (size.height <= twoLines + 1 && size.height <= bottom - top && fitsWidth()) {
          const centered = targetY - size.height / 2;
          const y = Math.min(bottom - size.height, Math.max(top, centered));
          const x = direction === 'right' ? nearEdge : nearEdge - size.width;
          if (!anchor || Math.abs(centered - y) < 1) {
            place(direction, x, y, size.width);
            return;
          }
          fallback ??= { placement: direction, x, y, width: size.width };
        }
      }

      const aboveBottom = Math.min(bottom, cy - radius - gutter);
      const size = measure(right - left);
      if (size.width <= right - left && size.height <= aboveBottom - top && fitsWidth()) {
        const centered = targetX - size.width / 2;
        const x = Math.min(right - size.width, Math.max(left, centered));
        if (!fallback || Math.abs(centered - x) < 1) {
          place('above', x, aboveBottom - size.height, size.width);
          return;
        }
      }
      if (fallback) {
        place(fallback.placement, fallback.x, fallback.y, fallback.width);
        return;
      }
      place('hidden', origin.left, origin.top, 0);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const unsubscribe = stickers.length ? getPlayer()?.subscribeRenderedView?.(schedule) : undefined;
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
      unsubscribe?.();
      observer.disconnect();
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [side, anchorY, player, targetKey, paneRef, requireAnchor]);

  return <div className="tutorial-cube-callout" ref={overlay} data-placement={placement}>
    <ChatBubble {...props} ref={bubble} tail={placement === 'left' ? 'right' : placement === 'right' ? 'left' : 'bottom'} />
  </div>;
}
