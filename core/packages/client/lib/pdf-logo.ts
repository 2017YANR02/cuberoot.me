/**
 * 站点标志 → PDF 页首(站内所有 PDF 生成器共用)。
 *
 * 资源是 `public/icons/CubeRoot.png`(640×640,透明底,深色 ∛ + 红蓝九宫格),
 * 站内没有矢量版。印到 20pt 高时源图相当于 2000+ DPI,打印看不出栅格。
 *
 * 载入时按 alpha 裁到内容外接框:原图四周留着大片透明边,直接按 640×640 摆进去
 * 会变成「一个居中的小标志外加一圈空白」,页首的间距全废。裁完顺带把真实宽高比
 * 报出来 —— 换了 logo 资源这里不用改。
 */
const LOGO_SRC = '/icons/CubeRoot.png';

export interface PdfLogo {
  /** 裁剪后的 PNG data URL */
  dataUrl: string;
  /** 裁剪后的像素宽高(只用来算宽高比) */
  w: number;
  h: number;
}

let pending: Promise<PdfLogo | null> | null = null;

/** 取站点标志;取不到(SSR / 资源 404 / canvas 不可用)返回 null,调用方跳过即可,不该让整份 PDF 挂掉。 */
export function loadPdfLogo(): Promise<PdfLogo | null> {
  if (!pending) pending = trimmedLogo().catch((err) => {
    console.warn('[pdf] logo unavailable', err);
    return null;
  });
  return pending;
}

async function trimmedLogo(): Promise<PdfLogo | null> {
  if (typeof document === 'undefined') return null;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`load failed: ${LOGO_SRC}`));
    el.src = LOGO_SRC;
  });

  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0);

  const { data } = sctx.getImageData(0, 0, src.width, src.height);
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      // 阈值取 8 而不是 0:PNG 边缘抗锯齿会留下一圈近乎全透明的像素
      if (data[(y * src.width + x) * 4 + 3] <= 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) return null;   // 整张全透明

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')?.drawImage(src, x0, y0, w, h, 0, 0, w, h);
  return { dataUrl: out.toDataURL('image/png'), w, h };
}

/**
 * 把标志按给定高度画进去,返回它占的宽度(算不出 / 画不出时返回 0,调用方据此收掉留白)。
 * 传同一个 alias,整份 PDF 只嵌一次图。
 */
export function drawPdfLogo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  logo: PdfLogo | null,
  x: number, y: number, height: number,
  align: 'left' | 'center' = 'left',
): number {
  if (!logo) return 0;
  const w = height * (logo.w / logo.h);
  try {
    doc.addImage(logo.dataUrl, 'PNG', align === 'center' ? x - w / 2 : x, y, w, height, 'cuberoot-logo');
  } catch (err) {
    console.warn('[pdf] addImage(logo) failed', err);
    return 0;
  }
  return w;
}
