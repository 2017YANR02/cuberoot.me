/**
 * 一张图从 SVG 字符串到「用户手里」的那几步:栅格化、写物理尺寸、下载、复制到剪贴板。
 * /sim 图像面板和 /sim/batch 批量页共用同一份,免两处漂移。
 *
 * 浏览器相关,勿在 node/测试里直接调(纯逻辑在 physical-size.ts / zip.ts,那两个可测)。
 */

import { applySvgPhysicalSize, printSizeMm, withPngPhysicalSize, type PrintUnit } from './physical-size';

export interface PhysicalSize {
  size: number;
  unit: PrintUnit;
}

/** 导出用的 SVG 文本:要物理尺寸就套上,不要就原样。 */
export function exportSvgText(svg: string, physical?: PhysicalSize | null): string {
  return physical && physical.size > 0
    ? applySvgPhysicalSize(svg, physical.size, physical.unit)
    : svg;
}

export function svgBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * SVG → PNG。`size` 是输出的方形像素边长;非方 viewBox 的引擎矢量按 contain 居中
 * (拉成方形会变形)。有物理尺寸就写进 pHYs,粘进文档时按厘米落地。
 */
export async function svgToPngBlob(
  svg: string,
  size: number,
  physical?: PhysicalSize | null,
): Promise<Blob> {
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
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const iw = img.naturalWidth || size;
    const ih = img.naturalHeight || size;
    const k = Math.min(size / iw, size / ih);
    ctx.drawImage(img, (size - iw * k) / 2, (size - ih * k) / 2, iw * k, ih * k);

    const raw = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
    if (!physical || !(physical.size > 0)) return raw;
    // 显式标注:tsgo 不认 withPngPhysicalSize 声明的 Uint8Array<ArrayBuffer> 返回类型,
    // 会退回 ArrayBufferLike 而 Blob 只收 ArrayBuffer 那一支(tsc 无此问题)。
    const stamped: Uint8Array<ArrayBuffer> = withPngPhysicalSize(
      new Uint8Array(await raw.arrayBuffer()),
      printSizeMm(physical.size, physical.unit),
    );
    return new Blob([stamped], { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
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
