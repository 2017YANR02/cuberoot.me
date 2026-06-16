// Per-shape behavior registry. The Canvas wraps each shape's render() in a
// <g transform="rotate(rot, cx, cy)"> using SCENE coords, so render() emits the
// inner SVG element(s) directly in scene space (origin already correct — it uses
// shape.x/shape.y absolute scene coords, NOT a translated local origin).
//
// hitTest receives the pointer in the shape's LOCAL (de-rotated) scene frame and
// a tolerance already expressed in scene units (caller scaled it by 1/zoom).

import type { ReactNode } from 'react';
import type {
  Bounds,
  EllipseShape,
  FreehandShape,
  LineShape,
  PathShape,
  Point,
  PolygonShape,
  RectShape,
  Shape,
  ShapeType,
  StarShape,
  TextShape,
} from './types';
import { pointInBounds, segDistance } from './geometry';

export interface ShapeUtil<S extends Shape = Shape> {
  type: ShapeType;
  defaults(): Partial<S>;
  create(bounds: Bounds, opts?: { rx?: number }): S;
  render(shape: S): ReactNode;
  getBounds(shape: S): Bounds;
  hitTest(shape: S, ptLocalScene: Point, tolerance: number): boolean;
  resize?(shape: S, b: Bounds): Partial<S>;
}

let idCounter = 0;
export function setIdSeed(n: number): void {
  if (n > idCounter) idCounter = n;
}
function genId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
    }
  } catch {
    /* fall through */
  }
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

const COMMON_DEFAULTS = {
  rotation: 0,
  fill: '#cbd5e1',
  stroke: '#1e293b',
  strokeWidth: 2,
  opacity: 1,
};

function baseFrom(bounds: Bounds, type: ShapeType, prefix: string) {
  return {
    id: genId(prefix),
    type,
    x: bounds.x,
    y: bounds.y,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height),
    ...COMMON_DEFAULTS,
  };
}

function strokeProps(s: Shape) {
  return {
    fill: s.fill === 'none' ? 'none' : s.fill,
    stroke: s.stroke === 'none' ? 'none' : s.stroke,
    strokeWidth: s.strokeWidth,
    strokeDasharray: s.strokeDash && s.strokeDash.length ? s.strokeDash.join(' ') : undefined,
    strokeLinecap: s.strokeLinecap,
    strokeLinejoin: s.strokeLinejoin,
    opacity: s.opacity,
  };
}

// --- rect ---------------------------------------------------------------
const rectUtil: ShapeUtil<RectShape> = {
  type: 'rect',
  defaults: () => ({ ...COMMON_DEFAULTS, rx: 0 }) as Partial<RectShape>,
  create: (b, opts) =>
    ({
      ...baseFrom(b, 'rect', 'rect'),
      rx: opts?.rx ?? 0,
    }) as RectShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => (
    <rect
      x={s.x}
      y={s.y}
      width={s.width}
      height={s.height}
      rx={s.rx || undefined}
      ry={s.rx || undefined}
      {...strokeProps(s)}
    />
  ),
  hitTest: (s, p, tol) => {
    const b = { x: s.x, y: s.y, width: s.width, height: s.height };
    if (s.fill !== 'none') return pointInBounds(p, b, tol);
    // stroke-only: near any edge.
    const onX =
      (Math.abs(p.x - b.x) <= tol || Math.abs(p.x - (b.x + b.width)) <= tol) &&
      p.y >= b.y - tol &&
      p.y <= b.y + b.height + tol;
    const onY =
      (Math.abs(p.y - b.y) <= tol || Math.abs(p.y - (b.y + b.height)) <= tol) &&
      p.x >= b.x - tol &&
      p.x <= b.x + b.width + tol;
    return onX || onY;
  },
  resize: (_s, b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
};

// --- ellipse ------------------------------------------------------------
const ellipseUtil: ShapeUtil<EllipseShape> = {
  type: 'ellipse',
  defaults: () => ({ ...COMMON_DEFAULTS }) as Partial<EllipseShape>,
  create: (b) => baseFrom(b, 'ellipse', 'ell') as EllipseShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => (
    <ellipse
      cx={s.x + s.width / 2}
      cy={s.y + s.height / 2}
      rx={s.width / 2}
      ry={s.height / 2}
      {...strokeProps(s)}
    />
  ),
  hitTest: (s, p, tol) => {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const rx = s.width / 2;
    const ry = s.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const nx = (p.x - cx) / rx;
    const ny = (p.y - cy) / ry;
    const d = nx * nx + ny * ny;
    if (s.fill !== 'none') {
      // tolerance band on the outside.
      const outer = (1 + tol / Math.min(rx, ry)) ** 2;
      return d <= outer;
    }
    const tolN = tol / Math.min(rx, ry);
    return Math.abs(Math.sqrt(d) - 1) <= tolN;
  },
  resize: (_s, b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
};

// --- line ---------------------------------------------------------------
function lineEndpoints(s: LineShape): [Point, Point] {
  if (s.flipped) {
    return [
      { x: s.x, y: s.y + s.height },
      { x: s.x + s.width, y: s.y },
    ];
  }
  return [
    { x: s.x, y: s.y },
    { x: s.x + s.width, y: s.y + s.height },
  ];
}

const lineUtil: ShapeUtil<LineShape> = {
  type: 'line',
  defaults: () =>
    ({
      ...COMMON_DEFAULTS,
      fill: 'none',
      strokeLinecap: 'round',
    }) as Partial<LineShape>,
  create: (b) =>
    ({
      ...baseFrom(b, 'line', 'line'),
      fill: 'none',
      strokeLinecap: 'round',
      flipped: (b.width < 0) !== (b.height < 0),
    }) as LineShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => {
    const [a, b] = lineEndpoints(s);
    return (
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        {...strokeProps(s)}
        fill="none"
      />
    );
  },
  hitTest: (s, p, tol) => {
    const [a, b] = lineEndpoints(s);
    return segDistance(p, a, b) <= tol + s.strokeWidth / 2;
  },
  resize: (_s, b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
};

// --- polygon / star -----------------------------------------------------
// Vertices are inscribed in the shape's bbox ellipse: angle 0 = top (-90deg),
// then evenly spaced clockwise. Outer radius = (width/2, height/2).
function polygonVerts(s: PolygonShape): Point[] {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const rx = s.width / 2;
  const ry = s.height / 2;
  const n = Math.max(3, Math.round(s.sides));
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return pts;
}

function starVerts(s: StarShape): Point[] {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const rx = s.width / 2;
  const ry = s.height / 2;
  const n = Math.max(3, Math.round(s.points));
  const inner = Math.min(1, Math.max(0, s.innerRatio));
  const pts: Point[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const f = i % 2 === 0 ? 1 : inner;
    pts.push({ x: cx + rx * f * Math.cos(a), y: cy + ry * f * Math.sin(a) });
  }
  return pts;
}

function pointsAttr(pts: Point[]): string {
  return pts.map((p) => `${round2(p.x)},${round2(p.y)}`).join(' ');
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Rounded-corner closed path through `pts` with corner radius `r` (scene units),
// clamped to half the shorter adjacent edge per corner.
function roundedPolyPath(pts: Point[], r: number): string {
  const n = pts.length;
  if (n < 3 || r <= 0) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const v1x = prev.x - cur.x;
    const v1y = prev.y - cur.y;
    const v2x = next.x - cur.x;
    const v2y = next.y - cur.y;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = { x: cur.x + (v1x / l1) * rr, y: cur.y + (v1y / l1) * rr };
    const p2 = { x: cur.x + (v2x / l2) * rr, y: cur.y + (v2y / l2) * rr };
    d += i === 0 ? `M ${round2(p1.x)} ${round2(p1.y)} ` : `L ${round2(p1.x)} ${round2(p1.y)} `;
    d += `Q ${round2(cur.x)} ${round2(cur.y)} ${round2(p2.x)} ${round2(p2.y)} `;
  }
  return `${d}Z`;
}

function pointInPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function nearPolyEdge(p: Point, poly: Point[], tol: number): boolean {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segDistance(p, poly[j], poly[i]) <= tol) return true;
  }
  return false;
}

const polygonUtil: ShapeUtil<PolygonShape> = {
  type: 'polygon',
  defaults: () => ({ ...COMMON_DEFAULTS, sides: 5, rx: 0 }) as Partial<PolygonShape>,
  create: (b, opts) =>
    ({
      ...baseFrom(b, 'polygon', 'poly'),
      sides: 5,
      rx: opts?.rx ?? 0,
    }) as PolygonShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => {
    const pts = polygonVerts(s);
    if (s.rx && s.rx > 0) {
      return <path d={roundedPolyPath(pts, s.rx)} {...strokeProps(s)} />;
    }
    return <polygon points={pointsAttr(pts)} {...strokeProps(s)} />;
  },
  hitTest: (s, p, tol) => {
    const poly = polygonVerts(s);
    if (s.fill !== 'none' && pointInPoly(p, poly)) return true;
    return nearPolyEdge(p, poly, tol + s.strokeWidth / 2);
  },
  resize: (_s, b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
};

const starUtil: ShapeUtil<StarShape> = {
  type: 'star',
  defaults: () =>
    ({ ...COMMON_DEFAULTS, points: 5, innerRatio: 0.5, rx: 0 }) as Partial<StarShape>,
  create: (b, opts) =>
    ({
      ...baseFrom(b, 'star', 'star'),
      points: 5,
      innerRatio: 0.5,
      rx: opts?.rx ?? 0,
    }) as StarShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => {
    const pts = starVerts(s);
    if (s.rx && s.rx > 0) {
      return <path d={roundedPolyPath(pts, s.rx)} {...strokeProps(s)} />;
    }
    return <polygon points={pointsAttr(pts)} {...strokeProps(s)} />;
  },
  hitTest: (s, p, tol) => {
    const poly = starVerts(s);
    if (s.fill !== 'none' && pointInPoly(p, poly)) return true;
    return nearPolyEdge(p, poly, tol + s.strokeWidth / 2);
  },
  resize: (_s, b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
};

// --- freehand -----------------------------------------------------------
// pts are stored RELATIVE to shape.x/shape.y (local origin = bbox top-left).
// The smoothed 'd' is rebuilt from pts on every render so resizing (which
// scales pts) stays exact. Quadratic-midpoint smoothing — no external dep.

// Ramer-Douglas-Peucker simplification (eps in the same units as the pts).
export function rdpSimplify(pts: Point[], eps: number): Point[] {
  if (pts.length <= 2) return pts.slice();
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDistance(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

// Smooth a polyline into a path 'd' using quadratic Béziers through midpoints
// (each original point becomes a control point; the curve passes through edge
// midpoints). Open path (a drawn stroke), no Z.
export function smoothPath(pts: Array<[number, number]> | Point[]): string {
  const p: Point[] = pts.map((q) =>
    Array.isArray(q) ? { x: q[0], y: q[1] } : q
  );
  const n = p.length;
  if (n === 0) return '';
  if (n === 1) return `M ${round2(p[0].x)} ${round2(p[0].y)}`;
  if (n === 2)
    return `M ${round2(p[0].x)} ${round2(p[0].y)} L ${round2(p[1].x)} ${round2(p[1].y)}`;
  let d = `M ${round2(p[0].x)} ${round2(p[0].y)} `;
  for (let i = 1; i < n - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    d += `Q ${round2(p[i].x)} ${round2(p[i].y)} ${round2(mx)} ${round2(my)} `;
  }
  d += `L ${round2(p[n - 1].x)} ${round2(p[n - 1].y)}`;
  return d;
}

function freehandBBox(pts: Array<[number, number]>): Bounds {
  if (!pts.length) return { x: 0, y: 0, width: 0, height: 0 };
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

// Build a FreehandShape from absolute scene points (raw drag capture).
export function makeFreehand(
  scenePts: Array<[number, number]>,
  eps = 1.5
): FreehandShape | null {
  if (scenePts.length < 2) return null;
  const simplified = rdpSimplify(
    scenePts.map(([x, y]) => ({ x, y })),
    eps
  ).map((p) => [p.x, p.y] as [number, number]);
  const bb = freehandBBox(simplified);
  const local = simplified.map(
    ([x, y]) => [x - bb.x, y - bb.y] as [number, number]
  );
  return {
    id: genId('free'),
    type: 'freehand',
    x: bb.x,
    y: bb.y,
    width: Math.max(bb.width, 0),
    height: Math.max(bb.height, 0),
    pts: local,
    ...COMMON_DEFAULTS,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

function freehandScenePts(s: FreehandShape): Point[] {
  return s.pts.map(([x, y]) => ({ x: s.x + x, y: s.y + y }));
}

const freehandUtil: ShapeUtil<FreehandShape> = {
  type: 'freehand',
  defaults: () =>
    ({
      ...COMMON_DEFAULTS,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }) as Partial<FreehandShape>,
  create: (b) =>
    ({
      ...baseFrom(b, 'freehand', 'free'),
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      pts: [
        [0, 0],
        [b.width, b.height],
      ],
    }) as FreehandShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => (
    <path d={smoothPath(freehandScenePts(s))} {...strokeProps(s)} fill="none" />
  ),
  hitTest: (s, p, tol) => {
    const pts = freehandScenePts(s);
    const t = tol + s.strokeWidth / 2;
    for (let i = 1; i < pts.length; i++) {
      if (segDistance(p, pts[i - 1], pts[i]) <= t) return true;
    }
    return false;
  },
  // Scale the local pts to fit the new bbox (preserves the curve under resize).
  resize: (s, b) => {
    const ow = s.width || 1;
    const oh = s.height || 1;
    const sx = b.width / ow;
    const sy = b.height / oh;
    const pts = s.pts.map(
      ([x, y]) => [x * sx, y * sy] as [number, number]
    );
    return { x: b.x, y: b.y, width: Math.abs(b.width), height: Math.abs(b.height), pts };
  },
};

// --- path (pen tool) ----------------------------------------------------
// PathShape.d is stored in LOCAL coords (relative to shape.x/shape.y) so move /
// resize stay exact; render translates it back to scene. Only M/L/C/Z commands
// are produced by the pen, so the token helpers below only need to handle those.

// A pen anchor: the on-curve point plus optional symmetric bezier handles.
// `hOut`/`hIn` are ABSOLUTE points (same space as `pt`); a corner has neither.
export interface PenAnchor {
  pt: [number, number];
  hOut?: [number, number] | null;
  hIn?: [number, number] | null;
}

// Build a path 'd' (cubic beziers for smooth anchors, lines for corners) from a
// list of anchors. `closed` appends a final segment back to the first + Z.
export function buildPenD(anchors: PenAnchor[], closed: boolean): string {
  const n = anchors.length;
  if (n === 0) return '';
  const a0 = anchors[0];
  let d = `M ${round2(a0.pt[0])} ${round2(a0.pt[1])}`;
  const seg = (from: PenAnchor, to: PenAnchor) => {
    const c1 = from.hOut ?? from.pt;
    const c2 = to.hIn ?? to.pt;
    if (from.hOut || to.hIn) {
      return ` C ${round2(c1[0])} ${round2(c1[1])} ${round2(c2[0])} ${round2(c2[1])} ${round2(to.pt[0])} ${round2(to.pt[1])}`;
    }
    return ` L ${round2(to.pt[0])} ${round2(to.pt[1])}`;
  };
  for (let i = 1; i < n; i++) d += seg(anchors[i - 1], anchors[i]);
  if (closed && n >= 2) {
    d += seg(anchors[n - 1], a0);
    d += ' Z';
  }
  return d;
}

// Parse the numeric operands of M/L/C/Z tokens (the only commands we emit).
type PathTok = { cmd: string; nums: number[] };
function parsePathD(d: string): PathTok[] {
  const out: PathTok[] = [];
  const re = /([MLCZmlcz])([^MLCZmlcz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const nums = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    out.push({ cmd, nums });
  }
  return out;
}

function mapPathPoints(d: string, fn: (x: number, y: number) => [number, number]): string {
  return parsePathD(d)
    .map(({ cmd, nums }) => {
      if (cmd.toLowerCase() === 'z') return 'Z';
      const parts: string[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const [nx, ny] = fn(nums[i], nums[i + 1]);
        parts.push(`${round2(nx)} ${round2(ny)}`);
      }
      return `${cmd} ${parts.join(' ')}`;
    })
    .join(' ')
    .trim();
}

export function translatePathD(d: string, dx: number, dy: number): string {
  return mapPathPoints(d, (x, y) => [x + dx, y + dy]);
}
export function scalePathD(d: string, sx: number, sy: number): string {
  return mapPathPoints(d, (x, y) => [x * sx, y * sy]);
}

// Numeric bbox from all control + on-curve points (a tight-enough box for cubic
// paths whose handles never reach far past the anchors in normal pen drawing).
export function pathBBox(d: string): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { cmd, nums } of parsePathD(d)) {
    if (cmd.toLowerCase() === 'z') continue;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i];
      const y = nums[i + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Build a finished PathShape from pen anchors in SCENE coords. Relativizes the
// 'd' to the bbox top-left (local origin) like freehand. Returns null if < 2 pts.
export function makePath(anchors: PenAnchor[], closed: boolean): PathShape | null {
  if (anchors.length < 2) return null;
  const sceneD = buildPenD(anchors, closed);
  const bb = pathBBox(sceneD);
  const localD = translatePathD(sceneD, -bb.x, -bb.y);
  return {
    id: genId('path'),
    type: 'path',
    x: bb.x,
    y: bb.y,
    width: Math.max(bb.width, 0),
    height: Math.max(bb.height, 0),
    d: localD,
    closed,
    ...COMMON_DEFAULTS,
    fill: closed ? COMMON_DEFAULTS.fill : 'none',
    strokeLinejoin: 'round',
  };
}

// Sample points along the path for stroke hit-testing (flattens cubics coarsely).
function pathSamplePoints(d: string, x: number, y: number): Point[] {
  const pts: Point[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const cubic = (
    p0: Point,
    c1: Point,
    c2: Point,
    p1: Point
  ) => {
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      pts.push({
        x:
          mt * mt * mt * p0.x +
          3 * mt * mt * t * c1.x +
          3 * mt * t * t * c2.x +
          t * t * t * p1.x,
        y:
          mt * mt * mt * p0.y +
          3 * mt * mt * t * c1.y +
          3 * mt * t * t * c2.y +
          t * t * t * p1.y,
      });
    }
  };
  for (const { cmd, nums } of parsePathD(d)) {
    const c = cmd.toUpperCase();
    if (c === 'M') {
      cx = x + nums[0];
      cy = y + nums[1];
      startX = cx;
      startY = cy;
      pts.push({ x: cx, y: cy });
    } else if (c === 'L') {
      cx = x + nums[0];
      cy = y + nums[1];
      pts.push({ x: cx, y: cy });
    } else if (c === 'C') {
      const p0 = { x: cx, y: cy };
      cubic(
        p0,
        { x: x + nums[0], y: y + nums[1] },
        { x: x + nums[2], y: y + nums[3] },
        { x: x + nums[4], y: y + nums[5] }
      );
      cx = x + nums[4];
      cy = y + nums[5];
    } else if (c === 'Z') {
      pts.push({ x: startX, y: startY });
      cx = startX;
      cy = startY;
    }
  }
  return pts;
}

const pathUtil: ShapeUtil<PathShape> = {
  type: 'path',
  defaults: () =>
    ({ ...COMMON_DEFAULTS, strokeLinejoin: 'round' }) as Partial<PathShape>,
  create: (b) =>
    ({
      ...baseFrom(b, 'path', 'path'),
      strokeLinejoin: 'round',
      d: `M 0 0 L ${round2(b.width)} ${round2(b.height)}`,
      closed: false,
      fill: 'none',
    }) as PathShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => {
    const sp = strokeProps(s);
    return (
      <path
        d={translatePathD(s.d, s.x, s.y)}
        {...sp}
        fill={s.closed && s.fill !== 'none' ? s.fill : 'none'}
      />
    );
  },
  hitTest: (s, p, tol) => {
    const pts = pathSamplePoints(s.d, s.x, s.y);
    if (s.closed && s.fill !== 'none' && pts.length >= 3 && pointInPoly(p, pts)) {
      return true;
    }
    const t = tol + s.strokeWidth / 2;
    for (let i = 1; i < pts.length; i++) {
      if (segDistance(p, pts[i - 1], pts[i]) <= t) return true;
    }
    return false;
  },
  resize: (s, b) => {
    const ow = s.width || 1;
    const oh = s.height || 1;
    const sx = b.width / ow;
    const sy = b.height / oh;
    return {
      x: b.x,
      y: b.y,
      width: Math.abs(b.width),
      height: Math.abs(b.height),
      d: scalePathD(s.d, sx, sy),
    };
  },
};

// --- text ---------------------------------------------------------------
// A point-text shape. shape.x/shape.y is the box top-left; lines are split on
// '\n'. Width/height are kept in sync with the measured text so the selection
// box wraps it. fill = the text color (stroke optional outline).

export const TEXT_DEFAULTS = {
  text: '',
  fontSize: 28,
  fontFamily: 'var(--font-sans)',
  fontWeight: 400,
  textAlign: 'left' as const,
};
const TEXT_LINE_HEIGHT = 1.25;

let measureCanvas: HTMLCanvasElement | null = null;
function measureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

// Resolve a `var(--x)` font-family to a concrete stack the canvas can use; pass
// through plain stacks unchanged.
function resolveFontFamily(family: string): string {
  const m = family.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (!m || typeof document === 'undefined') return family;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || 'sans-serif';
}

function textLines(s: TextShape): string[] {
  return s.text.length ? s.text.split('\n') : [''];
}

// Measure the box width/height (scene units) for the given text + font. Falls
// back to a glyph-ratio estimate when no canvas is available (SSR).
export function measureTextBox(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number
): { width: number; height: number } {
  const lines = text.length ? text.split('\n') : [''];
  const lineH = fontSize * TEXT_LINE_HEIGHT;
  const height = Math.max(lineH, lines.length * lineH);
  const ctx = measureCtx();
  let width = 0;
  if (ctx) {
    ctx.font = `${fontWeight} ${fontSize}px ${resolveFontFamily(fontFamily)}`;
    for (const ln of lines) width = Math.max(width, ctx.measureText(ln || ' ').width);
  } else {
    for (const ln of lines) width = Math.max(width, (ln.length || 1) * fontSize * 0.55);
  }
  return { width: Math.max(width, fontSize * 0.4), height };
}

// Recompute width/height for a text shape after its text/font changed.
export function remeasureText(s: TextShape): { width: number; height: number } {
  return measureTextBox(s.text, s.fontSize, s.fontFamily, s.fontWeight);
}

const textUtil: ShapeUtil<TextShape> = {
  type: 'text',
  defaults: () =>
    ({ ...COMMON_DEFAULTS, fill: '#171717', stroke: 'none', strokeWidth: 0, ...TEXT_DEFAULTS }) as Partial<TextShape>,
  create: (b) =>
    ({
      ...baseFrom(b, 'text', 'text'),
      fill: '#171717',
      stroke: 'none',
      strokeWidth: 0,
      ...TEXT_DEFAULTS,
      width: Math.max(b.width, TEXT_DEFAULTS.fontSize * 0.4),
      height: Math.max(b.height, TEXT_DEFAULTS.fontSize * TEXT_LINE_HEIGHT),
    }) as TextShape,
  getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
  render: (s) => {
    const lines = textLines(s);
    const lineH = s.fontSize * TEXT_LINE_HEIGHT;
    const anchor =
      s.textAlign === 'center' ? 'middle' : s.textAlign === 'right' ? 'end' : 'start';
    const tx =
      s.textAlign === 'center'
        ? s.x + s.width / 2
        : s.textAlign === 'right'
          ? s.x + s.width
          : s.x;
    // baseline of the first line sits ~0.8*fontSize below the box top.
    const baseY = s.y + s.fontSize * 0.82;
    return (
      <text
        x={tx}
        y={baseY}
        textAnchor={anchor}
        fill={s.fill === 'none' ? 'none' : s.fill}
        stroke={s.stroke === 'none' ? 'none' : s.stroke}
        strokeWidth={s.stroke === 'none' ? undefined : s.strokeWidth}
        opacity={s.opacity}
        style={{
          // font props go in style so CSS var() families (var(--font-sans)) resolve.
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          whiteSpace: 'pre',
        }}
      >
        {lines.length === 1 ? (
          lines[0]
        ) : (
          lines.map((ln, i) => (
            <tspan key={i} x={tx} dy={i === 0 ? 0 : lineH}>
              {ln === '' ? ' ' : ln}
            </tspan>
          ))
        )}
      </text>
    );
  },
  hitTest: (s, p, tol) =>
    pointInBounds(p, { x: s.x, y: s.y, width: s.width, height: s.height }, tol),
  // Vertical resize scales fontSize (keeps the text proportional); width follows.
  resize: (s, b) => {
    const oh = s.height || 1;
    const sy = Math.abs(b.height) / oh;
    const fontSize = Math.max(4, s.fontSize * sy);
    const m = measureTextBox(s.text, fontSize, s.fontFamily, s.fontWeight);
    return { x: b.x, y: b.y, width: m.width, height: m.height, fontSize };
  },
};

// --- placeholders (Phase 2 fills geometry) ------------------------------
// Minimal but non-crashing: render a faint bbox rect; box-based hit test.
function placeholder(type: ShapeType, prefix: string): ShapeUtil {
  return {
    type,
    defaults: () => ({ ...COMMON_DEFAULTS }),
    create: (b) => baseFrom(b, type, prefix) as Shape,
    getBounds: (s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
    render: (s) => (
      <rect
        x={s.x}
        y={s.y}
        width={s.width}
        height={s.height}
        {...strokeProps(s)}
      />
    ),
    hitTest: (s, p, tol) =>
      pointInBounds(p, { x: s.x, y: s.y, width: s.width, height: s.height }, tol),
    resize: (_s, b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
  };
}

export const SHAPE_UTILS: Record<ShapeType, ShapeUtil> = {
  rect: rectUtil as ShapeUtil,
  ellipse: ellipseUtil as ShapeUtil,
  line: lineUtil as ShapeUtil,
  polygon: polygonUtil as ShapeUtil,
  star: starUtil as ShapeUtil,
  path: pathUtil as ShapeUtil,
  text: textUtil as ShapeUtil,
  freehand: freehandUtil as ShapeUtil,
  group: placeholder('group', 'grp'),
};

export function registerShape(util: ShapeUtil): void {
  SHAPE_UTILS[util.type] = util;
}

export function getUtil(type: ShapeType): ShapeUtil {
  return SHAPE_UTILS[type];
}

export function getShapeBounds(s: Shape): Bounds {
  return SHAPE_UTILS[s.type].getBounds(s);
}

export { genId };
