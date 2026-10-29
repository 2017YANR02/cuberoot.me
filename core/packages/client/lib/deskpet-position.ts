/** Let the visual center peek 8% of the pet size past either visible edge. */
export function clampDeskPetAxis(anchor: number, size: number, center: number, viewportSize: number, start: number, end: number) {
  const inset = -size * 0.08;
  const min = viewportSize - end + inset - size * (1 - center);
  const max = Math.max(min, viewportSize - start - inset - size * (1 - center));
  return Math.min(Math.max(min, anchor), max);
}

/** Read fixed CSS anchors without mixing layout and visual viewport coordinates.
 * Mobile browser chrome can move getBoundingClientRect() relative to innerHeight
 * during scrolling; feeding that difference back into bottom accumulates drift.
 */
export function readDeskPetAnchor(root: HTMLElement, viewportWidth: number, viewportHeight: number) {
  const style = getComputedStyle(root);
  const rect = root.getBoundingClientRect();
  const pixels = (value: string, fallback: number) => /^-?\d+(?:\.\d+)?px$/.test(value)
    ? Number.parseFloat(value) : fallback;
  return {
    right: pixels(style.right, viewportWidth - rect.right),
    bottom: pixels(style.bottom, viewportHeight - rect.bottom),
  };
}
