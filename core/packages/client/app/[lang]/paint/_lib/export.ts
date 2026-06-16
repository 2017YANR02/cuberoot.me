// SVG / PNG export + import + localStorage persistence.
//
// We build SVG strings directly (not via React render) so this works
// server-or-worker-free and stays a pure string. Geometry mirrors the registry
// render() exactly.

import type {
  Bounds,
  FreehandShape,
  LineShape,
  PaintDoc,
  PathShape,
  RectShape,
  Shape,
  TextShape,
} from './types';
import { aabbOfRotated, boundsCenter, unionBounds } from './geometry';
import { smoothPath, translatePathD } from './registry';
import { DEFAULT_PAPER } from './paper';

export const DOC_KEY = 'paint:doc:v1';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function strokeAttrs(s: Shape): string {
  const parts: string[] = [];
  parts.push(`fill="${s.fill === 'none' ? 'none' : esc(s.fill)}"`);
  parts.push(`stroke="${s.stroke === 'none' ? 'none' : esc(s.stroke)}"`);
  if (s.strokeWidth) parts.push(`stroke-width="${s.strokeWidth}"`);
  if (s.strokeDash && s.strokeDash.length)
    parts.push(`stroke-dasharray="${s.strokeDash.join(' ')}"`);
  if (s.strokeLinecap) parts.push(`stroke-linecap="${s.strokeLinecap}"`);
  if (s.strokeLinejoin) parts.push(`stroke-linejoin="${s.strokeLinejoin}"`);
  if (s.opacity !== 1) parts.push(`opacity="${s.opacity}"`);
  return parts.join(' ');
}

function rotateWrap(s: Shape, inner: string): string {
  if (!s.rotation) return inner;
  const c = boundsCenter({ x: s.x, y: s.y, width: s.width, height: s.height });
  return `<g transform="rotate(${s.rotation} ${c.x} ${c.y})">${inner}</g>`;
}

function shapeToSvg(s: Shape): string {
  const a = strokeAttrs(s);
  switch (s.type) {
    case 'rect': {
      const r = s as RectShape;
      const rxy = r.rx ? ` rx="${r.rx}" ry="${r.rx}"` : '';
      return rotateWrap(
        s,
        `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}"${rxy} ${a}/>`
      );
    }
    case 'ellipse':
      return rotateWrap(
        s,
        `<ellipse cx="${s.x + s.width / 2}" cy="${s.y + s.height / 2}" rx="${s.width / 2}" ry="${s.height / 2}" ${a}/>`
      );
    case 'line': {
      const l = s as LineShape;
      const [x1, y1, x2, y2] = l.flipped
        ? [s.x, s.y + s.height, s.x + s.width, s.y]
        : [s.x, s.y, s.x + s.width, s.y + s.height];
      return rotateWrap(
        s,
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a} fill="none"/>`
      );
    }
    case 'path': {
      const p = s as PathShape;
      const d = translatePathD(p.d, s.x, s.y);
      const fillAttr = p.closed && s.fill !== 'none' ? '' : ' fill="none"';
      return rotateWrap(s, `<path d="${esc(d)}" ${a}${fillAttr}/>`);
    }
    case 'freehand': {
      const f = s as FreehandShape;
      const d = smoothPath(f.pts.map(([px, py]) => [s.x + px, s.y + py] as [number, number]));
      return rotateWrap(s, `<path d="${esc(d)}" ${a} fill="none"/>`);
    }
    case 'text': {
      const t = s as TextShape;
      const anchor =
        t.textAlign === 'center' ? 'middle' : t.textAlign === 'right' ? 'end' : 'start';
      const tx =
        t.textAlign === 'center'
          ? s.x + s.width / 2
          : t.textAlign === 'right'
            ? s.x + s.width
            : s.x;
      const lineH = t.fontSize * 1.25;
      const lines = t.text.length ? t.text.split('\n') : [''];
      const baseY = s.y + t.fontSize * 0.82;
      const family = t.fontFamily.startsWith('var(') ? 'sans-serif' : t.fontFamily;
      const body =
        lines.length === 1
          ? esc(lines[0])
          : lines
              .map(
                (ln, i) =>
                  `<tspan x="${tx}" dy="${i === 0 ? 0 : lineH}">${esc(ln === '' ? ' ' : ln)}</tspan>`
              )
              .join('');
      const strokeAttr =
        s.stroke && s.stroke !== 'none' && t.strokeWidth
          ? ` stroke="${esc(s.stroke)}" stroke-width="${t.strokeWidth}"`
          : '';
      return rotateWrap(
        s,
        `<text x="${tx}" y="${baseY}" font-size="${t.fontSize}" font-family="${esc(family)}" font-weight="${t.fontWeight}" text-anchor="${anchor}" fill="${s.fill === 'none' ? 'none' : esc(s.fill)}"${strokeAttr} ${s.opacity !== 1 ? `opacity="${s.opacity}"` : ''}>${body}</text>`
      );
    }
    default:
      // freehand/polygon/star/group placeholders: bbox rect.
      return rotateWrap(
        s,
        `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" ${a}/>`
      );
  }
}

function contentBounds(doc: PaintDoc): Bounds {
  const boxes: Bounds[] = [];
  for (const id of doc.order) {
    const s = doc.shapes[id];
    if (!s || s.hidden) continue;
    boxes.push(
      aabbOfRotated(
        { x: s.x, y: s.y, width: s.width, height: s.height },
        s.rotation
      )
    );
  }
  return unionBounds(boxes) ?? { x: 0, y: 0, width: 100, height: 100 };
}

export function toSvgString(doc: PaintDoc, pad = 8): string {
  const bb = contentBounds(doc);
  const x = bb.x - pad;
  const y = bb.y - pad;
  const w = Math.max(1, bb.width + pad * 2);
  const h = Math.max(1, bb.height + pad * 2);
  // Export is transparent: paper is the on-screen working surface only, not part
  // of the artwork (Illustrator/Figma norm). No background rect is baked in.
  const body = doc.order
    .map((id) => doc.shapes[id])
    .filter((s): s is Shape => !!s && !s.hidden)
    .map(shapeToSvg)
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">\n  ${body}\n</svg>`;
}

export async function toPng(doc: PaintDoc, scale = 2): Promise<Blob> {
  const svg = toSvgString(doc);
  const bb = contentBounds(doc);
  const w = Math.max(1, Math.ceil((bb.width + 16) * scale));
  const h = Math.max(1, Math.ceil((bb.height + 16) * scale));
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('svg load failed'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  // Leave the canvas transparent (default 2d context has an alpha channel) so the
  // PNG exports only the shapes — paper is screen-only, never baked in.
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png');
  });
}

// Small PNG dataURL for the cloud library grid. Unlike export (transparent), the
// thumbnail BAKES the paper background so the card shows the drawing exactly as it
// looks on its artboard. Fits within maxDim, returns null for an empty doc / failure.
export async function toThumbnail(doc: PaintDoc, maxDim = 360): Promise<string | null> {
  if (!doc.order.some((id) => doc.shapes[id] && !doc.shapes[id].hidden)) return null;
  const svg = toSvgString(doc);
  const bb = contentBounds(doc);
  const pad = 8;
  const cw = Math.max(1, bb.width + pad * 2);
  const ch = Math.max(1, bb.height + pad * 2);
  const scale = Math.min(maxDim / cw, maxDim / ch, 2);
  const w = Math.max(1, Math.round(cw * scale));
  const h = Math.max(1, Math.round(ch * scale));
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg load failed'));
      img.src = url;
    });
  } catch {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = doc.paper || DEFAULT_PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// Best-effort import. Parses rect/ellipse/circle/line/polygon/path/text into our
// model. Tolerates anything it cannot map (skips it).
export function fromSvgString(svg: string): Partial<PaintDoc> {
  const out: PaintDoc = { shapes: {}, order: [], paper: DEFAULT_PAPER };
  if (typeof DOMParser === 'undefined') return out;
  let dom: Document;
  try {
    dom = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch {
    return out;
  }
  if (dom.querySelector('parsererror')) return out;

  let n = 0;
  const add = (s: Shape | null) => {
    if (!s) return;
    out.shapes[s.id] = s;
    out.order.push(s.id);
  };
  const id = (p: string) => `${p}_imp${n++}`;
  const num = (v: string | null, d = 0) => {
    const f = v == null ? NaN : parseFloat(v);
    return Number.isFinite(f) ? f : d;
  };
  const common = (el: Element) => ({
    rotation: 0,
    fill: el.getAttribute('fill') ?? '#cbd5e1',
    stroke: el.getAttribute('stroke') ?? 'none',
    strokeWidth: num(el.getAttribute('stroke-width'), 1),
    opacity: num(el.getAttribute('opacity'), 1),
  });

  dom.querySelectorAll('rect').forEach((el) => {
    add({
      id: id('rect'),
      type: 'rect',
      x: num(el.getAttribute('x')),
      y: num(el.getAttribute('y')),
      width: num(el.getAttribute('width')),
      height: num(el.getAttribute('height')),
      rx: num(el.getAttribute('rx')),
      ...common(el),
    } as RectShape);
  });
  dom.querySelectorAll('ellipse').forEach((el) => {
    const rx = num(el.getAttribute('rx'));
    const ry = num(el.getAttribute('ry'));
    add({
      id: id('ell'),
      type: 'ellipse',
      x: num(el.getAttribute('cx')) - rx,
      y: num(el.getAttribute('cy')) - ry,
      width: rx * 2,
      height: ry * 2,
      ...common(el),
    } as Shape);
  });
  dom.querySelectorAll('circle').forEach((el) => {
    const r = num(el.getAttribute('r'));
    add({
      id: id('ell'),
      type: 'ellipse',
      x: num(el.getAttribute('cx')) - r,
      y: num(el.getAttribute('cy')) - r,
      width: r * 2,
      height: r * 2,
      ...common(el),
    } as Shape);
  });
  dom.querySelectorAll('line').forEach((el) => {
    const x1 = num(el.getAttribute('x1'));
    const y1 = num(el.getAttribute('y1'));
    const x2 = num(el.getAttribute('x2'));
    const y2 = num(el.getAttribute('y2'));
    add({
      id: id('line'),
      type: 'line',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      flipped: (x2 - x1) * (y2 - y1) < 0,
      ...common(el),
      fill: 'none',
    } as LineShape);
  });
  dom.querySelectorAll('path').forEach((el) => {
    const d = el.getAttribute('d') ?? '';
    if (!d) return;
    add({
      id: id('path'),
      type: 'path',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      d,
      closed: /z\s*$/i.test(d.trim()),
      ...common(el),
    } as PathShape);
  });
  dom.querySelectorAll('text').forEach((el) => {
    const x = num(el.getAttribute('x'));
    const y = num(el.getAttribute('y'));
    const fs = num(el.getAttribute('font-size'), 16);
    add({
      id: id('text'),
      type: 'text',
      x,
      y: y - fs,
      width: (el.textContent?.length ?? 4) * fs * 0.55,
      height: fs * 1.3,
      text: el.textContent ?? '',
      fontSize: fs,
      fontFamily: el.getAttribute('font-family') ?? 'sans-serif',
      fontWeight: num(el.getAttribute('font-weight'), 400),
      textAlign: 'left',
      ...common(el),
      fill: el.getAttribute('fill') ?? '#171717',
    } as TextShape);
  });

  return out;
}

// --- localStorage -------------------------------------------------------
export function saveDoc(doc: PaintDoc, key = DOC_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(doc));
  } catch {
    /* quota / unavailable */
  }
}

export function loadDoc(key = DOC_KEY): PaintDoc | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.shapes &&
      Array.isArray(parsed.order)
    ) {
      // Backward-compat: docs saved before `paper` existed default to light.
      if (typeof parsed.paper !== 'string') parsed.paper = DEFAULT_PAPER;
      return parsed as PaintDoc;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(doc: PaintDoc, filename = 'drawing.svg'): void {
  const blob = new Blob([toSvgString(doc)], { type: 'image/svg+xml' });
  downloadBlob(blob, filename);
}

export async function downloadPng(
  doc: PaintDoc,
  filename = 'drawing.png',
  scale = 2
): Promise<void> {
  const blob = await toPng(doc, scale);
  downloadBlob(blob, filename);
}
