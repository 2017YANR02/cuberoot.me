/**
 * 物理尺寸 —— 导出的图落进文档时就已经是「2.4 厘米」,不用再手动拉一次。
 * (MeiCubeTool 按厘米插图的移植;它是 Word 端定尺寸,这里改成让图片文件自己带尺寸,
 *  与编辑器无关,Word / WPS / LibreOffice / Pages 都认。)
 *
 * SVG:给 root <svg> 的 width/height 写带单位的长度,并保证 viewBox 在场 —— 没有
 *     viewBox 的话换单位等于换坐标系,图会整个错位,所以缺了就按原像素宽高补一个。
 *     根节点若带 `style="width:…"`,CSS 优先级高于属性,必须一起改,否则白写。
 * PNG:位图没有「长度」只有「每米多少像素」,即 pHYs 块。文档软件插入位图时读它定初始
 *     大小 —— 复制粘贴那条路全靠这个。
 *
 * 与 engine-svg.ts 的 `sizeEngineSvg` 不是一回事:那个把宽高钉成方形**像素**,且刻意
 * 「没有宽高属性就原样返回」(tests/engine_svg_size.test.ts 锁着)。这里反过来必须能给
 * 只有 viewBox 的 SVG(cube_unfolded_svg 就是)补上宽高。契约不同,故不合并。
 */

import { crc32 } from '@/lib/crc32';

export const PRINT_UNITS = ['cm', 'mm'] as const;
export type PrintUnit = (typeof PRINT_UNITS)[number];

export function isPrintUnit(v: unknown): v is PrintUnit {
  return typeof v === 'string' && (PRINT_UNITS as readonly string[]).includes(v);
}

const MM_PER: Record<PrintUnit, number> = { cm: 10, mm: 1 };

/** 长度换成毫米。PNG 那条路只认毫米(pHYs 是每米像素数)。 */
export function printSizeMm(size: number, unit: PrintUnit): number {
  return size * MM_PER[unit];
}

const ROOT_SVG = /<svg\b([^>]*)>/;

/** 属性值里的数字(`"96"` / `"96px"` 都认);拿不到数就是 null。 */
function attrNumber(attrs: string, name: string): number | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`).exec(attrs);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : null;
}

/**
 * root `<svg>` 的宽高改成物理长度(如 `2.4cm`),viewBox 缺失则按原像素宽高补齐。
 * size ≤ 0 / 找不到 root / 无 viewBox 又无像素宽高 → 原样返回(宁可不改也不出错图)。
 */
export function applySvgPhysicalSize(svg: string, size: number, unit: PrintUnit): string {
  if (!(size > 0) || !Number.isFinite(size)) return svg;
  const m = ROOT_SVG.exec(svg);
  if (!m) return svg;

  let attrs = m[1];
  const hasViewBox = /\sviewBox\s*=\s*"/.test(attrs);
  const w = attrNumber(attrs, 'width');
  const h = attrNumber(attrs, 'height');
  // viewBox 是换单位的前提。既没有 viewBox 又读不出像素宽高 → 无从推导坐标系,不动。
  if (!hasViewBox && (w === null || h === null)) return svg;
  if (!hasViewBox) attrs += ` viewBox="0 0 ${w} ${h}"`;

  const len = `${size}${unit}`;
  attrs = attrs.replace(/\s(?:width|height)\s*=\s*"[^"]*"/g, '');
  // 内联 style 里的 width/height 盖过属性(cube_unfolded_svg 就写着 width:100%),
  // 存在则一并改成同一个长度;不存在就不平白加一个 style。
  attrs = attrs.replace(/\sstyle\s*=\s*"([^"]*)"/, (whole, css: string) => {
    const next = css
      .replace(/(^|;)\s*width\s*:[^;]*/gi, `$1width:${len}`)
      .replace(/(^|;)\s*height\s*:[^;]*/gi, `$1height:${len}`);
    return next === css ? whole : ` style="${next}"`;
  });
  attrs += ` width="${len}" height="${len}"`;

  return svg.slice(0, m.index) + `<svg${attrs}>` + svg.slice(m.index + m[0].length);
}

// ── PNG pHYs ────────────────────────────────────────────────────────────────

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b: Uint8Array): boolean {
  return b.length > 8 && PNG_SIG.every((v, i) => b[i] === v);
}

function chunkType(b: Uint8Array, off: number): string {
  return String.fromCharCode(b[off + 4], b[off + 5], b[off + 6], b[off + 7]);
}

/** length + type + data + crc(type+data)。 */
function buildChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * 给 PNG 写入物理宽度(毫米),即插入/替换 pHYs 块。
 * 不是 PNG / 结构读不动 → 原样返回。位图整体等比,故 x/y 用同一个每米像素数。
 */
export function withPngPhysicalSize(
  png: Uint8Array<ArrayBuffer>,
  widthMm: number,
): Uint8Array<ArrayBuffer> {
  if (!isPng(png) || !(widthMm > 0) || !Number.isFinite(widthMm)) return png;
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (chunkType(png, 8) !== 'IHDR') return png;
  const pxWidth = dv.getUint32(16);
  if (!pxWidth) return png;

  // 每米像素数 = 像素宽 ÷ 物理宽(米)。
  const ppu = Math.max(1, Math.round((pxWidth * 1000) / widthMm));
  const data = new Uint8Array(9);
  const ddv = new DataView(data.buffer);
  ddv.setUint32(0, ppu);
  ddv.setUint32(4, ppu);
  data[8] = 1; // unit = metre
  const phys = buildChunk('pHYs', data);

  // IHDR 之后插入,顺手丢掉原有的 pHYs(重复块非法)。
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let off = 8;
  let placed = false;
  while (off + 12 <= png.length) {
    const total = 12 + dv.getUint32(off);
    if (off + total > png.length) return png; // 截断的文件,别乱动
    const type = chunkType(png, off);
    if (type !== 'pHYs') parts.push(png.subarray(off, off + total));
    if (type === 'IHDR') { parts.push(phys); placed = true; }
    off += total;
    if (type === 'IEND') break;
  }
  if (!placed) return png;

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
