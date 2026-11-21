type Point = { x: number; y: number };

export function videoCropBounds(a: Point, b: Point) {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const left = clamp(Math.min(a.x, b.x));
  const right = clamp(Math.max(a.x, b.x));
  const top = clamp(Math.min(a.y, b.y));
  const bottom = clamp(Math.max(a.y, b.y));
  return { left, right, top, bottom };
}
