'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// ─── Geometry helpers ────────────────────────────────────────────────────────

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3]; // row-major

function vecScale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function vecNorm(v: Vec3): Vec3 {
  const l = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return l < 1e-12 ? [0, 0, 0] : vecScale(v, 1 / l);
}
function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function matVec(m: Mat3, v: Vec3): Vec3 {
  return [
    vecDot(m[0], v),
    vecDot(m[1], v),
    vecDot(m[2], v),
  ];
}
function matMul(a: Mat3, b: Mat3): Mat3 {
  const bT: Mat3 = [
    [b[0][0], b[1][0], b[2][0]],
    [b[0][1], b[1][1], b[2][1]],
    [b[0][2], b[1][2], b[2][2]],
  ];
  return [
    [vecDot(a[0], bT[0]), vecDot(a[0], bT[1]), vecDot(a[0], bT[2])],
    [vecDot(a[1], bT[0]), vecDot(a[1], bT[1]), vecDot(a[1], bT[2])],
    [vecDot(a[2], bT[0]), vecDot(a[2], bT[1]), vecDot(a[2], bT[2])],
  ];
}
function matDet(m: Mat3): number {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}
function matKey(m: Mat3): string {
  return m.flat().map(x => Math.round(x * 1e4)).join(',');
}
const ID: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// Rotation by angle θ around axis (ux,uy,uz) — Rodrigues
function axisAngle(axis: Vec3, theta: number): Mat3 {
  const [ux, uy, uz] = vecNorm(axis);
  const c = Math.cos(theta), s = Math.sin(theta), t = 1 - c;
  return [
    [t * ux * ux + c,      t * ux * uy - s * uz, t * ux * uz + s * uy],
    [t * ux * uy + s * uz, t * uy * uy + c,      t * uy * uz - s * ux],
    [t * ux * uz - s * uy, t * uy * uz + s * ux, t * uz * uz + c],
  ];
}

// ─── Isometric projection ───────────────────────────────────────────────────
// Projects 3D point to 2D canvas coords (cx, cy = canvas center)
function project(v: Vec3, cx: number, cy: number, scale: number): [number, number] {
  // Classic oblique: x' = cx + scale*(x - z)*cos30, y' = cy - scale*(y + (x+z)*sin30)
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  return [
    cx + scale * (v[0] - v[2]) * cos30,
    cy - scale * (v[1] + (v[0] + v[2]) * sin30),
  ];
}

// ─── The 24 rotation matrices of the cube (det +1, entries in {0,±1}) ───────
function buildCubeRotations(): Mat3[] {
  const axes: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
  const rots = new Map<string, Mat3>();
  rots.set(matKey(ID), ID);
  // Generate by BFS: compose 90° face rotations
  const queue: Mat3[] = [ID];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const ax of axes) {
      for (const ang of angles) {
        const r = matMul(axisAngle(ax, ang), cur);
        const k = matKey(r);
        if (!rots.has(k) && Math.abs(matDet(r) - 1) < 0.01) {
          rots.set(k, r);
          queue.push(r);
        }
      }
    }
    if (rots.size === 24) break;
  }
  return Array.from(rots.values());
}

// Cube body diagonal endpoints: +octant representative for each of 4 diagonals
// Diagonals pair (±1,±1,±1) with their antipode.
// Label by + octant: 1:(+,+,+), 2:(+,+,-), 3:(+,-,+), 4:(+,-,-)
const DIAG_PLUS: Vec3[] = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
];

function diagIndex(v: Vec3): number {
  // find which diagonal this vertex belongs to (use its +octant rep)
  const rep: Vec3 = [Math.sign(v[0]) || 1, Math.sign(v[1]) || 1, Math.sign(v[2]) || 1] as Vec3;
  const posRep: Vec3 = Math.sign(rep[0]) === 1 ? rep : [-rep[0], -rep[1], -rep[2]] as Vec3;
  for (let i = 0; i < 4; i++) {
    const d = DIAG_PLUS[i];
    if (Math.abs(d[0] - posRep[0]) < 0.1 && Math.abs(d[1] - posRep[1]) < 0.1 && Math.abs(d[2] - posRep[2]) < 0.1) return i;
  }
  return 0;
}

// Given rotation R, compute the permutation of the 4 body diagonals (0-indexed)
function diagPermutation(R: Mat3): number[] {
  return DIAG_PLUS.map(d => {
    const img = matVec(R, d);
    // Map to the +octant representative (negate if the first coord is negative)
    const sign = img[0] > 0;
    return diagIndex(sign ? img : [-img[0], -img[1], -img[2]] as Vec3);
  });
}

// ─── Tetrahedron geometry ───────────────────────────────────────────────────
// Vertices at alternating cube corners
const TETRA_VERTS: Vec3[] = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
];
const TETRA_FACES: [number, number, number][] = [
  [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3],
];
const TETRA_FACE_COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B'];

// Generators for tetra rotations: 120° about each vertex axis, 180° edge-midpoint
function buildTetraRotations(): Mat3[] {
  const rots = new Map<string, Mat3>();
  rots.set(matKey(ID), ID);
  // vertex axes: each vertex to opposite face-center
  for (const v of TETRA_VERTS) {
    const axis = vecNorm(v);
    for (const k of [1, 2]) {
      const R = axisAngle(axis, (2 * Math.PI / 3) * k);
      const key = matKey(R);
      if (!rots.has(key)) rots.set(key, R);
    }
  }
  // edge-midpoint axes: midpoint of each edge (6 edges of tetra = 3 axes, since each axis has 2 endpoints)
  const edges: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (const [i, j] of edges) {
    const mid: Vec3 = [
      (TETRA_VERTS[i][0] + TETRA_VERTS[j][0]) / 2,
      (TETRA_VERTS[i][1] + TETRA_VERTS[j][1]) / 2,
      (TETRA_VERTS[i][2] + TETRA_VERTS[j][2]) / 2,
    ];
    const R = axisAngle(vecNorm(mid), Math.PI);
    const key = matKey(R);
    if (!rots.has(key)) rots.set(key, R);
  }
  return Array.from(rots.values());
}

// ─── Icosahedron geometry ───────────────────────────────────────────────────
const PHI = (1 + Math.sqrt(5)) / 2;
// 12 vertices from 3 mutually perpendicular golden rectangles
const ICOSA_VERTS: Vec3[] = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
];
// 20 faces (each triangle connecting 3 vertices at distance ~2 from each other)
function buildIcosaFaces(): [number, number, number][] {
  const faces: [number, number, number][] = [];
  const edgeLen2 = 4.0; // |v_i - v_j|² = 4 for adjacent icosa vertices
  for (let a = 0; a < 12; a++)
    for (let b = a + 1; b < 12; b++)
      for (let c = b + 1; c < 12; c++) {
        const ab = ICOSA_VERTS[a].reduce((s, _, i) => s + (ICOSA_VERTS[a][i] - ICOSA_VERTS[b][i]) ** 2, 0);
        const ac = ICOSA_VERTS[a].reduce((s, _, i) => s + (ICOSA_VERTS[a][i] - ICOSA_VERTS[c][i]) ** 2, 0);
        const bc = ICOSA_VERTS[b].reduce((s, _, i) => s + (ICOSA_VERTS[b][i] - ICOSA_VERTS[c][i]) ** 2, 0);
        if (Math.abs(ab - edgeLen2) < 0.1 && Math.abs(ac - edgeLen2) < 0.1 && Math.abs(bc - edgeLen2) < 0.1)
          faces.push([a, b, c]);
      }
  return faces;
}
const ICOSA_FACES = buildIcosaFaces();

// Generators for icosa rotations
function buildIcosaRotations(): Mat3[] {
  const rots = new Map<string, Mat3>();
  rots.set(matKey(ID), ID);
  const queue: Mat3[] = [ID];
  // generate by composing 72° vertex rotations and 120° face rotations
  const gens: Mat3[] = [];
  // 72° about each vertex
  for (const v of ICOSA_VERTS) {
    gens.push(axisAngle(vecNorm(v), (2 * Math.PI) / 5));
    gens.push(axisAngle(vecNorm(v), (4 * Math.PI) / 5));
  }
  // 120° about each face center
  for (const [a, b, c] of ICOSA_FACES) {
    const fc: Vec3 = [
      (ICOSA_VERTS[a][0] + ICOSA_VERTS[b][0] + ICOSA_VERTS[c][0]) / 3,
      (ICOSA_VERTS[a][1] + ICOSA_VERTS[b][1] + ICOSA_VERTS[c][1]) / 3,
      (ICOSA_VERTS[a][2] + ICOSA_VERTS[b][2] + ICOSA_VERTS[c][2]) / 3,
    ];
    gens.push(axisAngle(vecNorm(fc), (2 * Math.PI) / 3));
  }
  while (queue.length && rots.size < 60) {
    const cur = queue.shift()!;
    for (const g of gens) {
      const r = matMul(g, cur);
      const k = matKey(r);
      if (!rots.has(k) && Math.abs(matDet(r) - 1) < 0.01) {
        rots.set(k, r);
        queue.push(r);
      }
    }
  }
  return Array.from(rots.values());
}

// ─── Permutation utilities ───────────────────────────────────────────────────

function permSign(p: number[]): 1 | -1 {
  const n = p.length;
  const seen = new Array<boolean>(n).fill(false);
  let inv = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    let j = i; let len = 0;
    while (!seen[j]) { seen[j] = true; j = p[j]; len++; }
    inv += len - 1;
  }
  return inv % 2 === 0 ? 1 : -1;
}

function cycleNotation(p: number[]): string {
  const n = p.length;
  const seen = new Array<boolean>(n).fill(false);
  const cycles: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || p[i] === i) { seen[i] = true; continue; }
    const cyc: number[] = [];
    let j = i;
    while (!seen[j]) { seen[j] = true; cyc.push(j + 1); j = p[j]; }
    cycles.push(cyc);
  }
  if (cycles.length === 0) return 'e';
  return cycles.map(c => `(${c.join('')})`).join('');
}

// ─── SVG rendering for solids ────────────────────────────────────────────────

type SolidFace = { verts: Vec3[]; color: string; centroid: Vec3; normal: Vec3 };

function solidFaces(
  verts: Vec3[],
  faces: [number, number, number][],
  colors: string[],
  R: Mat3,
): SolidFace[] {
  return faces.map((f, fi) => {
    const tv = f.map(i => matVec(R, verts[i])) as [Vec3, Vec3, Vec3];
    const ab: Vec3 = [tv[1][0] - tv[0][0], tv[1][1] - tv[0][1], tv[1][2] - tv[0][2]];
    const ac: Vec3 = [tv[2][0] - tv[0][0], tv[2][1] - tv[0][1], tv[2][2] - tv[0][2]];
    const normal: Vec3 = vecNorm([
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ]);
    const centroid: Vec3 = [
      (tv[0][0] + tv[1][0] + tv[2][0]) / 3,
      (tv[0][1] + tv[1][1] + tv[2][1]) / 3,
      (tv[0][2] + tv[1][2] + tv[2][2]) / 3,
    ];
    return { verts: tv, color: colors[fi % colors.length], centroid, normal };
  });
}

function renderSolid(
  faces: SolidFace[],
  cx: number, cy: number, scale: number,
  viewDir: Vec3 = [0.2, 0.3, 1],
): { visible: SolidFace[]; allPaths: { path: string; fill: string; stroke: string; }[] } {
  const view = vecNorm(viewDir);
  const visible = faces.filter(f => vecDot(f.normal, view) > 0.02);
  visible.sort((a, b) => vecDot(b.centroid, view) - vecDot(a.centroid, view));
  const allPaths = visible.map(f => {
    const pts = f.verts.map(v => project(v, cx, cy, scale));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';
    return { path, fill: f.color, stroke: 'var(--bg)' };
  });
  return { visible, allPaths };
}

// ─── Cube face data ──────────────────────────────────────────────────────────

const CUBE_VERTS: Vec3[] = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
];
const CUBE_FACE_QUADS: [number, number, number, number][] = [
  [0, 2, 3, 1], // +x
  [4, 5, 7, 6], // -x
  [0, 1, 5, 4], // +y
  [2, 6, 7, 3], // -y
  [0, 4, 6, 2], // +z
  [1, 3, 7, 5], // -z
];
const CUBE_FACE_COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C'];

function renderCube(R: Mat3, cx: number, cy: number, scale: number) {
  const view: Vec3 = [0.3, 0.4, 1];
  const vn = vecNorm(view);
  type QFace = { pts: [number, number][]; color: string; depth: number; };
  const quads: QFace[] = [];
  CUBE_FACE_QUADS.forEach((q, fi) => {
    const tv = q.map(i => matVec(R, CUBE_VERTS[i]));
    const ab: Vec3 = [tv[1][0] - tv[0][0], tv[1][1] - tv[0][1], tv[1][2] - tv[0][2]];
    const ac: Vec3 = [tv[2][0] - tv[0][0], tv[2][1] - tv[0][1], tv[2][2] - tv[0][2]];
    const normal = vecNorm([
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ] as Vec3);
    if (vecDot(normal, vn) <= 0) return;
    const depth = tv.reduce((s, v) => s + vecDot(v, vn), 0) / 4;
    const pts = tv.map(v => project(v as Vec3, cx, cy, scale)) as [number, number][];
    quads.push({ pts, color: CUBE_FACE_COLORS[fi], depth });
  });
  quads.sort((a, b) => b.depth - a.depth);
  return quads;
}

// ─── Diagonal lines ──────────────────────────────────────────────────────────
const DIAG_COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B'];

function diagLines(R: Mat3, cx: number, cy: number, scale: number) {
  return DIAG_PLUS.map((d, i) => {
    const pos = matVec(R, d);
    const neg = matVec(R, [-d[0], -d[1], -d[2]] as Vec3);
    const [x1, y1] = project(pos, cx, cy, scale);
    const [x2, y2] = project(neg, cx, cy, scale);
    return { x1, y1, x2, y2, color: DIAG_COLORS[i] };
  });
}

// ─── Cube generating rotations (named, axis-aligned 90°) ────────────────────
const CUBE_GENS: { label: string; axis: Vec3; angle: number }[] = [
  { label: 'X+', axis: [1, 0, 0], angle: Math.PI / 2 },
  { label: 'X−', axis: [1, 0, 0], angle: -Math.PI / 2 },
  { label: 'Y+', axis: [0, 1, 0], angle: Math.PI / 2 },
  { label: 'Y−', axis: [0, 1, 0], angle: -Math.PI / 2 },
  { label: 'Z+', axis: [0, 0, 1], angle: Math.PI / 2 },
  { label: 'Z−', axis: [0, 0, 1], angle: -Math.PI / 2 },
];

// ─── Tetrahedron improper symmetries (reflections) ──────────────────────────
// Reflection through the plane through edge midpoint perpendicular to edge
function reflectPlane(normal: Vec3): Mat3 {
  const [nx, ny, nz] = vecNorm(normal);
  return [
    [1 - 2 * nx * nx, -2 * nx * ny,    -2 * nx * nz],
    [-2 * nx * ny,    1 - 2 * ny * ny,  -2 * ny * nz],
    [-2 * nx * nz,    -2 * ny * nz,     1 - 2 * nz * nz],
  ];
}

// Build the 6 tetrahedron reflection matrices: each through a plane containing
// one edge of the tetra and the midpoints of the two opposite edges.
function buildTetraReflections(): { mat: Mat3; label: string }[] {
  // Each reflection swaps two vertices (transposition) — plane perpendicular to the
  // edge connecting those two vertices and passing through the other two.
  const pairs: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  return pairs.map(([i, j]) => {
    // Normal of the mirror plane = direction of the edge being "swapped across"
    const edge: Vec3 = [
      TETRA_VERTS[i][0] - TETRA_VERTS[j][0],
      TETRA_VERTS[i][1] - TETRA_VERTS[j][1],
      TETRA_VERTS[i][2] - TETRA_VERTS[j][2],
    ];
    const mat = reflectPlane(edge);
    return { mat, label: `(${i + 1}↔${j + 1})` };
  });
}

// Given any 3x3 matrix, find vertex permutation by nearest-vertex matching
function vertexPermutation(R: Mat3, verts: Vec3[]): number[] {
  return verts.map(v => {
    const img = matVec(R, v);
    let best = 0;
    let bestDist = Infinity;
    for (let k = 0; k < verts.length; k++) {
      const d = verts[k].reduce((s, _, i) => s + (verts[k][i] - img[i]) ** 2, 0);
      if (d < bestDist) { bestDist = d; best = k; }
    }
    return best;
  });
}

// ─── Component: Widget 1 — Cube body-diagonal S4 explorer ───────────────────

function CubeS4Widget() {
  const lang = useLang();
  const [rotMat, setRotMat] = useState<Mat3>(ID);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => new Set([matKey(ID)]));
  const [lastPerm, setLastPerm] = useState<number[]>([0, 1, 2, 3]);
  const [appliedLabels, setAppliedLabels] = useState<string[]>([]);

  const apply = useCallback((axis: Vec3, angle: number, label: string) => {
    const R = axisAngle(axis, angle);
    setRotMat(prev => {
      const next = matMul(R, prev);
      const k = matKey(next);
      const perm = diagPermutation(next);
      setLastPerm(perm);
      setSeenKeys(s => {
        const ns = new Set(s);
        ns.add(k);
        return ns;
      });
      setAppliedLabels(prev2 => [...prev2.slice(-7), label]);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setRotMat(ID);
    setSeenKeys(new Set([matKey(ID)]));
    setLastPerm([0, 1, 2, 3]);
    setAppliedLabels([]);
  }, []);

  // SVG rendering
  const W = 240, H = 220, cx = W / 2, cy = H / 2, scale = 52;
  const quads = useMemo(() => renderCube(rotMat, cx, cy, scale), [rotMat]);
  const dlines = useMemo(() => diagLines(rotMat, cx, cy, scale), [rotMat]);

  const permStr = cycleNotation(lastPerm);
  const sign = permSign(lastPerm);
  const distinct = seenKeys.size;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="体对角线置换探索器 — 实现 S₄" en="Body-diagonal permutation explorer — realising S₄" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>点击按钮旋转正方体，观察 4 条体对角线如何被置换。达到所有 24 种置换 = S₄ 的全部元素。</>}
          en={<>Apply rotations to the cube and watch how the 4 body diagonals permute. Reaching all 24 permutations demonstrates Rot(cube) ≅ S₄.</>}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* SVG cube */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, flex: '0 0 auto' }}
          aria-label={tr({ zh: '旋转中的正方体与体对角线', en: 'Rotating cube with body diagonals'
        })}
        >
          {/* cube faces */}
          {quads.map((q, i) => (
            <polygon
              key={i}
              points={q.pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill={q.color}
              fillOpacity={0.72}
              stroke="var(--bg)"
              strokeWidth={1.5}
            />
          ))}
          {/* body diagonals */}
          {dlines.map((d, i) => (
            <line
              key={i}
              x1={d.x1.toFixed(1)} y1={d.y1.toFixed(1)}
              x2={d.x2.toFixed(1)} y2={d.y2.toFixed(1)}
              stroke={d.color}
              strokeWidth={2.5}
              strokeDasharray="5,4"
              opacity={0.9}
            />
          ))}
          {/* diagonal labels */}
          {DIAG_PLUS.map((d, i) => {
            const pos = matVec(rotMat, d);
            const [px, py] = project(pos, cx, cy, scale);
            return (
              <text key={i} x={px} y={py - 6} textAnchor="middle"
                fill={DIAG_COLORS[i]} fontSize={11} fontWeight={700} fontFamily="var(--mono)"
              >
                {i + 1}
              </text>
            );
          })}
        </svg>

        {/* Controls + readout */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            <L zh="轴旋转" en="Axis Rotations" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {CUBE_GENS.map(g => (
              <button key={g.label} className="gt-btn gt-btn-ghost"
                style={{ fontSize: 11, padding: '5px 10px' }}
                onClick={() => apply(g.axis, g.angle, g.label)}
              >
                {g.label}
              </button>
            ))}
            <button className="gt-btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={reset}>
              <L zh="重置" en="Reset" />
            </button>
          </div>

          {appliedLabels.length > 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 12 }}>
              {tr({ zh: '已应用', en: 'Applied'
            })}: {appliedLabels.join(' → ')}
            </div>
          )}

          {/* diagonal permutation slots */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 38, height: 38, borderRadius: 6,
                background: DIAG_COLORS[i],
                color: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
                opacity: 0.92,
              }}>
                <span style={{ fontSize: 8, opacity: .7 }}>{i + 1}</span>
                <span>→{lastPerm[i] + 1}</span>
              </div>
            ))}
          </div>

          <div className="gt-panel-result">
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="置换（轮换记法）" en="Permutation (cycle notation)" /></span>
              <span className="gt-result-val-strong">{permStr}</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="奇偶性" en="Parity" /></span>
              <span className="gt-result-val" style={{ color: sign === 1 ? 'var(--green)' : 'var(--accent)' }}>
                {sign === 1
                  ? tr({ zh: '偶置换', en: 'even'
                                                  })
                  : tr({ zh: '奇置换', en: 'odd'
                                                  })}
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="已探索不同方向" en="Distinct orientations reached" /></span>
              <span className="gt-result-val-strong">{distinct} / 24</span>
            </div>
            {distinct === 24 && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 4, background: 'color-mix(in srgb, var(--green) 14%, var(--bg-elev))', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                <L zh="所有 24 个元素都已探索 — S₄ 完全实现！" en="All 24 elements reached — S₄ fully realised!" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component: Widget 2 — Tetrahedron A4 vs S4 ─────────────────────────────

function TetraWidget() {
  const lang = useLang();
  const [allowReflections, setAllowReflections] = useState(false);
  const [rotMat, setRotMat] = useState<Mat3>(ID);
  const [evenPerms, setEvenPerms] = useState<Set<string>>(() => new Set([JSON.stringify([0, 1, 2, 3])]));
  const [oddPerms, setOddPerms] = useState<Set<string>>(() => new Set<string>());

  const REFLECTIONS = useMemo(() => buildTetraReflections(), []);

  const applyMat = useCallback((R: Mat3) => {
    setRotMat(prev => {
      const next = matMul(R, prev);
      const perm = vertexPermutation(next, TETRA_VERTS);
      const key = JSON.stringify(perm);
      const det = matDet(next);
      if (det > 0) {
        setEvenPerms(s => { const ns = new Set(s); ns.add(key); return ns; });
      } else {
        setOddPerms(s => { const ns = new Set(s); ns.add(key); return ns; });
      }
      return next;
    });
  }, [TETRA_VERTS]);

  const reset = useCallback(() => {
    setRotMat(ID);
    setEvenPerms(new Set([JSON.stringify([0, 1, 2, 3])]));
    setOddPerms(new Set());
  }, []);

  const perm = useMemo(() => vertexPermutation(rotMat, TETRA_VERTS), [rotMat]);
  const permStr = cycleNotation(perm);
  const det = matDet(rotMat);
  const isProper = det > 0;

  // SVG
  const W = 200, H = 190, cx = W / 2, cy = H / 2, scale = 52;
  const faces = useMemo(() => solidFaces(TETRA_VERTS, TETRA_FACES, TETRA_FACE_COLORS, rotMat), [rotMat]);
  const { allPaths } = useMemo(() => renderSolid(faces, cx, cy, scale), [faces]);

  // Show vertex labels after rotation
  const tverts = useMemo(() => TETRA_VERTS.map(v => {
    const p = matVec(rotMat, v);
    return { p3: p, p2: project(p, cx, cy, scale) };
  }), [rotMat]);

  const genRotBtns = [
    { label: tr({ zh: '顶点旋转 120°', en: 'Vertex 120°'
    }), R: axisAngle(vecNorm(TETRA_VERTS[0]), (2 * Math.PI) / 3) },
    { label: tr({ zh: '顶点旋转 240°', en: 'Vertex 240°'
    }), R: axisAngle(vecNorm(TETRA_VERTS[0]), (4 * Math.PI) / 3) },
    { label: tr({ zh: '棱轴旋转 180°', en: 'Edge 180°'
    }), R: axisAngle(vecNorm([TETRA_VERTS[0][0] + TETRA_VERTS[1][0], TETRA_VERTS[0][1] + TETRA_VERTS[1][1], TETRA_VERTS[0][2] + TETRA_VERTS[1][2]]), Math.PI) },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="A₄ 嵌入 S₄：旋转 vs 反射" en="A₄ inside S₄: rotations vs reflections" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>正四面体的旋转只产生偶置换（A₄），而反射则产生奇置换。两者合起来构成 S₄，但不含中心反演。</>}
          en={<>Tetrahedron rotations realise only even vertex permutations (A₄); reflections add odd ones. Together they form S₄ — but there is no central inversion.</>}
        />
      </div>

      <div className="gt-panel-input-row">
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
          <L zh="允许反射" en="Allow reflections" />
        </span>
        <button
          className={`gt-chip ${allowReflections ? 'gt-chip-active' : ''}`}
          onClick={() => setAllowReflections(r => !r)}
        >
          {allowReflections ? tr({ zh: '是（共 24 = S₄）', en: 'Yes (24 = S₄)' }) : tr({ zh: '否（仅旋转，12 = A₄）', en: 'No (rotations only, 12 = A₄)'
                          })}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* SVG tetrahedron */}
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, flex: '0 0 auto' }}
          aria-label={tr({ zh: '带编号顶点的正四面体', en: 'Labelled tetrahedron'
        })}>
          {allPaths.map((p, i) => (
            <path key={i} d={p.path} fill={p.fill} fillOpacity={0.78} stroke="var(--bg)" strokeWidth={1.5} />
          ))}
          {tverts.map((tv, i) => (
            <text key={i} x={tv.p2[0]} y={tv.p2[1] - 5} textAnchor="middle"
              fill="var(--ink)" fontSize={13} fontWeight={700} fontFamily="var(--mono)"
              stroke="var(--bg)" strokeWidth={3} paintOrder="stroke">
              {i + 1}
            </text>
          ))}
        </svg>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            <L zh="施加对称操作" en="Apply symmetry" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {genRotBtns.map(g => (
              <button key={g.label} className="gt-btn gt-btn-ghost" style={{ fontSize: 11, padding: '5px 9px' }}
                onClick={() => applyMat(g.R)}>
                {g.label}
              </button>
            ))}
            {allowReflections && REFLECTIONS.slice(0, 3).map((r, i) => (
              <button key={i} className="gt-btn gt-btn-ghost" style={{ fontSize: 11, padding: '5px 9px', borderColor: 'var(--accent-2)' }}
                onClick={() => applyMat(r.mat)}>
                {lang === 'zh' ? `反射 ${r.label}` : `Refl ${r.label}`}
              </button>
            ))}
            <button className="gt-btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={reset}>
              <L zh="重置" en="Reset" />
            </button>
          </div>

          <div className="gt-panel-result">
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="当前置换" en="Current permutation" /></span>
              <span className="gt-result-val-strong">{permStr}</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="奇偶性" en="Parity" /></span>
              <span className="gt-result-val" style={{ color: isProper ? 'var(--green)' : 'var(--warn)' }}>
                {isProper
                  ? tr({ zh: '偶（旋转）', en: 'even (rotation)'
                                                  })
                  : tr({ zh: '奇（反射）', en: 'odd (reflection)' })}
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="偶置换已找到" en="Even perms found" /></span>
              <span className="gt-result-val">
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>{evenPerms.size}</span>
                <span style={{ color: 'var(--ink-faint)' }}> / 12  (A₄)</span>
              </span>
            </div>
            {allowReflections && (
              <div className="gt-result-row">
                <span className="gt-result-label"><L zh="奇置换已找到" en="Odd perms found" /></span>
                <span className="gt-result-val">
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{oddPerms.size}</span>
                  <span style={{ color: 'var(--ink-faint)' }}> / 12</span>
                </span>
              </div>
            )}
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="合计" en="Total" /></span>
              <span className="gt-result-val-strong">{evenPerms.size + oddPerms.size} / {allowReflections ? '24  (S₄)' : '12  (A₄)'}</span>
            </div>
          </div>

          <div className="gt-aside" style={{ marginTop: 12 }}>
            <L
              zh={<>注意：没有任何操作等于中心反演 x ↦ −x，这正是为什么全群是 S₄ 而非 A₄ × C₂。</>}
              en={<>Notice: no reached matrix equals the central inversion x ↦ −x — that is exactly why the full group is S₄, not A₄ × C₂.</>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component: Widget 3 — Orientation counter (order table) ─────────────────

const SOLID_COLORS_TETRA = TETRA_FACE_COLORS;
const SOLID_COLORS_ICOSA = [
  '#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C',
  '#C2410C', '#5C7CA0', '#9C4E6B', '#8B2E3C', '#2A4D69',
  '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0',
  '#9C4E6B', '#8B2E3C', '#2A4D69', '#3F7050', '#B8860B',
];

type SolidName = 'tetrahedron' | 'cube' | 'icosahedron';
const SOLID_META: Record<SolidName, { label: { zh: string; en: string
 }; order: number; group: string }> = {
  tetrahedron: { label: { zh: '正四面体', en: 'Tetrahedron'
}, order: 12, group: 'A₄' },
  cube:        { label: { zh: '正方体',   en: 'Cube'
}, order: 24, group: 'S₄' },
  icosahedron: { label: { zh: '正二十面体', en: 'Icosahedron'
}, order: 60, group: 'A₅' },
};

function OrbitCountWidget() {
  const lang = useLang();
  const [solid, setSolid] = useState<SolidName>('cube');
  const [rotMat, setRotMat] = useState<Mat3>(ID);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => new Set([matKey(ID)]));

  // Precompute all rotation matrices for each solid
  const allCubeRots  = useMemo(() => buildCubeRotations(),  []);
  const allTetraRots = useMemo(() => buildTetraRotations(), []);
  const allIcosaRots = useMemo(() => buildIcosaRotations(), []);

  const allRots = solid === 'tetrahedron' ? allTetraRots : solid === 'cube' ? allCubeRots : allIcosaRots;
  const meta = SOLID_META[solid];

  const reset = useCallback(() => {
    setRotMat(ID);
    setSeenKeys(new Set([matKey(ID)]));
  }, []);

  const changeSolid = useCallback((s: SolidName) => {
    setSolid(s);
    setRotMat(ID);
    setSeenKeys(new Set([matKey(ID)]));
  }, []);

  const applyRandom = useCallback(() => {
    if (allRots.length === 0) return;
    const idx = Math.floor(seenKeys.size % allRots.length);
    const R = allRots[idx];
    setRotMat(prev => {
      const next = matMul(R, prev);
      const k = matKey(next);
      setSeenKeys(s => { const ns = new Set(s); ns.add(k); return ns; });
      return next;
    });
  }, [allRots, seenKeys.size]);

  // Also allow clicking "apply all" which adds all rotations one by one
  const applyAll = useCallback(() => {
    setSeenKeys(new Set(allRots.map(matKey)));
  }, [allRots]);

  // SVG
  const W = 200, H = 190, cx = W / 2, cy = H / 2, scale = solid === 'icosahedron' ? 42 : 55;
  const paths = useMemo(() => {
    const verts = solid === 'tetrahedron' ? TETRA_VERTS : solid === 'cube' ? CUBE_VERTS : ICOSA_VERTS;
    const faceList = solid === 'tetrahedron' ? TETRA_FACES : solid === 'cube'
      ? CUBE_FACE_QUADS.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]] as [number, number, number][])
      : ICOSA_FACES;
    const colors = solid === 'tetrahedron' ? SOLID_COLORS_TETRA : solid === 'cube' ? CUBE_FACE_COLORS : SOLID_COLORS_ICOSA;
    const fs = solidFaces(verts, faceList as [number, number, number][], colors, rotMat);
    return renderSolid(fs, cx, cy, scale).allPaths;
  }, [solid, rotMat, scale]);

  const distinct = seenKeys.size;
  const target = meta.order;
  const pct = Math.min(100, (distinct / target) * 100);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="旋转轨道计数——验证群的阶" en="Orientation orbit counter — verifying the group order" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>对带颜色标记的立体施加旋转，计数不同方向数目，直至达到理论值（正四面体 12，正方体 24，正二十面体 60）。</>}
          en={<>Apply rotations to the coloured solid and count distinct orientations until the theoretical limit (12, 24, or 60) is reached.</>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ marginBottom: 18 }}>
        {(Object.keys(SOLID_META) as SolidName[]).map(s => (
          <button
            key={s}
            className={`gt-chip ${solid === s ? 'gt-chip-active' : ''}`}
            onClick={() => changeSolid(s)}
          >
            {tr(SOLID_META[s].label)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, flex: '0 0 auto' }}
          aria-label={tr({ zh: '当前方向的立体', en: 'Solid in current orientation'
        })}>
          {paths.map((p, i) => (
            <path key={i} d={p.path} fill={p.fill} fillOpacity={0.8} stroke="var(--bg)" strokeWidth={1.5} />
          ))}
        </svg>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <button className="gt-btn gt-btn-ghost" style={{ fontSize: 11 }} onClick={applyRandom}>
              <L zh="应用一次旋转" en="Apply one rotation" />
            </button>
            <button className="gt-btn gt-btn-ghost" style={{ fontSize: 11 }} onClick={applyAll}>
              <L zh="探索全部" en="Explore all" />
            </button>
            <button className="gt-btn" style={{ fontSize: 11 }} onClick={reset}>
              <L zh="重置" en="Reset" />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginBottom: 6 }}>
              {lang === 'zh'
                ? `已发现不同方向：${distinct} / ${target}  (群 ${meta.group})`
                : `Distinct orientations: ${distinct} / ${target}  (group ${meta.group})`}
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--rule)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 4,
                background: distinct === target ? 'var(--green)' : 'var(--accent)',
                transition: 'width .3s',
              }} />
            </div>
          </div>

          {distinct === target && (
            <div style={{ padding: '8px 12px', borderRadius: 4, background: 'color-mix(in srgb, var(--green) 14%, var(--bg-elev))', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              {lang === 'zh'
                ? `全部 ${target} 个方向已找到！群 ${meta.group} 的阶 = ${target}。`
                : `All ${target} orientations reached! Order of ${meta.group} = ${target}.`}
            </div>
          )}

          {/* Summary table */}
          <table className="gt-compare" style={{ marginTop: 18, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}><L zh="立体" en="Solid" /></th>
                <th><L zh="旋转群" en="Rot. group" /></th>
                <th><L zh="阶" en="Order" /></th>
                <th><L zh="全群" en="Full sym." /></th>
              </tr>
            </thead>
            <tbody>
              {([
                ['tetrahedron', 'A₄', 12, 'S₄', 24],
                ['cube', 'S₄', 24, 'S₄ × C₂', 48],
                ['icosahedron', 'A₅', 60, 'A₅ × C₂', 120],
              ] as const).map(([s, rot, ord, full, ford]) => (
                <tr key={s} style={{ fontWeight: solid === s ? 700 : undefined }}>
                  <td style={{ fontFamily: 'var(--serif)', color: solid === s ? 'var(--accent)' : 'var(--ink-dim)' }}>
                    {tr(SOLID_META[s].label)}
                  </td>
                  <td className="num">{rot}</td>
                  <td className="num">{ord}</td>
                  <td className="num">{full} <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>({ford})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main section component ──────────────────────────────────────────────────

export default function PlatonicSymmetry() {
  return (
    <GTSec id="platonic-symmetry" className="gt-sec">
      <div className="gt-sec-num">§42</div>
      <h2 className="gt-sec-title">
        <L zh="柏拉图立体的对称群" en="Symmetry of the Platonic solids" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            五种柏拉图立体——正四面体、正方体、正八面体、正十二面体、正二十面体——不仅是古典几何的明珠，
            也是群论的天然试验场。它们的旋转对称群恰好就是三个多面体旋转群：<TeX src={String.raw`A_4`} />、<TeX src={String.raw`S_4`} />、<TeX src={String.raw`A_5`} />，
            阶分别为 12、24、60。透过这些立体，我们能在三维空间里亲眼看到交错群和对称群的每一个元素。
          </>}
          en={<>
            The five Platonic solids — tetrahedron, cube, octahedron, dodecahedron, icosahedron — are not only jewels of classical geometry
            but natural laboratories for group theory. Their rotation symmetry groups are exactly the three polyhedral groups:
            <TeX src={String.raw`A_4`} />, <TeX src={String.raw`S_4`} />, and <TeX src={String.raw`A_5`} />,
            of orders 12, 24, and 60. Through these solids we can see every element of an alternating or symmetric group
            enacted in three-dimensional space.
          </>}
        />
      </p>

      {/* ── Definition box ─────────────────────────────────────────────────── */}
      <div className="gt-def">
        <div className="gt-def-title"><L zh="定义：对称群" en="Definition: symmetry group" /></div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`P \subset \mathbb{R}^3`} /> 为以原点为重心的多面体。<strong>对称群</strong>{' '}
              <TeX src={String.raw`\mathrm{Sym}(P) \le O(3)`} /> 是所有将 P 映到自身的等距变换（即正交变换）之集合，
              对复合运算封闭。其中行列式为 +1 的元素构成<strong>旋转对称群</strong>{' '}
              <TeX src={String.raw`\mathrm{Rot}(P) = \mathrm{Sym}(P) \cap SO(3)`} />（指向保持，即可用刚体旋转实现）；
              行列式为 −1 的元素称为<strong>非真对称</strong>（反射、旋转反射、中心反演），不能用物理旋转实现。
              由于 P 的顶点仿射张成整个 <TeX src={String.raw`\mathbb{R}^3`} />，固定所有顶点的等距只有恒等变换，
              因此 <TeX src={String.raw`\mathrm{Sym}(P)`} /> 是有限群。
            </>}
            en={<>
              Let <TeX src={String.raw`P \subset \mathbb{R}^3`} /> be a polyhedron centred at the origin.
              The <strong>symmetry group</strong> <TeX src={String.raw`\mathrm{Sym}(P) \le O(3)`} /> consists of all
              isometries (orthogonal transformations) mapping P onto itself, closed under composition.
              The subgroup of determinant-+1 elements is the <strong>rotation symmetry group</strong>{' '}
              <TeX src={String.raw`\mathrm{Rot}(P) = \mathrm{Sym}(P) \cap SO(3)`} /> (orientation-preserving; realizable by physically rotating the solid).
              Elements with determinant −1 are <strong>improper symmetries</strong> — reflections, rotoreflections,
              and central inversion — which reverse orientation and cannot be realized by rotating the rigid solid.
              Because P's vertices affinely span <TeX src={String.raw`\mathbb{R}^3`} />, an isometry fixing every vertex
              is the identity, so <TeX src={String.raw`\mathrm{Sym}(P)`} /> is finite.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            两个多面体互为<strong>对偶</strong>，若一方的顶点对应另一方的面心（关联关系互换）。
            对偶多面体有完全相同的对称群：正方体与正八面体互为对偶，正十二面体与正二十面体互为对偶，
            正四面体自对偶。因此五种立体只对应三种不同的对称群。
          </>}
          en={<>
            Two polyhedra are <strong>dual</strong> when the vertices of one correspond to the face-centres of the other
            (incidence reversed). Dual solids have identical symmetry groups: the cube and octahedron are dual,
            as are the dodecahedron and icosahedron; the tetrahedron is self-dual. The five Platonic solids
            therefore yield exactly three distinct symmetry groups.
          </>}
        />
      </p>

      {/* ── Theorem boxes ─────────────────────────────────────────────────── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="主要定理" en="Main theorems" />
      </h3>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 A — 正四面体旋转群 ≅ A₄" en="Theorem A — Tetrahedron rotation group ≅ A₄" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <TeX src={String.raw`\mathrm{Rot}(\text{tetra}) \cong A_4`} />，阶为 12。
              该群忠实地作用于四个顶点，且恰好实现所有偶置换。
              12 个元素分解为：1 个恒等元，8 个绕顶点-面心轴的 3 阶旋转（4 条轴，每条各有 120° 和 240° 两个非平凡旋转），
              3 个绕棱中点轴的 180° 旋转（对应 3 个双对换）。
              全对称群 <TeX src={String.raw`\mathrm{Sym}(\text{tetra}) \cong S_4`} />（阶 24），而<em>不是</em>{' '}
              <TeX src={String.raw`A_4 \times C_2`} />，因为正四面体不含中心反演。
            </>}
            en={<>
              <TeX src={String.raw`\mathrm{Rot}(\text{tetra}) \cong A_4`} />, of order 12.
              The group acts faithfully on the 4 vertices, realising exactly the even permutations.
              The 12 elements: 1 identity, 8 order-3 rotations about the 4 vertex–face axes (120° and 240°),
              3 order-2 rotations about the 3 edge-midpoint axes (double transpositions).
              The full symmetry group is <TeX src={String.raw`\mathrm{Sym}(\text{tetra}) \cong S_4`} /> (order 24),
              <em>not</em> <TeX src={String.raw`A_4 \times C_2`} />, because the tetrahedron has no central inversion.
            </>}
          />
        </div>
      </div>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 B — 正方体/正八面体旋转群 ≅ S₄（经体对角线）" en="Theorem B — Cube/octahedron rotation group ≅ S₄ via body diagonals" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \cong S_4`} />，阶为 24。
              正方体有 8 个顶点，形成 4 对对径对，故有 4 条<strong>体对角线</strong>。
              每个旋转都置换这 4 条对角线，且所有 24 种置换均被实现，给出同构{' '}
              <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \xrightarrow{\sim} S_4`} />。
              全群 <TeX src={String.raw`\mathrm{Sym}(\text{cube}) \cong S_4 \times C_2`} />（阶 48），
              因为正方体含中心反演，且 <TeX src={String.raw`-I`} /> 与所有正交变换交换。
            </>}
            en={<>
              <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \cong S_4`} />, of order 24.
              The cube has 8 vertices forming 4 antipodal pairs, giving 4 <strong>body diagonals</strong>.
              Each rotation permutes these 4 diagonals, and every permutation is realised, yielding the isomorphism{' '}
              <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \xrightarrow{\sim} S_4`} />.
              The full group is <TeX src={String.raw`\mathrm{Sym}(\text{cube}) \cong S_4 \times C_2`} /> (order 48),
              since the cube is centrally symmetric and <TeX src={String.raw`-I`} /> is central in <TeX src={String.raw`O(3)`} />.
            </>}
          />
        </div>
      </div>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 C — 正二十面体/正十二面体旋转群 ≅ A₅" en="Theorem C — Icosahedron/dodecahedron rotation group ≅ A₅" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <TeX src={String.raw`\mathrm{Rot}(\text{icosa}) \cong A_5`} />，阶为 60。
              A₅ 是最小的非交换单群，正是这种单性使正二十面体在柏拉图旋转群中独一无二。
              60 个元素分解为：1 个恒等，24 个 5 阶旋转（绕 6 对对径顶点轴，每轴 72°、144°、216°、288° 四个），
              20 个 3 阶旋转（绕 10 对对径面心轴），15 个 2 阶旋转（绕 15 对对径棱中点轴）。
              全群 <TeX src={String.raw`\mathrm{Sym}(\text{icosa}) \cong A_5 \times C_2`} />（阶 120），
              与 S₅ 非同构（尽管阶数相同）。
            </>}
            en={<>
              <TeX src={String.raw`\mathrm{Rot}(\text{icosa}) \cong A_5`} />, of order 60.
              A₅ is the smallest non-abelian simple group; this simplicity makes the icosahedral rotation group unique
              among the Platonic rotation groups.
              The 60 elements: 1 identity, 24 order-5 rotations (4 each about 6 vertex-pair axes), 20 order-3 rotations
              (about 10 face-pair axes), 15 order-2 rotations (about 15 edge-pair axes).
              The full group is <TeX src={String.raw`\mathrm{Sym}(\text{icosa}) \cong A_5 \times C_2`} /> (order 120),
              which is NOT isomorphic to S₅ (same order, but A₅ × C₂ has a normal simple subgroup A₅ as a direct factor, while S₅ does not).
            </>}
          />
        </div>
      </div>

      {/* Why the direct product structure works/fails */}
      <div className="gt-aside">
        <L
          zh={<>
            <strong>直积结构的关键：</strong>当且仅当多面体含中心反演 <TeX src={String.raw`\iota: x \mapsto -x`} /> 时，
            全对称群才分解为直积 <TeX src={String.raw`\mathrm{Sym}(P) \cong \mathrm{Rot}(P) \times C_2`} />。
            原因：<TeX src={String.raw`-I`} /> 在 <TeX src={String.raw`O(3)`} /> 中是中心元素，所以
            <TeX src={String.raw`\langle \iota \rangle \cap \mathrm{Rot}(P) = \{e\}`} /> 且两者交换，
            得内直积。正方体、正八面体、正十二面体、正二十面体均含中心反演；正四面体不含，
            因此全四面体群是 S₄，而非 A₄ × C₂（两者是阶为 24 的不同的非同构群）。
          </>}
          en={<>
            <strong>Why the direct product works (or fails):</strong> the full group splits as
            <TeX src={String.raw`\mathrm{Sym}(P) \cong \mathrm{Rot}(P) \times C_2`} /> if and only if
            P contains the central inversion <TeX src={String.raw`\iota: x \mapsto -x`} />.
            The key: <TeX src={String.raw`-I`} /> is central in <TeX src={String.raw`O(3)`} />, so
            <TeX src={String.raw`\langle \iota \rangle \cap \mathrm{Rot}(P) = \{e\}`} /> and the two commute,
            giving an internal direct product. The cube, octahedron, dodecahedron, and icosahedron all contain
            central inversion; the regular tetrahedron does not — so its full group is S₄, not A₄ × C₂
            (two non-isomorphic groups of order 24: S₄ has elements of order 4, A₄ × C₂ does not).
          </>}
        />
      </div>

      {/* Summary formula */}
      <TeXBlock src={String.raw`
        \begin{array}{c|ccc}
          \text{Solid} & \mathrm{Rot}(P) & |\mathrm{Rot}| & \mathrm{Sym}(P) \\
          \hline
          \text{Tetrahedron} & A_4 & 12 & S_4 \\
          \text{Cube = Octahedron} & S_4 & 24 & S_4 \times C_2 \\
          \text{Dodecahedron = Icosahedron} & A_5 & 60 & A_5 \times C_2
        \end{array}
      `} />

      {/* Connection to the Rubik's Cube */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="与魔方的联系" en="Connection to the Rubik's Cube" />
      </h3>
      <p>
        <L
          zh={<>
            魔方建立在正方体上，因此正方体的 24 个旋转对称——即旋转群{' '}
            <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \cong S_4`} />——在魔方语境中意义具体：
            它们正是<strong>整体换向</strong>的 24 种方式（例如"白面朝上绿面朝前"等方向选择）。
            这就是为什么魔方还原定义通常固定一个方向（杀掉这个 S₄ 的自由度），
            并将魔方群定义为 "模去整体旋转"。
          </>}
          en={<>
            The Rubik's Cube is built on a cube, so the 24 rotational symmetries —
            <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \cong S_4`} /> — appear concretely:
            they are the <strong>24 ways to hold the cube in space</strong> (whole-cube reorientations,
            e.g. "white top, green front" and so on). This is why a Rubik's Cube solution typically
            fixes an orientation (eliminating this S₄ redundancy) and defines the cube group
            as the quotient by whole-cube rotations.
          </>}
        />
      </p>
      <p>
        <L
          zh={<>
            具体同构的实现：8 个角块坐落在正方体的 8 个顶点处，形成 4 对对径对，即 4 条体对角线。
            每次整体换向置换这 4 条对角线，给出{' '}
            <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \to S_4`} /> 的同构映射。
            需要区分：魔方的<strong>状态群</strong>（约 4.3 × 10¹⁹ 个状态，是 <TeX src={String.raw`S_{48}`} /> 的一个子群）
            与正方体形状的<strong>对称群</strong>（24 个整体旋转，等于 S₄）是两回事，不可混淆。
          </>}
          en={<>
            The isomorphism made concrete: the 8 corner cubies sit at the 8 cube vertices, forming
            4 antipodal pairs — the 4 body diagonals. Each whole-cube reorientation permutes these 4 diagonals,
            realising the isomorphism <TeX src={String.raw`\mathrm{Rot}(\text{cube}) \to S_4`} />.
            Important distinction: the Rubik's Cube <strong>state group</strong>
            (≈4.3 × 10¹⁹ elements, a subgroup of <TeX src={String.raw`S_{48}`} />) is entirely different
            from the cube <strong>symmetry group</strong> (24 whole-cube rotations = S₄). Do not conflate them.
          </>}
        />
      </p>

      {/* ── Interactive widgets ─────────────────────────────────────────────── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="交互式探索" en="Interactive exploration" />
      </h3>

      <CubeS4Widget />
      <TetraWidget />
      <OrbitCountWidget />

      {/* ── References ─────────────────────────────────────────────────────── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="参考文献" en="References" />
      </h3>
      <div className="gt-refs">
        <ol>
          <li>
            M. A. Armstrong, <span className="gt-ref-cite">Groups and Symmetry</span>, Springer UTM (1988), Ch. 18–19.
          </li>
          <li>
            D. S. Dummit &amp; R. M. Foote, <span className="gt-ref-cite">Abstract Algebra</span>, 3rd ed., §1.7 (cube rotations ≅ S₄), §4.6 (simplicity of A₅).
          </li>
          <li>
            Wikipedia: <a href="https://en.wikipedia.org/wiki/Octahedral_symmetry" target="_blank" rel="noopener noreferrer">Octahedral symmetry</a>{', '}
            <a href="https://en.wikipedia.org/wiki/Icosahedral_symmetry" target="_blank" rel="noopener noreferrer">Icosahedral symmetry</a>{', '}
            <a href="https://en.wikipedia.org/wiki/Tetrahedral_symmetry" target="_blank" rel="noopener noreferrer">Tetrahedral symmetry</a>.
          </li>
          <li>
            Groupprops: <a href="https://groupprops.subwiki.org/wiki/Full_tetrahedral_group_is_isomorphic_to_S4" target="_blank" rel="noopener noreferrer">Full tetrahedral group is isomorphic to S₄</a>.
          </li>
        </ol>
      </div>
    </GTSec>
  );
}
