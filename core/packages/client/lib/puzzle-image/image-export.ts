/**
 * 一张图从 SVG 字符串到「用户手里」的那几步:栅格化、下载、复制到剪贴板。
 * 唯一宿主是 /sim 的图像面板。
 *
 * 浏览器相关,勿在 node/测试里直接调。
 */

export function svgBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * SVG → PNG。`size` 是输出的方形像素边长;非方 viewBox 的引擎矢量按 contain 居中
 * (拉成方形会变形)。
 */
export async function svgToPngBlob(svg: string, size: number): Promise<Blob> {
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

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
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
