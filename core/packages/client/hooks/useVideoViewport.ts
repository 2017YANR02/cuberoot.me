'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type DOMAttributes, type RefObject } from 'react';

import { bindTrackpadZoom } from '@/lib/cube-trackpad';

type Point = { x: number; y: number };
type View = { zoom: number; pan: Point };
const DEFAULT_VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } };

export function useVideoViewport(
  element: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  cropping = false,
  wheelZoom: 'always' | 'modified' = 'always',
) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const latest = useRef(view);
  const drag = useRef<Point | null>(null);
  const pinch = useRef<{ distance: number; anchor: Point; view: View } | null>(null);

  const update = useCallback((next: View) => {
    latest.current = next;
    setView(next);
  }, []);
  const reset = useCallback(() => update(DEFAULT_VIEW), [update]);

  function scaleFrom(base: View, scale: number, anchor: Point) {
    const zoom = Math.max(1, Math.min(8, scale));
    if (zoom === latest.current.zoom && base === latest.current) return;
    if (zoom === 1) {
      update(DEFAULT_VIEW);
      return;
    }
    const ratio = zoom / base.zoom;
    update({ zoom, pan: {
      x: anchor.x * (1 - ratio) + base.pan.x * ratio,
      y: anchor.y * (1 - ratio) + base.pan.y * ratio,
    } });
  }

  function anchorAt(bounds: DOMRect, point: Point) {
    const { pan } = latest.current;
    return { x: point.x - bounds.left - bounds.width / 2 + pan.x, y: point.y - bounds.top - bounds.height / 2 + pan.y };
  }

  useEffect(() => {
    const target = element.current;
    if (!target || !enabled || cropping) return;
    function onWheel(event: WheelEvent) {
      if (event.shiftKey || event.defaultPrevented || !target) return;
      if (wheelZoom === 'modified' && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? target.clientHeight : 1);
      if (!Number.isFinite(delta) || !delta) return;
      const factor = Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.001);
      scaleFrom(latest.current, latest.current.zoom * factor, anchorAt(target.getBoundingClientRect(), { x: event.clientX, y: event.clientY }));
    }
    if (wheelZoom === 'modified') {
      return bindTrackpadZoom(target, (factor, point) => {
        if (pinch.current) return; // Touchscreen pinch uses the two touch points below.
        const bounds = target.getBoundingClientRect();
        const anchor = anchorAt(bounds, {
          x: point.clientX ?? bounds.left + bounds.width / 2,
          y: point.clientY ?? bounds.top + bounds.height / 2,
        });
        scaleFrom(latest.current, latest.current.zoom * factor, anchor);
      }, onWheel);
    }
    target.addEventListener('wheel', onWheel, { passive: false });
    return () => target.removeEventListener('wheel', onWheel);
  }, [element, enabled, cropping, wheelZoom]);

  function panTo(point: Point) {
    const previous = drag.current;
    if (!previous) return;
    const { zoom, pan } = latest.current;
    drag.current = point;
    update({ zoom, pan: { x: pan.x + point.x - previous.x, y: pan.y + point.y - previous.y } });
  }

  const interaction: DOMAttributes<HTMLDivElement> = enabled && !cropping ? {
    onMouseDown: event => {
      if (event.button !== 0 || latest.current.zoom <= 1) return;
      event.preventDefault();
      drag.current = { x: event.clientX, y: event.clientY };
    },
    onMouseMove: event => panTo({ x: event.clientX, y: event.clientY }),
    onMouseUp: () => { drag.current = null; },
    onMouseLeave: () => { drag.current = null; },
    onTouchStart: event => {
      const [first, second] = Array.from(event.touches);
      if (first && second) {
        const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
        const anchor = anchorAt(event.currentTarget.getBoundingClientRect(), {
          x: (first.clientX + second.clientX) / 2, y: (first.clientY + second.clientY) / 2,
        });
        pinch.current = { distance, anchor, view: latest.current };
        drag.current = null;
      } else if (first && latest.current.zoom > 1) {
        drag.current = { x: first.clientX, y: first.clientY };
      }
    },
    onTouchMove: event => {
      const [first, second] = Array.from(event.touches);
      const start = pinch.current;
      if (first && second && start?.distance) {
        const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
        scaleFrom(start.view, start.view.zoom * distance / start.distance, start.anchor);
      } else if (first && !second && !start) {
        panTo({ x: first.clientX, y: first.clientY });
      }
    },
    onTouchEnd: event => {
      if (event.touches.length < 2) pinch.current = null;
      if (!event.touches.length) drag.current = null;
    },
    onTouchCancel: () => { pinch.current = null; drag.current = null; },
  } : {};

  const style: CSSProperties | undefined = enabled && view.zoom > 1 ? {
    transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
  } : undefined;
  return { interaction, style, zoomed: !!style, reset };
}
