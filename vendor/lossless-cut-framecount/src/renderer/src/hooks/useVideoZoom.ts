import { useEffect, useRef, useState } from 'react';

const initialZoom = { scale: 1, x: 0, y: 0 };

export function zoomAtPoint(previous: typeof initialZoom, delta: number, x: number, y: number) {
  if (![delta, x, y].every((value) => Number.isFinite(value)) || delta === 0) return previous;
  const scale = Math.min(8, Math.max(1, previous.scale * Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.002)));
  const ratio = scale / previous.scale;
  return {
    scale,
    x: Math.min(0, Math.max(1 - scale, x - (x - previous.x) * ratio)),
    y: Math.min(0, Math.max(1 - scale, y - (y - previous.y) * ratio)),
  };
}

export default function useVideoZoom(filePath: string | undefined) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState({ ...initialZoom, filePath });

  if (zoom.filePath !== filePath) setZoom({ ...initialZoom, filePath });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport == null || filePath == null) return undefined;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = viewport.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      const unit = event.deltaMode === 1 ? 40 : (event.deltaMode === 2 ? bounds.height : 1);
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      setZoom((previous) => ({ ...zoomAtPoint(previous, event.deltaY * unit, x, y), filePath }));
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [filePath]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport == null || filePath == null || zoom.scale <= 1) return undefined;
    let drag: { id: number, x: number, y: number } | undefined;
    let moved = false;
    viewport.style.cursor = 'grab';

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      moved = false;
    };
    const endDrag = () => {
      if (drag && viewport.hasPointerCapture(drag.id)) viewport.releasePointerCapture(drag.id);
      drag = undefined;
      viewport.style.cursor = 'grab';
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if ((event.buttons & 1) === 0) { endDrag(); return; } // eslint-disable-line no-bitwise -- buttons is a bitmask and may include multiple pressed buttons.
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      const { width, height } = viewport.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      moved = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.style.cursor = 'grabbing';
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      setZoom((previous) => ({
        ...previous,
        x: Math.min(0, Math.max(1 - previous.scale, previous.x + dx / width)),
        y: Math.min(0, Math.max(1 - previous.scale, previous.y + dy / height)),
      }));
    };
    const suppressDragClick = (event: MouseEvent) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('lostpointercapture', endDrag);
    viewport.addEventListener('click', suppressDragClick, true);
    viewport.addEventListener('dblclick', suppressDragClick, true);
    return () => {
      endDrag();
      viewport.style.cursor = '';
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', endDrag);
      viewport.removeEventListener('pointercancel', endDrag);
      viewport.removeEventListener('lostpointercapture', endDrag);
      viewport.removeEventListener('click', suppressDragClick, true);
      viewport.removeEventListener('dblclick', suppressDragClick, true);
    };
  }, [filePath, zoom.scale]);

  return {
    viewportRef,
    cursor: zoom.scale > 1 ? 'grab' : undefined,
    transform: `translate(${zoom.x * 100}%, ${zoom.y * 100}%) scale(${zoom.scale})`,
  };
}
