export { isTrackpadSwipe } from '@cuberoot/puzzle-render-core/engine/viewControls';

/** Desktop browsers deliver trackpad pinch as a Ctrl+wheel event. Chromium
 * uses 100 pixels per unit of logarithmic scale. A zero delta can begin a pinch. */
export function trackpadPinchFactor(event: WheelEvent): number | null {
  if (!event.ctrlKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || !Number.isFinite(event.deltaY)) return null;
  return Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) / 100);
}

/** Route a trackpad gesture to its target once, including on browsers that emit both event types. */
export function bindTrackpadZoom(
  handle: HTMLElement,
  onPinch: (factor: number, point: { clientX?: number; clientY?: number }) => void,
  onScroll: (event: WheelEvent) => void,
) {
  let gestureScale: number | null = null;
  function consumeZoom(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }
  function onWheel(event: WheelEvent) {
    if (event.defaultPrevented) return;
    const factor = trackpadPinchFactor(event);
    if (factor !== null) {
      consumeZoom(event);
      if (gestureScale === null && factor !== 1) onPinch(factor, event);
      return;
    }
    onScroll(event);
  }
  function startGesture(event: Event) {
    consumeZoom(event);
    gestureScale = 1;
  }
  function changeGesture(event: Event) {
    if (gestureScale === null) return;
    consumeZoom(event);
    const gesture = event as Event & { scale: number; clientX?: number; clientY?: number };
    const { scale } = gesture;
    if (!Number.isFinite(scale) || scale <= 0 || scale === gestureScale) return;
    onPinch(scale / gestureScale, gesture);
    gestureScale = scale;
  }
  function endGesture(event: Event) {
    if (gestureScale === null) return;
    consumeZoom(event);
    gestureScale = null;
  }
  handle.addEventListener('wheel', onWheel, { passive: false });
  handle.addEventListener('gesturestart', startGesture, { passive: false });
  handle.addEventListener('gesturechange', changeGesture, { passive: false });
  handle.addEventListener('gestureend', endGesture, { passive: false });
  return () => {
    handle.removeEventListener('wheel', onWheel);
    handle.removeEventListener('gesturestart', startGesture);
    handle.removeEventListener('gesturechange', changeGesture);
    handle.removeEventListener('gestureend', endGesture);
  };
}
