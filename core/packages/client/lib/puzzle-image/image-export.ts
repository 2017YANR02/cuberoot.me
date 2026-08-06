/**
 * 一张图从 SVG 字符串到「用户手里」的那几步:栅格化、下载、复制到剪贴板。
 * 唯一宿主是 /sim 的图像面板。
 *
 * 浏览器相关,勿在 node/测试里直接调。
 */

export function svgBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export type RasterImageFormat = 'png' | 'jpeg';

export interface SvgRasterOptions {
  /** Output canvas dimensions in physical pixels. */
  width: number;
  height?: number;
  format?: RasterImageFormat;
  /** JPEG/WebP-style encoder quality. Ignored by PNG. */
  quality?: number;
  /** Explicit canvas fill. JPEG defaults to white because it cannot keep alpha. */
  background?: string | null;
}

function positivePixelSize(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : fallback;
}

/**
 * SVG → PNG/JPEG. The source keeps its aspect ratio and is contain-fitted into
 * the requested canvas, so a non-square engine view never gets stretched.
 */
export async function svgToRasterBlob(svg: string, options: SvgRasterOptions): Promise<Blob> {
  const width = positivePixelSize(options.width, 1);
  const height = positivePixelSize(options.height ?? width, width);
  const format = options.format ?? 'png';
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = Number.isFinite(options.quality)
    ? Math.min(1, Math.max(0, options.quality!))
    : 0.92;
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG decode failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    // JPEG has no alpha. White is an export-domain default, not site chrome.
    const background = options.background === undefined
      ? (format === 'jpeg' ? '#ffffff' : null)
      : options.background;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    const iw = img.naturalWidth || width;
    const ih = img.naturalHeight || height;
    const k = Math.min(width / iw, height / ih);
    ctx.drawImage(img, (width - iw * k) / 2, (height - ih * k) / 2, iw * k, ih * k);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        mime,
        format === 'jpeg' ? quality : undefined,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Back-compatible square PNG helper. `size` is the output pixel edge; non-square
 * SVG content is contain-fitted and centred exactly as before.
 */
export function svgToPngBlob(svg: string, size: number): Promise<Blob> {
  return svgToRasterBlob(svg, { width: size, height: size, format: 'png' });
}

/** Square JPEG convenience wrapper for callers that do not need a custom canvas. */
export function svgToJpegBlob(svg: string, size: number, quality = 0.92): Promise<Blob> {
  return svgToRasterBlob(svg, { width: size, height: size, format: 'jpeg', quality });
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Firefox needs the object URL to outlive the click tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function clipboardImageSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof ClipboardItem !== 'undefined'
    && !!navigator.clipboard?.write;
}

/**
 * PNG 写进剪贴板。**必须在点击处理器里同步调用** —— Safari 只认「手势那一刻就
 * 构造好的」ClipboardItem,所以这里收的是 Promise<Blob> 而不是 Blob,让调用方
 * 不必先 await(await 一下手势就过期了)。
 */
export async function copyPngToClipboard(png: Promise<Blob>): Promise<void> {
  if (!clipboardImageSupported()) throw new Error('clipboard image unsupported');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
