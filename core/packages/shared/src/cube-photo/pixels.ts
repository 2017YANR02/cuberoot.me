import type { PhotoPixels } from './detect';

/** Identical area downsampling in browser and Node; avoids host-specific resize kernels. */
export function resizePhotoPixels(image: PhotoPixels, maxDimension = 640): PhotoPixels {
  if (!Number.isInteger(maxDimension) || maxDimension < 32 || maxDimension > 720
    || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1
    || image.width > 4096 || image.height > 4096 || image.data.length !== image.width * image.height * 4) throw new Error('invalid-pixels');
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale));
  if (width === image.width && height === image.height) return image;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = x * image.width / width, x1 = (x + 1) * image.width / width;
    const y0 = y * image.height / height, y1 = (y + 1) * image.height / height;
    const total = (x1 - x0) * (y1 - y0), sums = [0, 0, 0];
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
      const weight = (Math.min(sx + 1, x1) - Math.max(sx, x0)) * (Math.min(sy + 1, y1) - Math.max(sy, y0));
      const offset = (sy * image.width + sx) * 4, alpha = image.data[offset + 3] / 255;
      for (let c = 0; c < 3; c++) sums[c] += (image.data[offset + c] * alpha + 255 * (1 - alpha)) * weight;
    }
    const offset = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) data[offset + c] = Math.round(sums[c] / total);
    data[offset + 3] = 255;
  }
  return { width, height, data };
}
