/**
 * SVG 字符串 → jsPDF 页面上的矢量图(站内所有 PDF 生成器共用)。
 *
 * 走 svg2pdf.js:它给 jsPDF 原型挂了个 `doc.svg()`,所以 import 本模块即等于打上补丁。
 * 图进 PDF 后仍是矢量 —— 打印出来的魔方图不会有栅格锯齿。
 */
import type { jsPDF } from 'jspdf';
import 'svg2pdf.js';

export function svgStringToElement(svgStr: string): SVGSVGElement {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(svgStr, 'image/svg+xml');
  return parsed.documentElement as unknown as SVGSVGElement;
}

let svgRenderHost: HTMLDivElement | null = null;
function getSvgRenderHost(): HTMLDivElement {
  if (svgRenderHost && svgRenderHost.isConnected) return svgRenderHost;
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:600px;height:450px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(div);
  svgRenderHost = div;
  return div;
}

export async function embedSvg(
  doc: jsPDF,
  el: SVGSVGElement,
  x: number, y: number, w: number, h: number,
): Promise<void> {
  // 根节点不是 <svg>(比如渲染器包了一层 div,或 DOMParser 吐了 parsererror)时
  // svg2pdf 不报错,只是什么都不画 —— 那种「图莫名其妙没了」最难查,这里直接喊出来。
  if (el.tagName?.toLowerCase() !== 'svg') {
    console.warn('[pdf] embedSvg: root element is not <svg>, got', el.tagName);
    return;
  }
  // svg2pdf.js calls getBBox / getComputedStyle, which only work for
  // *attached* elements. Briefly attach to an off-screen host.
  const host = getSvgRenderHost();
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
  host.appendChild(el);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (doc as any).svg(el, { x, y, width: w, height: h });
  } catch (err) {
    console.warn('[pdf] svg2pdf failed', err);
  } finally {
    try { el.remove(); } catch { /* swallow */ }
  }
}
