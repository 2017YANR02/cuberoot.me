export interface SourceCrop {x: number; y: number; width: number; height: number}
export interface PixelCrop extends SourceCrop {}
export interface InputCrop extends PixelCrop {sourceWidth: number; sourceHeight: number}
export type CropHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export const FULL_CROP: SourceCrop = {x: 0, y: 0, width: 1, height: 1};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function boundedCrop(crop: SourceCrop): SourceCrop {
  if (!Object.values(crop).every(Number.isFinite)) return {...FULL_CROP};
  const width = clamp(crop.width, 0.01, 1), height = clamp(crop.height, 0.01, 1);
  return {x: clamp(crop.x, 0, 1 - width), y: clamp(crop.y, 0, 1 - height), width, height};
}

/** Normalized selection maps to original pixels, never to the scaled preview. */
export function cropPixels(crop: SourceCrop | undefined, width: number, height: number): PixelCrop | undefined {
  if (!crop) return;
  const rect = boundedCrop(crop);
  const x = Math.min(width - 1, Math.round(rect.x * width));
  const y = Math.min(height - 1, Math.round(rect.y * height));
  const right = clamp(Math.round((rect.x + rect.width) * width), x + 1, width);
  const bottom = clamp(Math.round((rect.y + rect.height) * height), y + 1, height);
  if (x === 0 && y === 0 && right === width && bottom === height) return;
  return {x, y, width: right - x, height: bottom - y};
}

export function cropFromPoints(a: {x: number; y: number}, b: {x: number; y: number}): SourceCrop {
  const x = clamp(Math.min(a.x, b.x), 0, 1), y = clamp(Math.min(a.y, b.y), 0, 1);
  return boundedCrop({x, y, width: Math.abs(clamp(a.x, 0, 1) - clamp(b.x, 0, 1)),
    height: Math.abs(clamp(a.y, 0, 1) - clamp(b.y, 0, 1))});
}

export function dragCrop(start: SourceCrop, handle: CropHandle, dx: number, dy: number): SourceCrop {
  const rect = boundedCrop(start);
  if (handle === 'move') return {...rect, x: clamp(rect.x + dx, 0, 1 - rect.width), y: clamp(rect.y + dy, 0, 1 - rect.height)};
  let left = rect.x, right = rect.x + rect.width, top = rect.y, bottom = rect.y + rect.height;
  if (handle.includes('w')) left = clamp(left + dx, 0, right - 0.01);
  if (handle.includes('e')) right = clamp(right + dx, left + 0.01, 1);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - 0.01);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + 0.01, 1);
  return {x: left, y: top, width: right - left, height: bottom - top};
}
