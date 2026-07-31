/**
 * 站点标志 → PDF 页首(站内所有 PDF 生成器共用)。
 *
 * 资源是 `public/icons/CubeRoot-{lockup,mark}[-dark].svg`,矢量,印多大都不糊。
 * 两种形态各有用处:`lockup` 是完整锁定组合(∛ 标记 + CubeRoot + 魔方根),给首页刊头;
 * `mark` 只有标记,给续页页眉那种 9pt 高的位置 —— 整组锁到 9pt 高的话字全糊成一团。
 * `-dark` 是白墨版,深色背景的 PDF 用。
 *
 * 那两份 SVG 里的文字已经转成路径:源文件用的是 SimSun-ExtB 和文悦汇墨手书,
 * 前者别人机器上不一定有,后者是商业字体,都不可能塞进 PDF。
 */
import type { jsPDF } from 'jspdf';
import { svgStringToElement, embedSvg } from '@/lib/pdf-svg';

export type PdfLogoKind = 'lockup' | 'mark';

export interface PdfLogo {
  svg: string;
  /** 宽 / 高,按给定高度算宽度用 */
  aspect: number;
}

const cache = new Map<string, Promise<PdfLogo | null>>();

/** 取站点标志;取不到(SSR / 资源 404)返回 null,调用方跳过即可,不该让整份 PDF 挂掉。 */
export function loadPdfLogo(kind: PdfLogoKind, dark = false): Promise<PdfLogo | null> {
  const key = `${kind}${dark ? '-dark' : ''}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchLogo(key).catch((err) => {
      console.warn('[pdf] logo unavailable', key, err);
      return null;
    });
    cache.set(key, p);
  }
  return p;
}

async function fetchLogo(key: string): Promise<PdfLogo | null> {
  if (typeof document === 'undefined') return null;
  const res = await fetch(`/icons/CubeRoot-${key}.svg`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const svg = await res.text();
  const vb = /viewBox="([\d.\-\s]+)"/.exec(svg);
  const n = vb?.[1].trim().split(/\s+/).map(Number);
  if (!n || n.length !== 4 || !n[2] || !n[3]) throw new Error('no usable viewBox');
  return { svg, aspect: n[2] / n[3] };
}

/**
 * 把标志按给定高度画进去,返回它占的宽度(画不出时返回 0,调用方据此收掉留白)。
 * 每次重新 parse 一份元素 —— `embedSvg` 会把元素挂到离屏容器再摘掉,同一个节点不能复用。
 */
export async function drawPdfLogo(
  doc: jsPDF,
  logo: PdfLogo | null,
  x: number, y: number, height: number,
  align: 'left' | 'center' = 'left',
): Promise<number> {
  if (!logo) return 0;
  const w = height * logo.aspect;
  await embedSvg(doc, svgStringToElement(logo.svg), align === 'center' ? x - w / 2 : x, y, w, height);
  return w;
}
