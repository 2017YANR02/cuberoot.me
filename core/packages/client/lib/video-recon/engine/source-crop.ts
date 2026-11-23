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

/** Display crop for nearly black, opposing bars in a video frame. Require
 * matching widths and a clear transition to the image on both sides. */
export function detectVideoBars(frame: ImageBitmap): SourceCrop | undefined {
  const scale = Math.min(1, 640 / Math.max(frame.width, frame.height));
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  const sample = new OffscreenCanvas(width, height);
  const context = sample.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  context.drawImage(frame, 0, 0, width, height);
  const {data} = context.getImageData(0, 0, width, height);

  function barWidths(horizontal: boolean): [number, number] {
    const length = horizontal ? width : height;
    const across = horizontal ? height : width;
    // Skip the corners so letterboxing and pillarboxing can be detected independently.
    const start = Math.floor(across / 4), end = Math.ceil(across * 3 / 4);
    const maxWidth = Math.floor(length / 4);
    function darkFraction(line: number) {
      let dark = 0;
      for (let offset = start; offset < end; offset++) {
        const i = (horizontal ? offset * width + line : line * width + offset) * 4;
        if (data[i + 3] >= 250 && Math.max(data[i], data[i + 1], data[i + 2]) <= 24) dark++;
      }
      return dark / (end - start);
    }
    function fromEdge(edge: number, direction: number) {
      let count = 0;
      while (count <= maxWidth && darkFraction(edge + direction * count) >= 0.98) count++;
      const inside = count + Math.max(1, Math.round(length * 0.01));
      return count <= maxWidth && inside < length && darkFraction(edge + direction * inside) <= 0.6 ? count : 0;
    }
    const first = fromEdge(0, 1), last = fromEdge(length - 1, -1);
    if (Math.min(first, last) < Math.max(2, length * 0.02) || Math.abs(first - last) > length * 0.02) return [0, 0];
    return [first / length, last / length];
  }

  const [left, right] = barWidths(true);
  const [top, bottom] = barWidths(false);
  if (left || top) return {x: left, y: top, width: 1 - left - right, height: 1 - top - bottom};
}
