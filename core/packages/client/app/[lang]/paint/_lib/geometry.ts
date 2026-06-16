// Pure geometry: camera transforms, rotation, handles, hit math, resize.
//
// SCENE space = the document's own coordinate system (what shapes store).
// SCREEN space = CSS pixels on the canvas viewport.
//
// The content <svg> renders with a viewBox of
//   `${camera.x} ${camera.y} ${vw/zoom} ${vh/zoom}`
// so scene->screen is: screen = (scene - cameraTopLeft) * zoom.

import type { Bounds, Camera, HandleId, Point } from './types';

const DEG = Math.PI / 180;

export function sceneToScreen(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) * cam.zoom, y: (p.y - cam.y) * cam.zoom };
}

export function screenToScene(p: Point, cam: Camera): Point {
  return { x: cam.x + p.x / cam.zoom, y: cam.y + p.y / cam.zoom };
}

// Fallback: derive scene point from the live SVG's CTM (handles any transform
// drift between the camera model and the actual rendered matrix).
export function screenToSceneViaCTM(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement
): Point | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

export function rotatePoint(p: Point, center: Point, deg: number): Point {
  if (!deg) return { x: p.x, y: p.y };
  const a = deg * DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function boundsCenter(b: Bounds): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

// Four corners of a box AFTER rotation, in scene coords. Order: nw,ne,se,sw.
export function getRotatedCorners(b: Bounds, rotation: number): Point[] {
  const c = boundsCenter(b);
  const corners: Point[] = [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ];
  return rotation ? corners.map((p) => rotatePoint(p, c, rotation)) : corners;
}

// Axis-aligned bounding box of a rotated box.
export function aabbOfRotated(b: Bounds, rotation: number): Bounds {
  const pts = getRotatedCorners(b, rotation);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Union of several boxes (unrotated).
export function unionBounds(list: Bounds[]): Bounds | null {
  if (!list.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of list) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function pointInBounds(p: Point, b: Bounds, tol = 0): boolean {
  return (
    p.x >= b.x - tol &&
    p.x <= b.x + b.width + tol &&
    p.y >= b.y - tol &&
    p.y <= b.y + b.height + tol
  );
}

// Map a scene point into a shape's LOCAL (unrotated) frame: undo the rotation
// around the box center. After this, hit tests can treat the shape as
// axis-aligned.
export function toLocalFrame(p: Point, b: Bounds, rotation: number): Point {
  if (!rotation) return p;
  return rotatePoint(p, boundsCenter(b), -rotation);
}

// Distance from point to segment ab.
export function segDistance(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 ? (wx * vx + wy * vy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = a.x + t * vx;
  const cy = a.y + t * vy;
  return Math.hypot(p.x - cx, p.y - cy);
}

// SAT overlap test: axis-aligned marquee vs a rotated box. Returns true if they
// intersect at all (touching counts).
export function marqueeIntersectsRotated(
  marquee: Bounds,
  b: Bounds,
  rotation: number
): boolean {
  const poly = getRotatedCorners(b, rotation);
  const mPoly: Point[] = [
    { x: marquee.x, y: marquee.y },
    { x: marquee.x + marquee.width, y: marquee.y },
    { x: marquee.x + marquee.width, y: marquee.y + marquee.height },
    { x: marquee.x, y: marquee.y + marquee.height },
  ];
  return polysIntersect(poly, mPoly);
}

// Marquee fully contains the rotated box (for "contain" selection mode).
export function marqueeContainsRotated(
  marquee: Bounds,
  b: Bounds,
  rotation: number
): boolean {
  const poly = getRotatedCorners(b, rotation);
  return poly.every((p) => pointInBounds(p, marquee));
}

function polysIntersect(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const axisX = -(p2.y - p1.y);
      const axisY = p2.x - p1.x;
      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of a) {
        const proj = p.x * axisX + p.y * axisY;
        if (proj < minA) minA = proj;
        if (proj > maxA) maxA = proj;
      }
      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of b) {
        const proj = p.x * axisX + p.y * axisY;
        if (proj < minB) minB = proj;
        if (proj > maxB) maxB = proj;
      }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

// --- Handles -------------------------------------------------------------

// Unit factors for each resize handle along the box (0..1 of width/height).
const HANDLE_FACTORS: Record<
  Exclude<HandleId, 'rotate'>,
  { fx: number; fy: number }
> = {
  nw: { fx: 0, fy: 0 },
  n: { fx: 0.5, fy: 0 },
  ne: { fx: 1, fy: 0 },
  e: { fx: 1, fy: 0.5 },
  se: { fx: 1, fy: 1 },
  s: { fx: 0.5, fy: 1 },
  sw: { fx: 0, fy: 1 },
  w: { fx: 0, fy: 0.5 },
};

const OPPOSITE: Record<Exclude<HandleId, 'rotate'>, Exclude<HandleId, 'rotate'>> =
  {
    nw: 'se',
    n: 's',
    ne: 'sw',
    e: 'w',
    se: 'nw',
    s: 'n',
    sw: 'ne',
    w: 'e',
  };

// Position (scene coords) of a handle given the shape's box + rotation.
// `rotateOffset` (scene units) lifts the rotate handle above the top edge.
export function handlePosition(
  id: HandleId,
  b: Bounds,
  rotation: number,
  rotateOffset = 0
): Point {
  const c = boundsCenter(b);
  let local: Point;
  if (id === 'rotate') {
    local = { x: b.x + b.width / 2, y: b.y - rotateOffset };
  } else {
    const { fx, fy } = HANDLE_FACTORS[id];
    local = { x: b.x + b.width * fx, y: b.y + b.height * fy };
  }
  return rotation ? rotatePoint(local, c, rotation) : local;
}

export function allHandlePositions(
  b: Bounds,
  rotation: number,
  rotateOffset = 0
): Record<HandleId, Point> {
  const out = {} as Record<HandleId, Point>;
  (Object.keys(HANDLE_FACTORS) as Exclude<HandleId, 'rotate'>[]).forEach(
    (id) => {
      out[id] = handlePosition(id, b, rotation, rotateOffset);
    }
  );
  out.rotate = handlePosition('rotate', b, rotation, rotateOffset);
  return out;
}

// The anchor point (scene) that stays fixed during a resize: the opposite
// handle, or the center when `fromCenter`.
export function resizeAnchor(
  id: Exclude<HandleId, 'rotate'>,
  b: Bounds,
  rotation: number,
  fromCenter: boolean
): Point {
  if (fromCenter) return boundsCenter(b);
  return handlePosition(OPPOSITE[id], b, rotation, 0);
}

export interface ResizeOpts {
  shift?: boolean; // keep aspect ratio
  alt?: boolean; // resize from center
}

// Given a drag of `pointer` (current scene pos) on handle `id`, return the new
// UNROTATED Bounds. Rotation-aware: the delta is projected into the box's local
// frame, the box is resized there, then the result is re-derived in scene space
// keeping the anchor fixed.
export function resizeBounds(
  id: Exclude<HandleId, 'rotate'>,
  start: Bounds,
  rotation: number,
  pointer: Point,
  opts: ResizeOpts = {}
): Bounds {
  const center = boundsCenter(start);
  const { fx, fy } = HANDLE_FACTORS[id];
  // sign: which edges this handle moves (-1 = left/top, +1 = right/bottom, 0 = locked axis)
  const sx = fx === 0.5 ? 0 : fx === 0 ? -1 : 1;
  const sy = fy === 0.5 ? 0 : fy === 0 ? -1 : 1;

  // pointer in local (unrotated) frame.
  const localPtr = rotation ? rotatePoint(pointer, center, -rotation) : pointer;

  const left = start.x;
  const top = start.y;
  const right = start.x + start.width;
  const bottom = start.y + start.height;

  let nl = left;
  let nt = top;
  let nr = right;
  let nb = bottom;

  if (opts.alt) {
    // Symmetric about center.
    if (sx !== 0) {
      const half = Math.abs(localPtr.x - center.x);
      nl = center.x - half;
      nr = center.x + half;
    }
    if (sy !== 0) {
      const half = Math.abs(localPtr.y - center.y);
      nt = center.y - half;
      nb = center.y + half;
    }
  } else {
    if (sx < 0) nl = localPtr.x;
    else if (sx > 0) nr = localPtr.x;
    if (sy < 0) nt = localPtr.y;
    else if (sy > 0) nb = localPtr.y;
  }

  let nw = nr - nl;
  let nh = nb - nt;

  // Aspect ratio lock.
  if (opts.shift && sx !== 0 && sy !== 0 && start.width && start.height) {
    const ratio = start.width / start.height;
    const absW = Math.abs(nw);
    const absH = Math.abs(nh);
    if (absW / (start.width || 1) > absH / (start.height || 1)) {
      nh = (nw < 0 ? -1 : 1) * (absW / ratio);
    } else {
      nw = (nh < 0 ? -1 : 1) * (absH * ratio);
    }
    // Re-derive edges from the locked dimension, keeping the anchor side fixed.
    if (opts.alt) {
      nl = center.x - nw / 2;
      nr = center.x + nw / 2;
      nt = center.y - nh / 2;
      nb = center.y + nh / 2;
    } else {
      if (sx < 0) nl = nr - nw;
      else nr = nl + nw;
      if (sy < 0) nt = nb - nh;
      else nb = nt + nh;
    }
  }

  // Normalize flips to positive width/height.
  const fxMin = Math.min(nl, nr);
  const fxMax = Math.max(nl, nr);
  const fyMin = Math.min(nt, nb);
  const fyMax = Math.max(nt, nb);

  let nb2: Bounds = {
    x: fxMin,
    y: fyMin,
    width: fxMax - fxMin,
    height: fyMax - fyMin,
  };

  // For rotated shapes the local-frame box must be repositioned so the SCENE
  // anchor (the opposite corner) stays put. Compute anchor in scene before/after.
  if (rotation && !opts.alt) {
    const anchorLocal: Point = {
      x: sx < 0 ? right : sx > 0 ? left : center.x,
      y: sy < 0 ? bottom : sy > 0 ? top : center.y,
    };
    const anchorScene = rotatePoint(anchorLocal, center, rotation);
    const newCenter = boundsCenter(nb2);
    const anchorLocalNew: Point = {
      x: sx < 0 ? nb2.x + nb2.width : sx > 0 ? nb2.x : newCenter.x,
      y: sy < 0 ? nb2.y + nb2.height : sy > 0 ? nb2.y : newCenter.y,
    };
    const anchorSceneNew = rotatePoint(anchorLocalNew, newCenter, rotation);
    nb2 = {
      ...nb2,
      x: nb2.x + (anchorScene.x - anchorSceneNew.x),
      y: nb2.y + (anchorScene.y - anchorSceneNew.y),
    };
  }

  return nb2;
}

export { OPPOSITE as oppositeHandle, HANDLE_FACTORS };
