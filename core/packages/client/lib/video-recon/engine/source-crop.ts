export interface SourceCrop {x: number; y: number; width: number; height: number}
export interface PixelCrop extends SourceCrop {}
export interface InputCrop extends PixelCrop {sourceWidth: number; sourceHeight: number}
const FULL_CROP: SourceCrop = {x: 0, y: 0, width: 1, height: 1};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function boundedCrop(crop: SourceCrop): SourceCrop {
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
