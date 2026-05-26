import type { ChooseSet, RGB } from '../state/types';
import { applyClosest, applyErrorDiffusion, applyGradient, applyOrdered } from './dither';

/** Resize src image onto (w x h) pixels with high-quality smoothing. */
export function resizeToImageData(src: HTMLImageElement | HTMLCanvasElement, w: number, h: number): ImageData {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Apply the method to base ImageData and return mosaic ImageData (same size). */
export function applyMethod(
  base: ImageData,
  palette: RGB[],
  method: ChooseSet['method'],
  opt: number | number[],
): ImageData {
  switch (method) {
    case 'gradient':       return applyGradient(base, palette, opt as number[]);
    case 'closest':        return applyClosest(base, palette);
    case 'ordered':        return applyOrdered(base, palette, opt as number);
    case 'errorDiffusion': return applyErrorDiffusion(base, palette, opt as number);
  }
}

/** Draw mosaic into canvas either as miniature (1:1 pixels) or as stickered preview with plastic borders. */
export function drawMosaicToCanvas(
  cv: HTMLCanvasElement,
  mosaic: ImageData,
  mode: 'miniature' | 'stickers',
  plasticColor: string | null,
) {
  const srcW = mosaic.width, srcH = mosaic.height;
  const ctx = cv.getContext('2d')!;

  if (mode === 'miniature') {
    cv.width = srcW;
    cv.height = srcH;
    ctx.putImageData(mosaic, 0, 0);
    return;
  }

  // stickers mode — keep canvas display width, scale up
  const displayW = cv.clientWidth || cv.width || srcW * 4;
  const stickerSize = displayW / srcW;
  cv.width = Math.round(stickerSize * srcW);
  cv.height = Math.round(stickerSize * srcH);
  const d = mosaic.data;
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const i = (x + y * srcW) * 4;
      ctx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
      ctx.fillRect(x * stickerSize, y * stickerSize, stickerSize, stickerSize);
    }
  }
  if (plasticColor) {
    ctx.strokeStyle = plasticColor;
    ctx.lineWidth = Math.max(1, stickerSize / 7);
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        ctx.strokeRect(x * stickerSize, y * stickerSize, stickerSize, stickerSize);
      }
    }
  }
}
