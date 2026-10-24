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
