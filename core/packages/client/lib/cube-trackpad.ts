export { isTrackpadSwipe } from '@cuberoot/puzzle-render-core/engine/viewControls';

/** Desktop browsers deliver trackpad pinch as a Ctrl+wheel event. Chromium
 * uses 100 pixels per unit of logarithmic scale. A zero delta can begin a pinch. */
export function trackpadPinchFactor(event: WheelEvent): number | null {
  if (!event.ctrlKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || !Number.isFinite(event.deltaY)) return null;
  return Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) / 100);
}
