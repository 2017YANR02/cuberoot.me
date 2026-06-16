// Convert CubeShorthand glyph primitives (0..100 viewBox) into editable /paint
// shapes. Each parseable move becomes a small cluster of concrete vector shapes
// (LineShape / PathShape / RectShape) laid left-to-right; the whole row is added
// in one undo entry and auto-selected. Pure — no React, no store side effects.

import { glyphPrimitives, type GlyphPrim } from '@/components/CubeShorthand';
import { parseMove, tokenizeAlg } from '@/lib/pll-fingertricks';
import { genId } from './registry';
import type { LineShape, PathShape, RectShape, Shape, TextShape } from './types';

// Concrete canvas colours (shapes need real hex, not CSS vars). Chosen to read
// on both light and dark canvas backgrounds.
const NORMAL = '#111827';
const ACCENT = '#2563eb';

// Flatten an SVG arc into short line segments (only the bracket corners use 'A',
// always small quarter-ish turns at glyph scale). Returns the polyline points
// AFTER the arc, starting from the current point `from` to the arc endpoint.
function arcPoints(
  from: [number, number],
  rx: number,
  ry: number,
  _xrot: number,
  large: number,
  sweep: number,
  end: [number, number],
): [number, number][] {
  // Standard SVG endpoint -> center parameterization (xrot assumed 0; that's all
  // these glyphs use). See W3C SVG implementation notes F.6.
  const [x1, y1] = from;
  const [x2, y2] = end;
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [end];
  const mx = (x1 - x2) / 2;
  const my = (y1 - y2) / 2;
  let rX = Math.abs(rx);
  let rY = Math.abs(ry);
  const lambda = (mx * mx) / (rX * rX) + (my * my) / (rY * rY);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rX *= s;
    rY *= s;
  }
  const sign = large === sweep ? -1 : 1;
  let num = rX * rX * rY * rY - rX * rX * my * my - rY * rY * mx * mx;
  if (num < 0) num = 0;
  const den = rX * rX * my * my + rY * rY * mx * mx;
  const coef = sign * Math.sqrt(num / (den || 1));
  const cxp = (coef * (rX * my)) / rY;
  const cyp = (coef * -(rY * mx)) / rX;
  const cx = cxp + (x1 + x2) / 2;
  const cy = cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = ang(1, 0, (mx - cxp) / rX, (my - cyp) / rY);
  let dtheta = ang((mx - cxp) / rX, (my - cyp) / rY, (-mx - cxp) / rX, (-my - cyp) / rY);
  if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;
  if (sweep && dtheta < 0) dtheta += 2 * Math.PI;
  const steps = Math.max(2, Math.ceil((Math.abs(dtheta) / (Math.PI / 2)) * 4));
  const out: [number, number][] = [];
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dtheta * i) / steps;
    out.push([cx + rX * Math.cos(t), cy + rY * Math.sin(t)]);
  }
  return out;
}

// Flatten a glyph path 'd' (only M / L / A used) into an absolute polyline of
// [x,y] points in the 0..100 box. Open polyline (no auto-close).
function flattenGlyphPath(d: string): [number, number][] {
  const toks = d.match(/[MLA]|-?\d*\.?\d+/g) ?? [];
  const pts: [number, number][] = [];
  let cur: [number, number] = [0, 0];
  let i = 0;
  while (i < toks.length) {
    const cmd = toks[i++];
    if (cmd === 'M' || cmd === 'L') {
      cur = [parseFloat(toks[i++]), parseFloat(toks[i++])];
      pts.push(cur);
    } else if (cmd === 'A') {
      const rx = parseFloat(toks[i++]);
      const ry = parseFloat(toks[i++]);
      const xrot = parseFloat(toks[i++]);
      const large = parseFloat(toks[i++]);
      const sweep = parseFloat(toks[i++]);
      const ex = parseFloat(toks[i++]);
      const ey = parseFloat(toks[i++]);
      for (const p of arcPoints(cur, rx, ry, xrot, large, sweep, [ex, ey])) pts.push(p);
      cur = [ex, ey];
    }
  }
  return pts;
}

function bboxOf(pts: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const COMMON = { rotation: 0, opacity: 1 as const };

// Convert one prim (in box coords) to a concrete editor Shape, mapping box coords
// to scene via (ox + px*k, oy + py*k). `k` = size / 100.
function primToShape(prim: GlyphPrim, ox: number, oy: number, k: number): Shape | null {
  const color = prim.accent ? ACCENT : NORMAL;
  const X = (v: number) => ox + v * k;
  const Y = (v: number) => oy + v * k;

  if (prim.kind === 'line') {
    const ax = X(prim.x1);
    const ay = Y(prim.y1);
    const bx = X(prim.x2);
    const by = Y(prim.y2);
    const x = Math.min(ax, bx);
    const y = Math.min(ay, by);
    const w = Math.abs(ax - bx);
    const h = Math.abs(ay - by);
    // unflipped diagonal goes (x,y)->(x+w,y+h); flipped goes (x,y+h)->(x+w,y).
    const flipped = ax < bx !== ay < by;
    const shape: LineShape = {
      id: genId('line'),
      type: 'line',
      x,
      y,
      width: w,
      height: h,
      ...COMMON,
      fill: 'none',
      stroke: color,
      strokeWidth: Math.max(0.5, prim.w * k),
      strokeLinecap: 'round',
      flipped,
    };
    return shape;
  }

  if (prim.kind === 'polygon') {
    const scenePts = prim.points.map(([px, py]) => [X(px), Y(py)] as [number, number]);
    const bb = bboxOf(scenePts);
    const d =
      scenePts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${(px - bb.x).toFixed(2)} ${(py - bb.y).toFixed(2)}`).join(' ') + ' Z';
    const shape: PathShape = {
      id: genId('path'),
      type: 'path',
      x: bb.x,
      y: bb.y,
      width: Math.max(bb.width, 0.01),
      height: Math.max(bb.height, 0.01),
      ...COMMON,
      fill: prim.fillable ? color : 'none',
      stroke: prim.fillable ? 'none' : color,
      strokeWidth: prim.fillable ? 0 : Math.max(0.5, k),
      strokeLinejoin: 'round',
      d,
      closed: true,
    };
    return shape;
  }

  if (prim.kind === 'path') {
    const boxPts = flattenGlyphPath(prim.d);
    if (boxPts.length < 2) return null;
    const scenePts = boxPts.map(([px, py]) => [X(px), Y(py)] as [number, number]);
    const bb = bboxOf(scenePts);
    const d = scenePts
      .map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${(px - bb.x).toFixed(2)} ${(py - bb.y).toFixed(2)}`)
      .join(' ');
    const shape: PathShape = {
      id: genId('path'),
      type: 'path',
      x: bb.x,
      y: bb.y,
      width: Math.max(bb.width, 0.01),
      height: Math.max(bb.height, 0.01),
      ...COMMON,
      fill: 'none',
      stroke: color,
      strokeWidth: Math.max(0.5, prim.sw * k),
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d,
      closed: false,
    };
    return shape;
  }

  // rect
  const shape: RectShape = {
    id: genId('rect'),
    type: 'rect',
    x: X(prim.x),
    y: Y(prim.y),
    width: prim.w * k,
    height: prim.h * k,
    ...COMMON,
    fill: prim.fillable ? color : 'none',
    stroke: color,
    strokeWidth: Math.max(0.5, prim.sw * k),
    rx: prim.rx * k,
  };
  return shape;
}

export interface ShorthandConvertOpts {
  size: number; // glyph square size in scene px (e.g. 48 / 72 / 100)
  originX: number; // scene x of the first glyph's box top-left
  originY: number;
  labels: boolean; // add a TextShape token under each glyph
}

export interface ShorthandConvertResult {
  shapes: Shape[];
  badTokens: string[]; // unparseable / wide moves we skipped
  glyphCount: number; // number of glyph columns actually placed
}

// Tokenize + parse an alg and produce all shapes for a horizontal glyph strip.
export function shorthandToShapes(alg: string, opts: ShorthandConvertOpts): ShorthandConvertResult {
  const { size, originX, originY, labels } = opts;
  const gap = size * 0.18; // mirror the standalone download layout
  const step = size + gap;
  const k = size / 100;
  const shapes: Shape[] = [];
  const badTokens: string[] = [];
  let col = 0;

  tokenizeAlg(alg || '').forEach((tok) => {
    const p = parseMove(tok);
    if (!p || p.wide) {
      badTokens.push(tok);
      return;
    }
    const prims = glyphPrimitives(p);
    if (!prims.length) {
      badTokens.push(tok);
      return;
    }
    const ox = originX + col * step;
    col += 1;
    for (const prim of prims) {
      const s = primToShape(prim, ox, originY, k);
      if (s) shapes.push(s);
    }
    if (labels) {
      const label: TextShape = {
        id: genId('text'),
        type: 'text',
        x: ox,
        y: originY + size + size * 0.06,
        width: size,
        height: size * 0.22,
        ...COMMON,
        fill: NORMAL,
        stroke: 'none',
        strokeWidth: 0,
        text: tok,
        fontSize: Math.max(10, size * 0.2),
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        textAlign: 'center',
      };
      shapes.push(label);
    }
  });

  return { shapes, badTokens, glyphCount: col };
}
