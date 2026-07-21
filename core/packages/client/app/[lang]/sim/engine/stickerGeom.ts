/**
 * Shared low-level geometry for /sim cube-puzzle STICKERS — the smooth, thick, grooved
 * colored tiles that sit on a CSG (or solid) body. Every cube-faced puzzle (Ivy, Rex,
 * and future ones) builds a per-face 2D region tiling out of TRUE circular arcs here,
 * then extrudes each region onto its 3D face. Keeping the arc primitives + the
 * face-placement op in one place means a new puzzle only writes its own tiling topology,
 * not the plumbing. (Pure three.js — no CSG dependency; see csgCut.ts for the bodies.)
 */
import * as THREE from 'three';

export type V2 = [number, number];

const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V2, s: number): V2 => [a[0] * s, a[1] * s];
const hyp = (a: V2): number => Math.hypot(a[0], a[1]);
const unit = (a: V2): V2 => { const l = hyp(a) || 1; return [a[0] / l, a[1] / l]; };

// ── 2D analytic-tiling primitives ────────────────────────────────────────────────
/** Sample the MINOR arc of circle(center, |from-center|) from `from` to `to`
 *  (inclusive of `from`, exclusive of `to`), `seg` segments. */
export function arcPts(center: V2, from: V2, to: V2, seg: number): V2[] {
  const r = hyp(sub(from, center));
  const a1 = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const a2 = Math.atan2(to[1] - center[1], to[0] - center[0]);
  let da = a2 - a1;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const out: V2[] = [];
  for (let i = 0; i < seg; i++) {
    const t = a1 + da * (i / seg);
    out.push([center[0] + r * Math.cos(t), center[1] + r * Math.sin(t)]);
  }
  return out;
}

/** The two intersection points of circle(C0,r0) & circle(C1,r1). */
export function circleIntersect(C0: V2, r0: number, C1: V2, r1: number): [V2, V2] {
  const dx = C1[0] - C0[0], dy = C1[1] - C0[1], d = Math.hypot(dx, dy);
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const xm = C0[0] + (a * dx) / d, ym = C0[1] + (a * dy) / d;
  return [[xm + (h * dy) / d, ym - (h * dx) / d], [xm - (h * dy) / d, ym + (h * dx) / d]];
}

/** Signed area ×2 of a closed polygon; > 0 ⇒ CCW. */
export function polyArea2(pts: V2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a;
}

/** Offset a convex CCW polygon inward by `w` along each vertex's miter bisector
 *  (interior is on the LEFT of each directed edge) — concentric for arc runs, parallel
 *  for straight runs: an even-width groove, NOT a centroid/box scale (keeps true arcs). */
export function offsetInward(pts: V2[], w: number): V2[] {
  const n = pts.length;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    const d1 = unit(sub(p, prev));   // incoming edge dir
    const d2 = unit(sub(next, p));   // outgoing edge dir
    const nL1: V2 = [-d1[1], d1[0]]; // left normal (→ interior) of incoming
    const nL2: V2 = [-d2[1], d2[0]];
    const bis = unit(add(nL1, nL2));
    const cos = Math.max(0.5, bis[0] * nL1[0] + bis[1] * nL1[1]); // miter clamp → ≤ 2w
    out.push(add(p, mul(bis, w / cos)));
  }
  return out;
}

/** Round the SHARP corners of a closed CCW outline with quadratic-Bézier fillets (the
 *  skill's `quadraticCurveTo` rounding, generalized to a SAMPLED outline): any vertex
 *  whose turn angle exceeds `thresholdDeg` is replaced by a fillet set back `setback`
 *  (in the outline's units) along each adjacent edge; already-smooth arc runs (tiny
 *  per-vertex turn) pass through untouched. Run this BEFORE offsetInward so the groove
 *  never miters a needle into a spike (skill pitfall #12). */
export function roundCorners(pts: V2[], setback: number, thresholdDeg = 26, samples = 16): V2[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const turn = (i: number): number => {
    const v1 = unit(sub(pts[i], pts[(i - 1 + n) % n]));
    const v2 = unit(sub(pts[(i + 1) % n], pts[i]));
    return Math.acos(Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1])));
  };
  const thr = (thresholdDeg * Math.PI) / 180;
  const sharp = pts.map((_, i) => turn(i) > thr);
  if (!sharp.some(Boolean)) return pts.slice();
  // The point ON the curve at arc length `setback` from vertex i, walking dir ±1 — used
  // as the fillet's tangent endpoint. Walking the polyline (not extrapolating one
  // segment's tangent) keeps the endpoint on the curve, so a short arc can't overshoot
  // into a reversal; `dropped` marks the originals the fillet replaces.
  const dropped = new Array(n).fill(false);
  const cutPoint = (i: number, dir: 1 | -1): V2 => {
    let acc = 0, j = i;
    for (let step = 0; step < n; step++) {
      const k = (j + dir + n) % n;
      const seg = hyp(sub(pts[k], pts[j])) || 1e-9;
      if (acc + seg >= setback) {
        const t = (setback - acc) / seg;
        return [pts[j][0] + (pts[k][0] - pts[j][0]) * t, pts[j][1] + (pts[k][1] - pts[j][1]) * t];
      }
      acc += seg; j = k; if (!sharp[k]) dropped[k] = true;
    }
    return pts[i];
  };
  const bez = (p0: V2, p1: V2, p2: V2, t: number): V2 => {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  };
  // resolve both cut points (filling `dropped`) before emitting, so the drop set is complete.
  const cuts = pts.map((_, i) => (sharp[i] ? { in: cutPoint(i, -1), out: cutPoint(i, 1) } : null));
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const c = cuts[i];
    if (c) for (let s = 0; s <= samples; s++) out.push(bez(c.in, pts[i], c.out, s / samples));
    else if (!dropped[i]) out.push(pts[i]);
  }
  return out;
}

// ── cube-face placement ──────────────────────────────────────────────────────────
export interface FaceBasis { u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; }

/** Right-handed in-plane basis (u, v, n = outward) for a cube face given its outward
 *  axis-aligned unit normal (one nonzero ±1 component). u/v are world axes; swapped
 *  when needed so (u × v)·n > 0, so a CCW 2D outline extrudes with outward normals. */
export function cubeFaceBasis(normal: readonly number[]): FaceBasis {
  const n = new THREE.Vector3(normal[0], normal[1], normal[2]);
  const ax = normal.findIndex((c) => c !== 0);
  const idx = [0, 1, 2].filter((i) => i !== ax);
  let u = new THREE.Vector3().setComponent(idx[0], 1);
  let v = new THREE.Vector3().setComponent(idx[1], 1);
  if (new THREE.Vector3().crossVectors(u, v).dot(n) < 0) [u, v] = [v, u];
  return { u, v, n };
}

/** Extrude a 2D outline (in the face's u/v plane, already in WORLD units) into a thick
 *  sticker tile oriented on the face. `origin` = where outline (0,0) maps (already
 *  lifted off the body). `flip` mirrors the extrude when the basis normal is inward
 *  (so the tile still caps outward). Returns geometry; caller adds material + userData. */
export function extrudeOntoFace(
  outline: V2[],
  basis: { u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; origin: THREE.Vector3 },
  depth: number,
  flip = false,
): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  if (flip) geo.translate(0, 0, -depth);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(basis.u, basis.v, basis.n).setPosition(basis.origin));
  return geo;
}

/** 示意小面轮廓(sim_svg_export_schematic 消费):把一个小面的理想晶格顶点(未
 *  inset / 未 lift,与邻块严格共点)绕质心按 outward 法向排成 CCW,返回扁平 xyz。
 *  被 pyra 之外走 polytope facet 的引擎魔方(skewb / mega / fto)共用。 */
export function schematicPolyFromFacet(facet: THREE.Vector3[], normal: THREE.Vector3): number[] {
  const n = normal.clone().normalize();
  const c = facet.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / facet.length);
  let u = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  u = u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  // (u, w, n) 右手系 → (u,w) 平面内按角升序 = 绕 n 的 CCW = 绕向朝外
  const sorted = facet.slice().sort((a, b) => {
    const da = a.clone().sub(c); const db = b.clone().sub(c);
    return Math.atan2(da.dot(w), da.dot(u)) - Math.atan2(db.dot(w), db.dot(u));
  });
  const out: number[] = [];
  for (const p of sorted) out.push(p.x, p.y, p.z);
  return out;
}

/**
 * Build a sticker mesh from an extruded sticker geometry — the ONE place that encodes
 * the black-walls invariant so no puzzle can forget it. An `ExtrudeGeometry` has two
 * material groups: [0] = the top/bottom caps, [1] = the side walls. Passing the material
 * array `[capMat, wallMat]` makes the caps colored and the WALLS body-dark, so a colored
 * wall never occludes the thin black groove at a grazing viewing angle (which would make
 * the dividing line vanish on a steeply-tilted face). `wallMat` must be the piece's body
 * (dark) material so the wall matches the groove. Also tags `userData.simRole='sticker'`
 * for the structure-color debug overlay (debugColors.ts leaves stickers untouched).
 * Used by every cube-faced engine puzzle (dino/redi/rex/heli/ivy); see sim-add-puzzle skill.
 */
export function makeSticker(
  geo: THREE.BufferGeometry,
  capMat: THREE.Material,
  wallMat: THREE.Material,
  userData?: Record<string, unknown>,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, [capMat, wallMat]);
  mesh.userData.simRole = 'sticker';
  if (userData) Object.assign(mesh.userData, userData);
  return mesh;
}
