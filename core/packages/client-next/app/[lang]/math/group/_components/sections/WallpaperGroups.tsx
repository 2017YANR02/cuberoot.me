'use client';

import { useState, useMemo, type ReactElement } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── 2×2 matrix helpers (column-major: [[a,c],[b,d]] stored as [a,b,c,d]) ─────
// We store as [m00,m10,m01,m11] i.e. row-major: row0=[m00,m01], row1=[m10,m11]
type Mat2 = [number, number, number, number]; // [m00, m01, m10, m11]
type Vec2 = [number, number];

function matMul(A: Mat2, B: Mat2): Mat2 {
  return [
    A[0] * B[0] + A[1] * B[2],
    A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2],
    A[2] * B[1] + A[3] * B[3],
  ];
}

function matEq(A: Mat2, B: Mat2, eps = 1e-7): boolean {
  return Math.abs(A[0] - B[0]) < eps && Math.abs(A[1] - B[1]) < eps &&
         Math.abs(A[2] - B[2]) < eps && Math.abs(A[3] - B[3]) < eps;
}

// rotation by angle θ
function rot(theta: number): Mat2 {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [c, -s, s, c];
}

// reflection across line at angle θ from x-axis
function refl(theta: number): Mat2 {
  const c2 = Math.cos(2 * theta), s2 = Math.sin(2 * theta);
  return [c2, s2, s2, -c2];
}

const I2: Mat2 = [1, 0, 0, 1];

// Close a set of generators (as matrices) to a finite group by repeated multiply
function closeGroup(gens: Mat2[]): Mat2[] {
  const group: Mat2[] = [I2];
  const queue: Mat2[] = [I2];
  while (queue.length > 0) {
    const g = queue.shift()!;
    for (const h of gens) {
      const gh = matMul(g, h);
      if (!group.some(x => matEq(x, gh))) {
        group.push(gh);
        queue.push(gh);
      }
    }
  }
  return group;
}

// ── Wallpaper group data table ───────────────────────────────────────────────

interface WpGroup {
  iuc: string;          // IUC (crystallographic) notation
  orbifold: string;     // Conway orbifold signature
  maxRot: number;       // maximal rotation order (1,2,3,4,6)
  hasMirror: boolean;
  hasGlide: boolean;    // glide reflection with no mirror (or glide + mirror)
  pointGroupName: string; // C1, C2, D1, D2, D3, D4, D6
  pointGroupOrder: number;
  lattice: 'oblique' | 'rectangular' | 'rhombic' | 'square' | 'hexagonal';
  // Generators for the POINT GROUP (rotations/reflections, as rotation angles & signs)
  // We derive them for the tiler below via dedicated per-group function
}

const GROUPS: WpGroup[] = [
  { iuc: 'p1',   orbifold: 'o',    maxRot: 1, hasMirror: false, hasGlide: false, pointGroupName: 'C1', pointGroupOrder: 1,  lattice: 'oblique' },
  { iuc: 'p2',   orbifold: '2222', maxRot: 2, hasMirror: false, hasGlide: false, pointGroupName: 'C2', pointGroupOrder: 2,  lattice: 'oblique' },
  { iuc: 'pm',   orbifold: '**',   maxRot: 1, hasMirror: true,  hasGlide: false, pointGroupName: 'D1', pointGroupOrder: 2,  lattice: 'rectangular' },
  { iuc: 'pg',   orbifold: '××',   maxRot: 1, hasMirror: false, hasGlide: true,  pointGroupName: 'D1', pointGroupOrder: 2,  lattice: 'rectangular' },
  { iuc: 'cm',   orbifold: '*×',   maxRot: 1, hasMirror: true,  hasGlide: true,  pointGroupName: 'D1', pointGroupOrder: 2,  lattice: 'rhombic' },
  { iuc: 'pmm',  orbifold: '*2222',maxRot: 2, hasMirror: true,  hasGlide: false, pointGroupName: 'D2', pointGroupOrder: 4,  lattice: 'rectangular' },
  { iuc: 'pmg',  orbifold: '22*',  maxRot: 2, hasMirror: true,  hasGlide: true,  pointGroupName: 'D2', pointGroupOrder: 4,  lattice: 'rectangular' },
  { iuc: 'pgg',  orbifold: '22×',  maxRot: 2, hasMirror: false, hasGlide: true,  pointGroupName: 'D2', pointGroupOrder: 4,  lattice: 'rectangular' },
  { iuc: 'cmm',  orbifold: '2*22', maxRot: 2, hasMirror: true,  hasGlide: true,  pointGroupName: 'D2', pointGroupOrder: 4,  lattice: 'rhombic' },
  { iuc: 'p4',   orbifold: '442',  maxRot: 4, hasMirror: false, hasGlide: false, pointGroupName: 'C4', pointGroupOrder: 4,  lattice: 'square' },
  { iuc: 'p4m',  orbifold: '*442', maxRot: 4, hasMirror: true,  hasGlide: false, pointGroupName: 'D4', pointGroupOrder: 8,  lattice: 'square' },
  { iuc: 'p4g',  orbifold: '4*2',  maxRot: 4, hasMirror: true,  hasGlide: true,  pointGroupName: 'D4', pointGroupOrder: 8,  lattice: 'square' },
  { iuc: 'p3',   orbifold: '333',  maxRot: 3, hasMirror: false, hasGlide: false, pointGroupName: 'C3', pointGroupOrder: 3,  lattice: 'hexagonal' },
  { iuc: 'p3m1', orbifold: '*333', maxRot: 3, hasMirror: true,  hasGlide: false, pointGroupName: 'D3', pointGroupOrder: 6,  lattice: 'hexagonal' },
  { iuc: 'p31m', orbifold: '3*3',  maxRot: 3, hasMirror: true,  hasGlide: false, pointGroupName: 'D3', pointGroupOrder: 6,  lattice: 'hexagonal' },
  { iuc: 'p6',   orbifold: '632',  maxRot: 6, hasMirror: false, hasGlide: false, pointGroupName: 'C6', pointGroupOrder: 6,  lattice: 'hexagonal' },
  { iuc: 'p6m',  orbifold: '*632', maxRot: 6, hasMirror: true,  hasGlide: false, pointGroupName: 'D6', pointGroupOrder: 12, lattice: 'hexagonal' },
];

// Compile-time check: exactly 17
const _: 17 = GROUPS.length as 17;
void _;

// ── Conway orbifold cost calculation ─────────────────────────────────────────
function conwayCost(sig: string): number {
  let cost = 0;
  let sawStar = false;
  let i = 0;
  while (i < sig.length) {
    const ch = sig[i];
    if (ch === 'o') { cost += 2; i++; continue; }
    if (ch === '×') { cost += 1; i++; continue; }
    if (ch === '*') { cost += 1; sawStar = true; i++; continue; }
    // single digit: each numeral is its own gyration/corner order
    if (ch >= '0' && ch <= '9') {
      const n = parseInt(ch, 10);
      i++;
      if (n < 1) continue;
      cost += sawStar ? (n - 1) / (2 * n) : (n - 1) / n;
      continue;
    }
    i++; // skip any unrecognized character
  }
  return cost;
}

// ── Tiler geometry: per-group lattice + isometries ───────────────────────────

interface TilerDef {
  v1: Vec2;          // first lattice basis vector (screen-space, pre-scaled)
  v2: Vec2;          // second lattice basis vector
  isos: Array<{ M: Mat2; t: Vec2 }>;  // coset representatives of point group actions
  // overlay data
  rotCenters: Array<{ pos: Vec2; order: number }>;   // relative to cell origin
  mirrorAngles: number[];   // angles (radians) of mirror lines through origin
  glideAngles:  number[];   // angles of glide reflection axes through origin
}

const PI = Math.PI;
const TAU = 2 * PI;

function makeTilerDef(group: WpGroup, cellSize: number): TilerDef {
  const s = cellSize;
  const h = s * Math.sqrt(3) / 2;

  // Helper: build isometry list by closing generators
  function isoFromPointGroup(gens: Mat2[], transls: Vec2[]): Array<{ M: Mat2; t: Vec2 }> {
    const mats = closeGroup(gens);
    const result: Array<{ M: Mat2; t: Vec2 }> = [];
    for (const M of mats) {
      for (const t of transls) {
        result.push({ M, t });
      }
    }
    return result;
  }

  switch (group.iuc) {
    case 'p1': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [s * 0.3, s * 0.85];
      return { v1, v2, isos: [{ M: I2, t: [0, 0] }], rotCenters: [], mirrorAngles: [], glideAngles: [] };
    }
    case 'p2': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [s * 0.3, s * 0.85];
      const R2 = rot(PI);
      return {
        v1, v2,
        isos: isoFromPointGroup([R2], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 2 }, { pos: [v1[0] / 2, v1[1] / 2], order: 2 },
                     { pos: [v2[0] / 2, v2[1] / 2], order: 2 }, { pos: [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2], order: 2 }],
        mirrorAngles: [], glideAngles: [],
      };
    }
    case 'pm': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      // Mirror across x-axis (y=0) and vertical axis
      const Rx = refl(0); // reflect across x-axis
      return {
        v1, v2,
        isos: isoFromPointGroup([Rx], [[0, 0]]),
        rotCenters: [],
        mirrorAngles: [0, PI / 2],
        glideAngles: [],
      };
    }
    case 'pg': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      // Glide reflection: half-translate along v1 + reflect across v2-direction
      const Rx = refl(0); // point group element (reflection)
      return {
        v1, v2,
        isos: isoFromPointGroup([Rx], [[0, 0], [v1[0] / 2, v1[1] / 2]]),
        rotCenters: [],
        mirrorAngles: [],
        glideAngles: [PI / 2],
      };
    }
    case 'cm': {
      const v1: Vec2 = [s * 0.5, s * 0.5], v2: Vec2 = [s * 0.5, -s * 0.5]; // centered: 45° lattice
      const Ry = refl(PI / 2);
      return {
        v1, v2,
        isos: isoFromPointGroup([Ry], [[0, 0], [v1[0] / 2, v1[1] / 2]]),
        rotCenters: [],
        mirrorAngles: [PI / 4, -PI / 4],
        glideAngles: [PI / 4],
      };
    }
    case 'pmm': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      const Rx = refl(0), Ry = refl(PI / 2);
      return {
        v1, v2,
        isos: isoFromPointGroup([Rx, Ry], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 2 }, { pos: [s / 2, 0], order: 2 },
                     { pos: [0, s / 2], order: 2 }, { pos: [s / 2, s / 2], order: 2 }],
        mirrorAngles: [0, PI / 2],
        glideAngles: [],
      };
    }
    case 'pmg': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      const Ry = refl(PI / 2);
      return {
        v1, v2,
        isos: isoFromPointGroup([rot(PI), Ry], [[0, 0]]),
        rotCenters: [{ pos: [s / 4, s / 2], order: 2 }, { pos: [3 * s / 4, s / 2], order: 2 }],
        mirrorAngles: [PI / 2],
        glideAngles: [0],
      };
    }
    case 'pgg': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      const Rx = refl(0);
      return {
        v1, v2,
        isos: isoFromPointGroup([rot(PI), Rx], [[0, 0], [s / 2, s / 2]]),
        rotCenters: [{ pos: [s / 4, s / 4], order: 2 }, { pos: [3 * s / 4, 3 * s / 4], order: 2 }],
        mirrorAngles: [],
        glideAngles: [0, PI / 2],
      };
    }
    case 'cmm': {
      const v1: Vec2 = [s * 0.5, s * 0.5], v2: Vec2 = [s * 0.5, -s * 0.5];
      const Rx = refl(0), Ry = refl(PI / 2);
      return {
        v1, v2,
        isos: isoFromPointGroup([Rx, Ry], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 2 }, { pos: [v1[0], v1[1]], order: 2 }],
        mirrorAngles: [PI / 4, -PI / 4],
        glideAngles: [0, PI / 2],
      };
    }
    case 'p4': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      const R4 = rot(PI / 2);
      return {
        v1, v2,
        isos: isoFromPointGroup([R4], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 4 }, { pos: [s / 2, s / 2], order: 2 },
                     { pos: [s / 2, 0], order: 2 }, { pos: [0, s / 2], order: 2 }],
        mirrorAngles: [],
        glideAngles: [],
      };
    }
    case 'p4m': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      const R4 = rot(PI / 2), Rx = refl(0);
      return {
        v1, v2,
        isos: isoFromPointGroup([R4, Rx], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 4 }, { pos: [s / 2, s / 2], order: 4 }],
        mirrorAngles: [0, PI / 4, PI / 2, 3 * PI / 4],
        glideAngles: [],
      };
    }
    case 'p4g': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      const R4 = rot(PI / 2), Rx = refl(0);
      return {
        v1, v2,
        isos: isoFromPointGroup([R4, Rx], [[0, 0], [s / 2, s / 2]]),
        rotCenters: [{ pos: [0, 0], order: 4 }, { pos: [s / 2, s / 2], order: 2 }],
        mirrorAngles: [0, PI / 2],
        glideAngles: [PI / 4, -PI / 4],
      };
    }
    case 'p3': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [s / 2, h];
      const R3 = rot(TAU / 3);
      return {
        v1, v2,
        isos: isoFromPointGroup([R3], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 3 }, { pos: [v1[0] / 3 + v2[0] / 3, v1[1] / 3 + v2[1] / 3], order: 3 },
                     { pos: [2 * v1[0] / 3 + 2 * v2[0] / 3, 2 * v1[1] / 3 + 2 * v2[1] / 3], order: 3 }],
        mirrorAngles: [],
        glideAngles: [],
      };
    }
    case 'p3m1': {
      // All 3-fold centers lie ON mirrors
      const v1: Vec2 = [s, 0], v2: Vec2 = [s / 2, h];
      const R3 = rot(TAU / 3), Rx = refl(0);
      const cx = (v1[0] + v2[0]) / 3, cy = (v1[1] + v2[1]) / 3;
      return {
        v1, v2,
        isos: isoFromPointGroup([R3, Rx], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 3 }, { pos: [cx, cy], order: 3 }, { pos: [2 * cx, 2 * cy], order: 3 }],
        mirrorAngles: [0, PI / 3, 2 * PI / 3],
        glideAngles: [],
      };
    }
    case 'p31m': {
      // Some 3-fold centers NOT on mirrors; mirrors in a different direction
      const v1: Vec2 = [s, 0], v2: Vec2 = [s / 2, h];
      const R3 = rot(TAU / 3), Rx = refl(PI / 6); // mirrors at 30° (rotated 30° from p3m1)
      const cx = (v1[0] + v2[0]) / 3, cy = (v1[1] + v2[1]) / 3;
      return {
        v1, v2,
        isos: isoFromPointGroup([R3, Rx], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 3 }, { pos: [cx, cy], order: 3 }],
        mirrorAngles: [PI / 6, PI / 2, 5 * PI / 6],
        glideAngles: [],
      };
    }
    case 'p6': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [s / 2, h];
      const R6 = rot(PI / 3);
      return {
        v1, v2,
        isos: isoFromPointGroup([R6], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 6 }, { pos: [v1[0] / 2, v1[1] / 2], order: 2 },
                     { pos: [(v1[0] + v2[0]) / 3, (v1[1] + v2[1]) / 3], order: 3 }],
        mirrorAngles: [],
        glideAngles: [],
      };
    }
    case 'p6m': {
      const v1: Vec2 = [s, 0], v2: Vec2 = [s / 2, h];
      const R6 = rot(PI / 3), Rx = refl(0);
      return {
        v1, v2,
        isos: isoFromPointGroup([R6, Rx], [[0, 0]]),
        rotCenters: [{ pos: [0, 0], order: 6 }, { pos: [v1[0] / 2, v1[1] / 2], order: 2 },
                     { pos: [(v1[0] + v2[0]) / 3, (v1[1] + v2[1]) / 3], order: 3 }],
        mirrorAngles: [0, PI / 6, PI / 3, PI / 2, 2 * PI / 3, 5 * PI / 6],
        glideAngles: [],
      };
    }
    default: {
      const v1: Vec2 = [s, 0], v2: Vec2 = [0, s];
      return { v1, v2, isos: [{ M: I2, t: [0, 0] }], rotCenters: [], mirrorAngles: [], glideAngles: [] };
    }
  }
}

// ── Asymmetric motif path generator ──────────────────────────────────────────
// Returns an SVG path d string for a comma/teardrop centred at origin
function motifPath(asymmetry: number): string {
  // interpolate from circle (asym=0) to comma/flag (asym=1)
  const a = asymmetry;
  const r = 8;
  const tail = 14 * a;
  const lean = 4 * a;
  // Approximate: a curved teardrop
  const mx = lean, my = -tail;
  return `M 0 ${-r}
    C ${r + lean * 0.5} ${-r * 0.3 + my * 0.1} ${r} ${r * 0.5} 0 ${r}
    C ${-r * 0.5} ${r * 0.5} ${mx - r} ${my * 0.5 + r * 0.5} ${mx} ${my}
    C ${mx + lean * 0.3} ${my - r * 0.4} ${lean * 0.2} ${-r * 1.3} 0 ${-r}
    Z`;
}

// ── Rotation center marker ────────────────────────────────────────────────────
function RotMarker({ x, y, order, size = 7 }: { x: number; y: number; order: number; size?: number }) {
  const s = size;
  const color = order === 6 ? '#B8860B' : order === 4 ? '#2A4D69' : order === 3 ? '#3F7050' : '#8B2E3C';
  if (order === 2) {
    // digon (lens / elongated diamond)
    return <ellipse cx={x} cy={y} rx={s * 0.6} ry={s * 1.1} fill={color} fillOpacity={0.85} stroke="none" />;
  }
  if (order === 3) {
    const pts = [0, 1, 2].map(k => {
      const a = -PI / 2 + (k * TAU) / 3;
      return `${x + s * Math.cos(a)},${y + s * Math.sin(a)}`;
    }).join(' ');
    return <polygon points={pts} fill={color} fillOpacity={0.85} stroke="none" />;
  }
  if (order === 4) {
    const pts = [0, 1, 2, 3].map(k => {
      const a = -PI / 4 + (k * TAU) / 4;
      return `${x + s * Math.cos(a)},${y + s * Math.sin(a)}`;
    }).join(' ');
    return <polygon points={pts} fill={color} fillOpacity={0.85} stroke="none" />;
  }
  if (order === 6) {
    const pts = [0, 1, 2, 3, 4, 5].map(k => {
      const a = -PI / 2 + (k * TAU) / 6;
      return `${x + s * Math.cos(a)},${y + s * Math.sin(a)}`;
    }).join(' ');
    return <polygon points={pts} fill={color} fillOpacity={0.85} stroke="none" />;
  }
  return null;
}

// ── Group Tiler Widget ─────────────────────────────────────────────────────
function GroupTiler() {
  const lang = useLang();
  const [groupIdx, setGroupIdx] = useState(10); // p4m default
  const [asymmetry, setAsymmetry] = useState(0.65);
  const [showRot, setShowRot] = useState(true);
  const [showMirror, setShowMirror] = useState(true);
  const [showGlide, setShowGlide] = useState(true);
  const [cellCount, setCellCount] = useState(3);

  const group = GROUPS[groupIdx];
  const W = 480, H = 380;
  const cellSize = Math.max(36, Math.min(80, Math.floor(Math.min(W, H) / (cellCount * 2 + 1))));

  const tilerDef = useMemo(() => makeTilerDef(group, cellSize), [group, cellSize]);
  const motif = useMemo(() => motifPath(asymmetry), [asymmetry]);

  const cx = W / 2, cy = H / 2;
  const N = cellCount;

  // Accent color per group category
  const accentColor = group.hasMirror ? 'var(--accent)' : 'var(--accent-2)';

  // Build all placements: for each lattice cell, for each point-group isometry
  const placements = useMemo(() => {
    const result: string[] = [];
    const { v1, v2, isos } = tilerDef;
    for (let i = -N; i <= N; i++) {
      for (let j = -N; j <= N; j++) {
        const tx0 = i * v1[0] + j * v2[0];
        const ty0 = i * v1[1] + j * v2[1];
        for (const { M, t } of isos) {
          // final translation = M * (i*v1 + j*v2) + t ... wait, we want:
          // place the UNIT CELL at (i,j), apply isometry within cell
          // transform: T(cell) composed with isometry(M,t_local)
          // SVG matrix: a=M00 b=M10 c=M01 d=M11 e=tx f=ty
          const a = M[0], b = M[2], c = M[1], d = M[3];
          const e = tx0 + t[0] + cx;
          const f = ty0 + t[1] + cy;
          result.push(`matrix(${a},${b},${c},${d},${e},${f})`);
        }
      }
    }
    return result;
  }, [tilerDef, N, cx, cy]);

  // Build overlay lines
  const overlayLines = useMemo(() => {
    const { v1, v2, mirrorAngles, glideAngles, rotCenters } = tilerDef;
    const lineLen = Math.max(W, H) * 2;
    const lines: ReactElement[] = [];
    let key = 0;

    if (showMirror) {
      for (let i = -N; i <= N; i++) {
        for (let j = -N; j <= N; j++) {
          const ox = cx + i * v1[0] + j * v2[0];
          const oy = cy + i * v1[1] + j * v2[1];
          for (const angle of mirrorAngles) {
            const dx = Math.cos(angle) * lineLen, dy = Math.sin(angle) * lineLen;
            lines.push(
              <line key={`m${key++}`} x1={ox - dx} y1={oy - dy} x2={ox + dx} y2={oy + dy}
                stroke="var(--accent)" strokeWidth={1} strokeOpacity={0.35} />
            );
          }
        }
      }
    }
    if (showGlide) {
      for (let i = -N; i <= N; i++) {
        for (let j = -N; j <= N; j++) {
          const ox = cx + i * v1[0] + j * v2[0];
          const oy = cy + i * v1[1] + j * v2[1];
          for (const angle of glideAngles) {
            const dx = Math.cos(angle) * lineLen, dy = Math.sin(angle) * lineLen;
            lines.push(
              <line key={`g${key++}`} x1={ox - dx} y1={oy - dy} x2={ox + dx} y2={oy + dy}
                stroke="var(--green)" strokeWidth={1} strokeOpacity={0.4}
                strokeDasharray="6 4" />
            );
          }
        }
      }
    }
    if (showRot) {
      for (let i = -N; i <= N; i++) {
        for (let j = -N; j <= N; j++) {
          const ox = cx + i * v1[0] + j * v2[0];
          const oy = cy + i * v1[1] + j * v2[1];
          for (const rc of rotCenters) {
            lines.push(
              <RotMarker key={`r${key++}`} x={ox + rc.pos[0]} y={oy + rc.pos[1]} order={rc.order} />
            );
          }
        }
      }
    }
    return lines;
  }, [tilerDef, showMirror, showGlide, showRot, N, cx, cy]);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="互动 — 墙纸群贴砖器" en="Interactive — Group Tiler" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>选择一个墙纸群,看单个非对称图案如何被群的等距变换复制,铺满整个平面并揭示其对称性。</>}
          en={<>Pick a wallpaper group; watch a single asymmetric motif, replicated under all isometries, tile the plane and reveal the group's symmetry.</>}
        />
      </p>
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', minWidth: 48 }}>
          <L zh="群" en="group" />
        </label>
        <select
          className="gt-input"
          value={groupIdx}
          onChange={e => setGroupIdx(Number(e.target.value))}
          style={{ maxWidth: 240 }}
        >
          {GROUPS.map((g, i) => (
            <option key={g.iuc} value={i}>{g.iuc}  ({g.orbifold})</option>
          ))}
        </select>
      </div>
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', minWidth: 80 }}>
          <L zh="非对称度" en="asymmetry" />
        </label>
        <input type="range" min={0} max={1} step={0.01} value={asymmetry}
          onChange={e => setAsymmetry(Number(e.target.value))}
          style={{ flex: 1, minWidth: 100, maxWidth: 220 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', minWidth: 36 }}>
          {Math.round(asymmetry * 100)}%
        </span>
      </div>
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', minWidth: 80 }}>
          <L zh="格网格数" en="cell count" />
        </label>
        <input type="range" min={1} max={5} step={1} value={cellCount}
          onChange={e => setCellCount(Number(e.target.value))}
          style={{ flex: 1, minWidth: 80, maxWidth: 160 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', minWidth: 24 }}>{cellCount}</span>
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className={`gt-chip ${showRot ? 'gt-chip-active' : ''}`} onClick={() => setShowRot(v => !v)}>
          <L zh="旋转中心" en="rot centers" />
        </span>
        <span className={`gt-chip ${showMirror ? 'gt-chip-active' : ''}`} onClick={() => setShowMirror(v => !v)}>
          <L zh="镜像线 (实线)" en="mirrors (solid)" />
        </span>
        <span
          className={`gt-chip ${showGlide && group.hasGlide ? 'gt-chip-active' : ''}`}
          onClick={() => setShowGlide(v => !v)}
          style={{ opacity: group.hasGlide ? 1 : 0.4 }}
        >
          <L zh="滑移线 (虚线)" en="glide lines (dashed)" />
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', background: 'var(--bg-deep)', borderRadius: 4, marginTop: 8, overflow: 'hidden', maxWidth: W }}>
        {/* Motif copies */}
        <g>
          {placements.map((transform, idx) => (
            <path
              key={idx}
              d={motif}
              transform={transform}
              fill={accentColor}
              fillOpacity={0.55}
              stroke="var(--bg)"
              strokeWidth={0.5}
            />
          ))}
        </g>
        {/* Overlay */}
        <g>{overlayLines}</g>
        {/* Legend marker for mirror vs glide */}
        {(group.hasMirror || group.hasGlide) && (
          <g transform={`translate(${W - 130}, ${H - 50})`}>
            {group.hasMirror && (
              <>
                <line x1={0} y1={8} x2={36} y2={8} stroke="var(--accent)" strokeWidth={1.5} strokeOpacity={0.8} />
                <text x={42} y={12} fontSize={9} fill="var(--ink-faint)" fontFamily="var(--mono)">mirror</text>
              </>
            )}
            {group.hasGlide && (
              <>
                <line x1={0} y1={24} x2={36} y2={24} stroke="var(--green)" strokeWidth={1.5} strokeOpacity={0.8} strokeDasharray="5 3" />
                <text x={42} y={28} fontSize={9} fill="var(--ink-faint)" fontFamily="var(--mono)">glide</text>
              </>
            )}
          </g>
        )}
      </svg>

      <div className="gt-panel-result" style={{ marginTop: 12 }}>
        <div className="gt-result-row">
          <div className="gt-result-label">IUC / Orbifold</div>
          <div className="gt-result-val-strong">{group.iuc} / {group.orbifold}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label"><L zh="点群" en="point group" /></div>
          <div className="gt-result-val">{group.pointGroupName}  (|P| = {group.pointGroupOrder})</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label"><L zh="格类型" en="lattice" /></div>
          <div className="gt-result-val">{group.lattice}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label"><L zh="最大旋转阶数" en="max rotation order" /></div>
          <div className="gt-result-val">{group.maxRot}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label"><L zh="有镜像线" en="has mirrors" /></div>
          <div className="gt-result-val" style={{ color: group.hasMirror ? 'var(--green)' : 'var(--ink-faint)' }}>
            {group.hasMirror ? (tr({ zh: '是', en: 'yes' })) : (tr({ zh: '否', en: 'no' }))}
          </div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label"><L zh="有滑移反射" en="has glide refl" /></div>
          <div className="gt-result-val" style={{ color: group.hasGlide ? 'var(--green)' : 'var(--ink-faint)' }}>
            {group.hasGlide ? (tr({ zh: '是', en: 'yes' })) : (tr({ zh: '否', en: 'no' }))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Crystallographic Restriction Dial ─────────────────────────────────────────
function RestrictionDial() {
  const lang = useLang();
  const [n, setN] = useState(4);

  const trace = 2 * Math.cos((2 * Math.PI) / n);
  const isInteger = Math.abs(trace - Math.round(trace)) < 1e-8;
  const allowed = isInteger;

  // Draw a unit square lattice and the rotated vector
  const W = 320, H = 260;
  const gridCx = W / 2, gridCy = H / 2 + 10;
  const scale = 60; // pixels per unit
  const cols = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B'];

  // lattice dots
  const dots: ReactElement[] = [];
  for (let di = -2; di <= 2; di++) {
    for (let dj = -2; dj <= 2; dj++) {
      dots.push(
        <circle
          key={`d${di}_${dj}`}
          cx={gridCx + di * scale}
          cy={gridCy - dj * scale}
          r={2.5}
          fill="var(--ink-faint)"
          fillOpacity={0.5}
        />
      );
    }
  }

  // Original vector: e1 = (1, 0) = scale units right
  const ox = gridCx, oy = gridCy;
  const vx = scale, vy = 0;

  // Rotated vector
  const theta = (2 * Math.PI) / n;
  const rvx = vx * Math.cos(theta) - vy * Math.sin(theta);
  const rvy = vx * Math.sin(theta) + vy * Math.cos(theta);

  // Endpoint
  const ex = ox + vx, ey = oy - vy; // original tip
  const rex = ox + rvx, rey = oy - rvy; // rotated tip

  // "On lattice" test: solve (rvx, rvy) = a*(scale,0) + b*(0,scale)
  const a = rvx / scale;
  const b = rvy / scale;
  const onLattice = Math.abs(a - Math.round(a)) < 0.01 && Math.abs(b - Math.round(b)) < 0.01;

  // arrow head helper
  function arrowTip(x1: number, y1: number, x2: number, y2: number, size = 7): string {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const px = -uy, py = ux;
    return [
      `${x2},${y2}`,
      `${x2 - size * ux + size * 0.45 * px},${y2 - size * uy + size * 0.45 * py}`,
      `${x2 - size * ux - size * 0.45 * px},${y2 - size * uy - size * 0.45 * py}`,
    ].join(' ');
  }

  const traceStr = trace.toFixed(5);
  const traceRounded = Math.round(trace * 1000) / 1000;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="互动 — 晶体学限制拨盘" en="Interactive — Crystallographic Restriction Dial" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>旋转格点向量后,端点必须落在格点上 (整数坐标),迹 <TeX src={String.raw`2\cos\theta`} /> 必须是整数。只有 <TeX src={String.raw`n\in\{1,2,3,4,6\}`} /> 满足此条件。</>}
          en={<>After rotating a lattice vector by <TeX src={String.raw`2\pi/n`} />, the tip must land on a lattice point; this forces the trace <TeX src={String.raw`2\cos(2\pi/n)`} /> to be an integer. Only <TeX src={String.raw`n\in\{1,2,3,4,6\}`} /> pass.</>}
        />
      </p>
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', minWidth: 32 }}>n =</label>
        <input type="range" min={1} max={12} step={1} value={n}
          onChange={e => setN(Number(e.target.value))}
          style={{ flex: 1, minWidth: 100, maxWidth: 240 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600,
          color: allowed ? 'var(--green)' : 'var(--warn)', minWidth: 24 }}>{n}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', background: 'var(--bg-deep)', borderRadius: 4, marginTop: 4, maxWidth: W }}>
        {dots}
        {/* Original vector */}
        <line x1={ox} y1={oy} x2={ex} y2={ey} stroke={cols[1]} strokeWidth={2} strokeOpacity={0.7} />
        <polygon points={arrowTip(ox, oy, ex, ey)} fill={cols[1]} fillOpacity={0.8} />
        {/* Arc */}
        {n > 1 && (
          <path
            d={`M ${ox + scale * 0.35} ${oy} A ${scale * 0.35} ${scale * 0.35} 0 ${Math.abs(theta) > Math.PI ? 1 : 0} 0 ${ox + scale * 0.35 * Math.cos(theta)} ${oy - scale * 0.35 * Math.sin(theta)}`}
            fill="none" stroke="var(--ink-dim)" strokeWidth={1} strokeDasharray="3 2"
          />
        )}
        {/* Rotated vector */}
        <line x1={ox} y1={oy} x2={rex} y2={rey} stroke={cols[0]} strokeWidth={2.5} />
        <polygon points={arrowTip(ox, oy, rex, rey)} fill={cols[0]} />
        {/* Origin */}
        <circle cx={ox} cy={oy} r={4} fill="var(--ink)" />
        {/* Rotated tip marker */}
        <circle cx={rex} cy={rey} r={5} fill={onLattice ? cols[2] : cols[3]}
          stroke="var(--bg)" strokeWidth={1.5} />
        {/* angle label */}
        <text x={ox + scale * 0.38 * Math.cos(theta / 2) + 3} y={oy - scale * 0.38 * Math.sin(theta / 2) - 2}
          fontSize={10} fill="var(--ink-faint)" fontFamily="var(--mono)" textAnchor="middle">
          {n === 1 ? '0°' : `360°/${n}`}
        </text>
        {/* on/off lattice label */}
        <text x={rex + 8} y={rey + 4} fontSize={10} fontFamily="var(--mono)"
          fill={onLattice ? cols[2] : cols[3]}>
          {onLattice ? (tr({ zh: '在格点', en: 'on lattice',
              zhHant: "在格點"
        })) : (tr({ zh: '不在格点', en: 'off lattice',
            zhHant: "不在格點"
        }))}
        </text>
      </svg>

      <div className="gt-panel-result" style={{ marginTop: 12 }}>
        <div className="gt-result-row">
          <div className="gt-result-label"><TeX src={String.raw`2\cos(2\pi/n)`} /></div>
          <div className="gt-result-val">{traceStr}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label"><L zh="是否为整数" en="integer?" /></div>
          <div className="gt-result-val" style={{ color: allowed ? 'var(--green)' : 'var(--warn)', fontWeight: 600 }}>
            {allowed
              ? `${tr({ zh: '是', en: 'yes' })} (= ${traceRounded})`
              : `${tr({ zh: '否', en: 'no' })} (≈ ${traceStr.slice(0, 7)})`}
          </div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label"><L zh="允许的旋转阶" en="allowed rotation order" /></div>
          <div className="gt-result-val" style={{ color: allowed ? 'var(--green)' : 'var(--warn)', fontWeight: 600 }}>
            {allowed
              ? (lang === 'zh' ? `n=${n} 允许` : `n=${n} allowed`)
              : (lang === 'zh' ? `n=${n} 禁止` : `n=${n} forbidden`)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Orbifold Cost Calculator ────────────────────────────────────────────────
interface CostBreakdown {
  ch: string;
  cost: number;
  label: string;
}

function parseCostBreakdown(sig: string): { items: CostBreakdown[]; total: number } {
  const items: CostBreakdown[] = [];
  let sawStar = false;
  let total = 0;
  let i = 0;
  while (i < sig.length) {
    const ch = sig[i];
    if (ch === 'o') {
      items.push({ ch: 'o', cost: 2, label: 'torus / o' });
      total += 2; i++; continue;
    }
    if (ch === '×') {
      items.push({ ch: '×', cost: 1, label: 'cross-cap / ×' });
      total += 1; i++; continue;
    }
    if (ch === '*') {
      items.push({ ch: '*', cost: 1, label: 'mirror boundary / *' });
      sawStar = true; total += 1; i++; continue;
    }
    if (ch >= '0' && ch <= '9') {
      const n = parseInt(ch, 10);
      i++;
      if (n < 1) continue;
      const cost = sawStar ? (n - 1) / (2 * n) : (n - 1) / n;
      const label = sawStar
        ? `corner ${n} / (${n}−1)/(2×${n})`
        : `gyration ${n} / (${n}−1)/${n}`;
      items.push({ ch: String(n), cost, label });
      total += cost;
      continue;
    }
    i++; // skip any unrecognized character
  }
  return { items, total };
}

function OrbifoldCalculator() {
  const lang = useLang();
  const [sigIdx, setSigIdx] = useState(10); // p4m default
  const [custom, setCustom] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const sig = useCustom ? custom : (GROUPS[sigIdx]?.orbifold ?? '');
  const { items, total } = useMemo(() => parseCostBreakdown(sig), [sig]);
  const eps = 1e-8;
  const verdict = Math.abs(total - 2) < eps ? 'wallpaper' : total < 2 ? 'spherical' : 'hyperbolic';

  const verdictZh = verdict === 'wallpaper' ? '墙纸群' : verdict === 'hyperbolic' ? '双曲群' : '球面群';
  const verdictColor = verdict === 'wallpaper' ? 'var(--green)' : verdict === 'hyperbolic' ? 'var(--accent-2)' : 'var(--accent)';
  const verdictSymbol = verdict === 'wallpaper' ? 'χ = 0' : verdict === 'hyperbolic' ? 'χ < 0' : 'χ > 0';

  // Compute the orbifold Euler characteristic: χ = 2 - cost (cost = 2 - χ; wallpaper ↔ χ=0)
  const chi = 2 - total;

  // Quick-access non-wallpaper examples
  const extras = [
    { label: '532 (icosahedral)', sig: '532' },
    { label: '*532 (full icosah.)', sig: '*532' },
    { label: '2345 (hyperbolic)', sig: '2345' },
    { label: '23 (tetrahedral)', sig: '23' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="互动 — 轨形费用计算器 (魔法定理)" en="Interactive — Orbifold Cost Calculator (Magic Theorem)" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>Conway 魔法定理:任何 2D 对称群的轨形签名费用之和恰好为 2 当且仅当该群是墙纸群 (轨形 Euler 特征标 <TeX src={String.raw`\chi=0`} />)。</>}
          en={<>Conway's Magic Theorem: an orbifold signature has total cost exactly 2 if and only if it is a wallpaper group (orbifold Euler characteristic <TeX src={String.raw`\chi=0`} />).</>}
        />
      </p>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap' }}>
        <span className={`gt-chip ${!useCustom ? 'gt-chip-active' : ''}`} onClick={() => setUseCustom(false)}>
          <L zh="17 群" en="17 groups" />
        </span>
        <span className={`gt-chip ${useCustom ? 'gt-chip-active' : ''}`} onClick={() => setUseCustom(true)}>
          <L zh="自定义" en="custom" />
        </span>
      </div>
      {!useCustom ? (
        <div className="gt-panel-input-row">
          <select className="gt-input" value={sigIdx} onChange={e => setSigIdx(Number(e.target.value))} style={{ maxWidth: 240 }}>
            {GROUPS.map((g, i) => (
              <option key={g.iuc} value={i}>{g.iuc}: {g.orbifold}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input className="gt-input" value={custom} onChange={e => setCustom(e.target.value)}
            placeholder="e.g. 532, 2222, *442" style={{ maxWidth: 200 }} />
          {extras.map(ex => (
            <span key={ex.sig} className="gt-chip" onClick={() => setCustom(ex.sig)}>
              {ex.label}
            </span>
          ))}
        </div>
      )}

      {/* Cost breakdown table */}
      <div style={{ margin: '16px 0', overflowX: 'auto' }}>
        <table className="gt-compare" style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th><L zh="字符" en="char" /></th>
              <th><L zh="含义" en="meaning" /></th>
              <th style={{ textAlign: 'right' }}><L zh="费用" en="cost" /></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={3} style={{ color: 'var(--ink-faint)', textAlign: 'center', padding: '8px 0' }}>
                <L zh="(空签名)" en="(empty signature)" />
              </td></tr>
            ) : items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>{item.ch}</td>
                <td style={{ color: 'var(--ink-dim)', fontSize: 12 }}>{item.label}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink)' }}>
                  {item.cost === Math.floor(item.cost) ? item.cost : item.cost.toFixed(6)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--rule)' }}>
              <td colSpan={2} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', paddingTop: 8 }}>
                <L zh="合计" en="total cost" />
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700,
                color: verdictColor, fontSize: 15, paddingTop: 8 }}>
                {total.toFixed(6)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: 'center', padding: '14px 16px', borderRadius: 4, background: 'var(--bg-deep)',
        border: `1px solid ${verdictColor}`, marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: verdictColor }}>
          {verdictSymbol}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginLeft: 12 }}>
          {lang === 'zh' ? verdictZh : verdict}
          {verdict === 'wallpaper' ? (tr({ zh: ' — 是墙纸群', en: ' — valid wallpaper group',
              zhHant: " — 是牆紙群"
        })) :
           verdict === 'spherical' ? (tr({ zh: ' — 球面 / 多面体群', en: ' — spherical / polyhedral',
               zhHant: " — 球面 / 多面體群"
        })) :
           (tr({ zh: ' — 双曲平面群', en: ' — hyperbolic plane group',
               zhHant: " — 雙曲平面群"
        }))}
        </span>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
          χ = 2 − cost = {chi.toFixed(6)}
        </div>
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export default function WallpaperGroups() {
  const lang = useLang();

  // Verify all 17 orbifold signatures sum to exactly 2 (self-check in render)
  const allCostsOk = useMemo(() =>
    GROUPS.every(g => Math.abs(conwayCost(g.orbifold) - 2) < 1e-8),
  []);

  return (
    <GTSec id="wallpaper-groups" className="gt-sec">
      <div className="gt-sec-num">§44</div>
      <h2 className="gt-sec-title">
        <L zh="十七种墙纸群" en="The 17 wallpaper groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            用重复花纹装饰墙壁、地砖或织物时,设计师面对一个数学上严格穷举过的选择清单:平面的周期性对称群,恰好只有 <strong>17 种</strong>。这一结论由叶夫格拉夫·费多罗夫于 1891 年首先给出,后经格奥尔格·波利亚于 1924 年独立验证。本节将解释为何恰好是 17 种,为何五重对称在格点中被禁止,以及这一切与魔方的三维旋转轴如何共用同一套晶体学定理。
          </>}
          en={<>
            When decorating a wall, a floor, or a fabric with a repeating pattern, the designer faces a mathematically exhaustive menu: the periodic symmetry groups of the plane are, in total, exactly <strong>17</strong>. This was first proven by Evgraf Fedorov in 1891 and independently confirmed by Georg Pólya in 1924. This section explains why the count is exactly 17, why five-fold symmetry is forbidden in a lattice, and how this connects to the Rubik's cube's three-dimensional rotation axes through the very same crystallographic theorem.
          </>}
        />
      </p>

      {/* ── Definition box: Wallpaper group ── */}
      <div className="gt-def">
        <div className="gt-def-title"><L zh="定义 — 墙纸群 (平面晶体学群)" en="Definition — Wallpaper group (2D crystallographic group)" /></div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`E(2) = O(2) \ltimes \mathbb{R}^2`} /> 为欧氏平面的等距变换群。<strong>墙纸群</strong>是 <TeX src={String.raw`E(2)`} /> 的一个子群 <TeX src={String.raw`G`} />,其平移子群 <TeX src={String.raw`T(G) = G \cap \mathbb{R}^2`} /> 是秩 2 的格 (即含两个线性无关的平移生成元,图案在两个非平行方向上周期重复)。<em>离散性</em>要求任何轨道中不同点之间存在最小正距离,且最小非零旋转角有正下界 — 这正是排除连续对称性的条件。
              <TeXBlock src={String.raw`G \leq E(2),\quad T(G) \cong \mathbb{Z}^2.`} />
            </>}
            en={<>
              Let <TeX src={String.raw`E(2) = O(2) \ltimes \mathbb{R}^2`} /> be the isometry group of the Euclidean plane. A <strong>wallpaper group</strong> is a subgroup <TeX src={String.raw`G \leq E(2)`} /> whose translation subgroup <TeX src={String.raw`T(G) = G \cap \mathbb{R}^2`} /> is a rank-2 lattice (two linearly independent translation generators, so the pattern repeats in two non-parallel directions). <em>Discreteness</em> requires a minimum distance between distinct points in any orbit and a minimum nonzero rotation angle — exactly the condition that rules out continuous symmetry.
              <TeXBlock src={String.raw`G \leq E(2),\quad T(G) \cong \mathbb{Z}^2.`} />
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            墙纸群 <TeX src={String.raw`G`} /> 的<strong>点群</strong> <TeX src={String.raw`P = G/T`} /> 是 <TeX src={String.raw`O(2)`} /> 的有限子群,由晶体学限制定理约束,只能是以下 10 个二维晶体学点群之一:循环群 <TeX src={String.raw`C_1, C_2, C_3, C_4, C_6`} /> 以及二面群 <TeX src={String.raw`D_1, D_2, D_3, D_4, D_6`} />。结合格类型 (5 种布拉维格) 与滑移反射结构,17 个群由此穷举。
          </>}
          en={<>
            The <strong>point group</strong> <TeX src={String.raw`P = G/T`} /> of a wallpaper group is a finite subgroup of <TeX src={String.raw`O(2)`} />, constrained by the crystallographic restriction to be one of exactly 10 two-dimensional crystallographic point groups: the cyclic groups <TeX src={String.raw`C_1, C_2, C_3, C_4, C_6`} /> and dihedral groups <TeX src={String.raw`D_1, D_2, D_3, D_4, D_6`} />. Combined with the 5 planar Bravais lattice types and the glide-reflection structure, the 17 groups are exhausted.
          </>}
        />
      </p>

      {/* ── Theorem: Classification ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 — 墙纸群分类 (Fedorov 1891; Pólya 1924)" en="Theorem — Classification of wallpaper groups (Fedorov 1891; Pólya 1924)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              在仿射等价意义下,恰好存在 <strong>17 个</strong>墙纸群。以 IUC (国际晶体学短) 符号标记,它们是:
              <span className="gt-mono" style={{ display: 'inline-block', marginTop: 6, lineHeight: 1.8, color: 'var(--accent)' }}>
                p1, p2, pm, pg, cm, pmm, pmg, pgg, cmm, p4, p4m, p4g, p3, p3m1, p31m, p6, p6m
              </span>
            </>}
            en={<>
              Up to affine equivalence there are exactly <strong>17</strong> wallpaper groups. In IUC (crystallographic short) notation they are:
              <span className="gt-mono" style={{ display: 'inline-block', marginTop: 6, lineHeight: 1.8, color: 'var(--accent)' }}>
                p1, p2, pm, pg, cm, pmm, pmg, pgg, cmm, p4, p4m, p4g, p3, p3m1, p31m, p6, p6m
              </span>
            </>}
          />
          {allCostsOk && (
            <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)' }}>
              <L zh="[代码自检: 全部 17 个 Conway 签名费用均为 2.000 ✓]" en="[self-check: all 17 Conway signature costs = 2.000 ✓]" />
            </div>
          )}
        </div>
      </div>

      {/* ── Theorem: Crystallographic restriction ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="晶体学限制定理" en="The crystallographic restriction theorem" />
      </h3>

      <p>
        <L
          zh={<>
            为何五重旋转在格点上被禁止?令旋转 <TeX src={String.raw`R`} /> 保持格不变。取格的基底 <TeX src={String.raw`\{v_1, v_2\}`} />,则 <TeX src={String.raw`R`} /> 在此基底下的矩阵含整数元 (因格封闭)。矩阵的迹与基底无关,在直交基底下旋转角 <TeX src={String.raw`\theta`} /> 的迹等于 <TeX src={String.raw`2\cos\theta`} />。因此 <TeX src={String.raw`2\cos\theta \in \mathbb{Z}`} />。
          </>}
          en={<>
            Why is five-fold rotation impossible in a lattice? Let rotation <TeX src={String.raw`R`} /> preserve the lattice. Taking the lattice basis <TeX src={String.raw`\{v_1, v_2\}`} />, the matrix of <TeX src={String.raw`R`} /> in that basis has integer entries (since the lattice is closed under <TeX src={String.raw`R`} />). The trace is basis-independent, and in an orthonormal basis a rotation by <TeX src={String.raw`\theta`} /> has trace <TeX src={String.raw`2\cos\theta`} />. Therefore:
          </>}
        />
      </p>

      <TeXBlock src={String.raw`2\cos\theta \in \mathbb{Z},\quad -1\le\cos\theta\le 1 \implies 2\cos\theta\in\{-2,-1,0,1,2\}.`} />

      <p>
        <L
          zh={<>
            仅有的解是 <TeX src={String.raw`\theta \in \{0°, 60°, 90°, 120°, 180°\}`} />,对应旋转阶 <TeX src={String.raw`n \in \{1, 6, 4, 3, 2\}`} />。对于 <TeX src={String.raw`n=5`} />:
            <TeX src={String.raw`2\cos(72°) = \tfrac{\sqrt{5}-1}{2} \approx 0.618`} />,不是整数,故禁止。在下面的"晶体学限制拨盘"中可以直观验证这一点。
          </>}
          en={<>
            The only solutions are <TeX src={String.raw`\theta \in \{0°, 60°, 90°, 120°, 180°\}`} />, giving rotation orders <TeX src={String.raw`n \in \{1, 6, 4, 3, 2\}`} />. For <TeX src={String.raw`n=5`} />:
            <TeX src={String.raw`2\cos(72°) = \tfrac{\sqrt{5}-1}{2} \approx 0.618`} />, not an integer — hence forbidden. Verify this interactively in the dial below.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>注意:此限制是二维/三维格的特殊性质,并非普遍规律。在四维中,格可以有五重旋转对称 (如 A₄ 根格有阶 10 的对称)。准晶 (丹·谢赫特曼,2011 诺贝尔化学奖) 展现五重衍射对称,正是因为它们<em>不是</em>周期格。</>}
          en={<>Note: this restriction is special to 2D/3D lattices, not a universal law. In four dimensions a lattice can have 5-fold rotational symmetry (e.g. the A₄ root lattice admits an order-10 symmetry). Quasicrystals (Dan Shechtman, Nobel Prize 2011) display 5-fold diffraction symmetry precisely because they are <em>not</em> periodic lattices.</>}
        />
      </div>

      {/* ── The 17 groups table ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="17 群总览" en="The 17 groups at a glance" />
      </h3>

      <div style={{ overflowX: 'auto', margin: '24px 0' }}>
        <table className="gt-compare" style={{ width: '100%', fontSize: 13, minWidth: 460 }}>
          <thead>
            <tr>
              <th>IUC</th>
              <th>Orbifold</th>
              <th><L zh="点群" en="Point grp" /></th>
              <th><L zh="格型" en="Lattice" /></th>
              <th><L zh="最大旋转" en="Max rot." /></th>
              <th><L zh="镜像" en="Mirror" /></th>
              <th><L zh="滑移" en="Glide" /></th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <tr key={g.iuc}>
                <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{g.iuc}</td>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-dim)' }}>{g.orbifold}</td>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{g.pointGroupName}</td>
                <td style={{ color: 'var(--ink-dim)', fontSize: 12 }}>{g.lattice}</td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--mono)' }}>{g.maxRot}</td>
                <td style={{ textAlign: 'center', color: g.hasMirror ? 'var(--green)' : 'var(--ink-faint)' }}>
                  {g.hasMirror ? (tr({ zh: '是', en: 'y' })) : '—'}
                </td>
                <td style={{ textAlign: 'center', color: g.hasGlide ? 'var(--green)' : 'var(--ink-faint)' }}>
                  {g.hasGlide ? (tr({ zh: '是', en: 'y' })) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Widget 1: Group Tiler ── */}
      <GroupTiler />

      {/* ── Widget 2: Restriction dial ── */}
      <RestrictionDial />

      {/* ── Widget 3: Orbifold cost ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Conway 魔法定理与轨形费用" en="Conway's Magic Theorem and orbifold cost" />
      </h3>

      <p>
        <L
          zh={<>
            Conway 的轨形记号将每个对称群的商空间 (轨形) 编码成一串字符。费用规则为:字符 <span className="gt-mono">o</span> 贡献 2,<span className="gt-mono">×</span> 贡献 1,<span className="gt-mono">*</span> 贡献 1;镜像边界之前的旋转阶 <TeX src={String.raw`n`} /> 贡献 <TeX src={String.raw`(n-1)/n`} />(锥点 / 旋回点),镜像边界之后的旋转阶 <TeX src={String.raw`n`} /> 贡献 <TeX src={String.raw`(n-1)/(2n)`} />(角点)。
          </>}
          en={<>
            Conway's orbifold notation encodes the quotient space of each symmetry group as a string. The cost rules are: <span className="gt-mono">o</span> contributes 2, <span className="gt-mono">×</span> contributes 1, <span className="gt-mono">*</span> contributes 1; a rotation order <TeX src={String.raw`n`} /> before any <span className="gt-mono">*</span> (a gyration/cone point) contributes <TeX src={String.raw`(n-1)/n`} />, and order <TeX src={String.raw`n`} /> after a <span className="gt-mono">*</span> (a kaleidoscope corner) contributes <TeX src={String.raw`(n-1)/(2n)`} />.
          </>}
        />
      </p>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 — Conway 魔法定理 (轨形 Euler 特征标)" en="Theorem — Conway's Magic Theorem (orbifold Euler characteristic)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              一个轨形签名对应某个墙纸群,当且仅当其 Conway 费用之和恰好等于 2 (等价地,轨形 Euler 特征标 <TeX src={String.raw`\chi = 2 - \text{cost} = 0`} />)。所有满足 <TeX src={String.raw`\text{cost}=2`} /> 的签名精确地给出 17 个墙纸群签名。签名 <TeX src={String.raw`532`} /> (正二十面体群,球面) 的费用约为 <TeX src={String.raw`1.967`} />,<TeX src={String.raw`\chi>0`} />;双曲群的签名费用大于 2,<TeX src={String.raw`\chi<0`} />。
            </>}
            en={<>
              An orbifold signature corresponds to a wallpaper group if and only if its Conway cost totals exactly 2 (equivalently, the orbifold Euler characteristic <TeX src={String.raw`\chi = 2 - \text{cost} = 0`} />). All solutions to <TeX src={String.raw`\text{cost}=2`} /> yield exactly the 17 wallpaper signatures. The signature <TeX src={String.raw`532`} /> (icosahedral, spherical) has cost ≈ 1.967 so <TeX src={String.raw`\chi>0`} />; hyperbolic groups have cost exceeding 2 so <TeX src={String.raw`\chi<0`} />.
            </>}
          />
        </div>
      </div>

      <OrbifoldCalculator />

      {/* ── Glide reflection aside ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="滑移反射与纯镜像的区别" en="Glide reflections vs. plain mirrors" />
      </h3>

      <div className="gt-def">
        <div className="gt-def-title"><L zh="定义 — 滑移反射" en="Definition — Glide reflection" /></div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>滑移反射</strong>是关于直线 <TeX src={String.raw`\ell`} /> 的反射与沿 <TeX src={String.raw`\ell`} /> 方向的非零平移的复合。它是一个<em>无不动点</em>的保向反转等距变换,不是普通镜像 (普通镜像有整条固定线)。其平方是沿滑移方向的纯平移 (距离为滑移量的两倍)。群 <span className="gt-mono">pg</span> 和 <span className="gt-mono">pgg</span> 含滑移反射但<em>没有</em>任何镜像线 — 在贴砖图中只能用虚线 (而非实线) 标出。
            </>}
            en={<>
              A <strong>glide reflection</strong> is the composition of a reflection across a line <TeX src={String.raw`\ell`} /> and a nonzero translation parallel to <TeX src={String.raw`\ell`} />. It is an orientation-reversing isometry with <em>no fixed points</em> — it is NOT a reflection (which has an entire fixed line). Its square is a pure translation by twice the glide vector. Groups <span className="gt-mono">pg</span> and <span className="gt-mono">pgg</span> contain glide reflections but <em>no</em> mirrors — indicated by dashed lines, not solid, in the tiler above.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            另一个经典易混点:<span className="gt-mono">p3m1</span> (<TeX src={String.raw`{*333}`} />) 与 <span className="gt-mono">p31m</span> (<TeX src={String.raw`{3{*}3}`} />) 都含三重旋转与镜像,但前者<em>所有</em>三重旋转中心都在镜像线上,而后者有一些三重中心<em>不</em>在任何镜像线上 (镜像线方向旋转了 30°)。两者作为抽象群同构,但作为平面等距变换群在仿射意义下不同 — 贴砖覆盖的样子本质不同。
          </>}
          en={<>
            Another classical confusion: <span className="gt-mono">p3m1</span> (<TeX src={String.raw`{*333}`} />) and <span className="gt-mono">p31m</span> (<TeX src={String.raw`{3{*}3}`} />) both contain 3-fold rotations and mirrors, but in the former <em>every</em> 3-fold rotation center lies on a mirror line, whereas in the latter some 3-fold centers do <em>not</em> lie on any mirror (the mirror lines are rotated 30°). They are abstractly isomorphic groups but affinely distinct — their tiling patterns look genuinely different.
          </>}
        />
      </p>

      {/* ── Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="与魔方的联系:三维晶体学限制" en="Connection to the Rubik's cube: the 3D crystallographic restriction" />
      </h3>

      <p>
        <L
          zh={<>
            同样的晶体学限制定理在三维同样成立:保持三维格不变的旋转阶数只能属于 <TeX src={String.raw`\{1,2,3,4,6\}`} />。魔方所蕴含的正方体几何正好是此限制的一个教科书例子。正方体的旋转群 (阶 24) 包含:通过三对面心的 <strong>3 个 4 阶轴</strong>、通过四条体对角线的 <strong>4 个 3 阶轴</strong>、通过六条棱中点的 <strong>6 个 2 阶轴</strong>,以及恒等元 — 合计 <TeX src={String.raw`3\times 3 + 4\times 2 + 6\times 1 + 1 = 24`} />。没有 5 阶轴,和平面中一样。
          </>}
          en={<>
            The same crystallographic restriction holds in three dimensions: the order of any rotation preserving a 3D lattice must belong to <TeX src={String.raw`\{1,2,3,4,6\}`} />. The cube's geometry is a textbook example. Its rotation group (order 24) contains: <strong>3 axes of order 4</strong> through opposite face centers, <strong>4 axes of order 3</strong> through opposite vertices (body diagonals), <strong>6 axes of order 2</strong> through opposite edge midpoints, and the identity — summing to <TeX src={String.raw`3\times 3 + 4\times 2 + 6\times 1 + 1 = 24`} />. No 5-fold axis — just as in the plane.
          </>}
        />
      </p>

      <p>
        <L
          zh={<>
            正方体的完整对称群 <TeX src={String.raw`O_h`} /> (阶 48,含反射) 是三维晶体学点群 <TeX src={String.raw`m\overline{3}m`} />,是平面点群 <TeX src={String.raw`D_4`} /> (存在于 <span className="gt-mono">p4m</span> 中) 的三维对应物。17 个墙纸群是 230 个三维空间群的二维同类,正方体所属的立方晶系包含其中 36 个。值得注意:230 个三维空间群的严格分类 (Fedorov/Schoenflies/Barlow,1890 年代) 在历史上早于平面群完整性的严格确认。
          </>}
          en={<>
            The cube's full symmetry group <TeX src={String.raw`O_h`} /> (order 48, including reflections) is the 3D crystallographic point group <TeX src={String.raw`m\overline{3}m`} />, the three-dimensional counterpart of the planar point group <TeX src={String.raw`D_4`} /> that appears in <span className="gt-mono">p4m</span>. The 17 wallpaper groups are the 2D counterpart of the 230 three-dimensional space groups; the cubic crystal system to which the cube belongs contains 36 of those 230. Notably, the rigorous enumeration of the 230 space groups (Fedorov/Schoenflies/Barlow, 1890s) historically preceded the rigorous completeness proof for the planar list.
          </>}
        />
      </p>

      <div className="gt-pullquote">
        <L
          zh={<>平面的周期对称,恰好 17 种。不多不少 — 不是物理经验的总结,而是 Diophantine 约束与 Euler 特征标为零的必然结果。</>}
          en={<>The periodic symmetries of the plane: exactly 17. No more, no fewer — not an empirical observation, but an inevitable consequence of the Diophantine constraint that the orbifold Euler characteristic must vanish.</>}
        />
        <div className="gt-pullquote-cite">Conway, Burgiel, Goodman-Strauss — <em>The Symmetries of Things</em> (2008)</div>
      </div>

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <ol>
          <li>
            M. A. Armstrong, <em>Groups and Symmetry</em>, Springer UTM (1988), Ch. 25–26.
          </li>
          <li>
            J. H. Conway, H. Burgiel, C. Goodman-Strauss, <em>The Symmetries of Things</em>, A K Peters (2008), Ch. 2 (orbifold notation and the Magic Theorem).
          </li>
          <li>
            Wikipedia: <em>Wallpaper group</em>, <em>Crystallographic restriction theorem</em>, <em>Orbifold notation</em>.
          </li>
        </ol>
      </div>
    </GTSec>
  );
}
