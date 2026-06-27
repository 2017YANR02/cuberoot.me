'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── 3×3 matrix math helpers ──────────────────────────────────────────────────

type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

type Vec3 = [number, number, number];

function matMul(A: Mat3, B: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        r[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return r;
}

function matVec(M: Mat3, v: Vec3): Vec3 {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
  ];
}

function identity3(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/** Rodrigues rotation: axis u (unit), angle θ in radians */
function rodrigues(ux: number, uy: number, uz: number, theta: number): Mat3 {
  const mag = Math.sqrt(ux * ux + uy * uy + uz * uz);
  if (mag < 1e-9) return identity3();
  const [x, y, z] = [ux / mag, uy / mag, uz / mag];
  const c = Math.cos(theta), s = Math.sin(theta), t = 1 - c;
  return [
    t * x * x + c,     t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c,     t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

/** Round matrix entries for display */
function fmt(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? '0' : r.toFixed(3).replace(/\.?0+$/, '');
}

function matsEqual(A: Mat3, B: Mat3, eps = 1e-6): boolean {
  return A.every((a, i) => Math.abs(a - B[i]) < eps);
}

/** Unit quaternion → 3×3 rotation matrix */
function quatToMat(w: number, x: number, y: number, z: number): Mat3 {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z),     2 * (x * z + w * y),
    2 * (x * y + w * z),     1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y),     2 * (y * z + w * x),     1 - 2 * (x * x + y * y),
  ];
}

// ── Isometric projection ──────────────────────────────────────────────────────

/** Project a 3-D point to SVG coords using isometric projection.
 *  ISO: screenX = (x - z) cos30 · s + cx,  screenY = y · s - (x + z) sin30 · s + cy */
function isoProject(p: Vec3, cx: number, cy: number, s: number): { px: number; py: number } {
  const cos30 = Math.sqrt(3) / 2;
  const sin30 = 0.5;
  return {
    px: cx + (p[0] - p[2]) * cos30 * s,
    py: cy - p[1] * s + (p[0] + p[2]) * sin30 * s,
  };
}

// Cube vertices: all ±0.5 combinations
const CUBE_VERTS: Vec3[] = (() => {
  const v: Vec3[] = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5])
    v.push([x, y, z]);
  return v;
})();

// Cube edges: pairs of vertex indices that differ in exactly one coordinate
const CUBE_EDGES: [number, number][] = (() => {
  const e: [number, number][] = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const [vi, vj] = [CUBE_VERTS[i], CUBE_VERTS[j]];
    const diff = (vi[0] !== vj[0] ? 1 : 0) + (vi[1] !== vj[1] ? 1 : 0) + (vi[2] !== vj[2] ? 1 : 0);
    if (diff === 1) e.push([i, j]);
  }
  return e;
})();

// Cube faces (6 faces, each as 4 vertex indices, outward normals for back-face culling)
const CUBE_FACES: { verts: number[]; normal: Vec3 }[] = [
  { verts: [4, 5, 7, 6], normal: [0, 0, 1] },   // z+
  { verts: [0, 1, 3, 2], normal: [0, 0, -1] },   // z-
  { verts: [2, 3, 7, 6], normal: [0, 1, 0] },    // y+
  { verts: [0, 1, 5, 4], normal: [0, -1, 0] },   // y-
  { verts: [1, 3, 7, 5], normal: [1, 0, 0] },    // x+
  { verts: [0, 2, 6, 4], normal: [-1, 0, 0] },   // x-
];

// Face colors (WCA-ish, but via CSS vars we can't interpolate — use fixed tasteful colors)
const FACE_COLORS = ['#C2410C', '#B8860B', '#3F7050', '#6B4E9C', '#8B2E3C', '#2A4D69'];

// ── Isometric cube SVG component ─────────────────────────────────────────────

function IsoCube({ matrix, cx, cy, s }: { matrix: Mat3; cx: number; cy: number; s: number }) {
  const projected = useMemo(() => CUBE_VERTS.map(v => {
    const rv = matVec(matrix, v);
    return isoProject(rv, cx, cy, s);
  }), [matrix, cx, cy, s]);

  // Eye direction in world space (roughly toward viewer in iso)
  const eyeDir: Vec3 = [1, 1, 1];

  const visibleFaces = useMemo(() => {
    return CUBE_FACES.map((face, fi) => {
      const rn = matVec(matrix, face.normal);
      const dot = rn[0] * eyeDir[0] + rn[1] * eyeDir[1] + rn[2] * eyeDir[2];
      return { ...face, visible: dot > 0, color: FACE_COLORS[fi] };
    }).filter(f => f.visible);
  }, [matrix]);

  return (
    <>
      {visibleFaces.map((face, fi) => {
        const pts = face.verts.map(vi => projected[vi]);
        const points = pts.map(p => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
        return (
          <polygon key={fi} points={points} fill={face.color} fillOpacity={0.82}
            stroke="var(--bg)" strokeWidth={1} />
        );
      })}
      {CUBE_EDGES.map(([a, b], ei) => (
        <line key={ei}
          x1={projected[a].px.toFixed(1)} y1={projected[a].py.toFixed(1)}
          x2={projected[b].px.toFixed(1)} y2={projected[b].py.toFixed(1)}
          stroke="var(--ink)" strokeWidth={0.7} opacity={0.35} />
      ))}
    </>
  );
}

function IsoAxes({ matrix, cx, cy, s }: { matrix: Mat3; cx: number; cy: number; s: number }) {
  const axes: { dir: Vec3; color: string; label: string }[] = [
    { dir: [1, 0, 0], color: '#D95030', label: 'x' },
    { dir: [0, 1, 0], color: '#3F7050', label: 'y' },
    { dir: [0, 0, 1], color: '#2A4D69', label: 'z' },
  ];
  return (
    <>
      {axes.map(({ dir, color, label }) => {
        const tip = matVec(matrix, dir);
        const p0 = isoProject([0, 0, 0], cx, cy, s);
        const p1 = isoProject(tip, cx, cy, s);
        return (
          <g key={label}>
            <line x1={p0.px} y1={p0.py} x2={p1.px} y2={p1.py}
              stroke={color} strokeWidth={2} markerEnd={`url(#arrow-${label})`} />
            <text x={p1.px + 5} y={p1.py + 4} fill={color}
              style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700 }}>{label}</text>
            <defs>
              <marker id={`arrow-${label}`} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={color} />
              </marker>
            </defs>
          </g>
        );
      })}
    </>
  );
}

// ── Matrix grid display ───────────────────────────────────────────────────────

function MatrixGrid({ M, highlight, label }: { M: Mat3; highlight?: boolean[]; label: string }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
      <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 10, marginBottom: 4 }}>{label}</div>
      <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
        <tbody>
          {[0, 1, 2].map(row => (
            <tr key={row}>
              {[0, 1, 2].map(col => {
                const idx = row * 3 + col;
                const hl = highlight?.[idx] ?? false;
                return (
                  <td key={col} style={{
                    padding: '3px 7px', textAlign: 'right', minWidth: 44,
                    color: hl ? 'var(--accent)' : 'var(--ink)',
                    background: hl ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-elev))' : 'transparent',
                    fontWeight: hl ? 700 : 400,
                    border: '1px solid var(--rule)',
                  }}>
                    {fmt(M[idx])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Preset rotations ─────────────────────────────────────────────────────────

const PRESETS: { label: string; ux: number; uy: number; uz: number; deg: number }[] = [
  { label: 'Rₓ(90°)', ux: 1, uy: 0, uz: 0, deg: 90 },
  { label: 'Rᵧ(90°)', ux: 0, uy: 1, uz: 0, deg: 90 },
  { label: 'R_z(90°)', ux: 0, uy: 0, uz: 1, deg: 90 },
  { label: 'Rₓ(45°)', ux: 1, uy: 0, uz: 0, deg: 45 },
];

// ── Panel 1: Two-rotation composer ───────────────────────────────────────────

interface RotState { ux: number; uy: number; uz: number; deg: number }

function RotationComposerPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [rotA, setRotA] = useState<RotState>({ ux: 1, uy: 0, uz: 0, deg: 90 });
  const [rotB, setRotB] = useState<RotState>({ ux: 0, uy: 1, uz: 0, deg: 90 });
  const [order, setOrder] = useState<'AB' | 'BA'>('AB');

  const matA = useMemo(() => rodrigues(rotA.ux, rotA.uy, rotA.uz, rotA.deg * Math.PI / 180), [rotA]);
  const matB = useMemo(() => rodrigues(rotB.ux, rotB.uy, rotB.uz, rotB.deg * Math.PI / 180), [rotB]);
  const matAB = useMemo(() => matMul(matA, matB), [matA, matB]);
  const matBA = useMemo(() => matMul(matB, matA), [matA, matB]);
  const displayMat = order === 'AB' ? matAB : matBA;
  const otherMat = order === 'AB' ? matBA : matAB;
  const areEqual = matsEqual(matAB, matBA);
  const diffHighlight: boolean[] = matAB.map((v, i) => Math.abs(v - matBA[i]) > 1e-4);

  const updateRot = useCallback((which: 'A' | 'B', field: keyof RotState, value: number) => {
    const setter = which === 'A' ? setRotA : setRotB;
    setter(prev => ({ ...prev, [field]: value }));
  }, []);

  const applyPreset = useCallback((which: 'A' | 'B', p: typeof PRESETS[0]) => {
    const setter = which === 'A' ? setRotA : setRotB;
    setter({ ux: p.ux, uy: p.uy, uz: p.uz, deg: p.deg });
  }, []);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="旋转合成器: SO(3) 非交换性演示" en="Rotation composer: non-commutativity of SO(3)" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>调整两个旋转 A、B 的轴和角度，实时看到 <TeX src={String.raw`AB\neq BA`} />：旋转矩阵相乘不可交换。</>}
          en={<>Adjust the axis and angle for rotations A and B; watch <TeX src={String.raw`AB\neq BA`} /> live — matrix products don&apos;t commute.</>}
        />
      </div>

      {/* Controls for A and B */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        {(['A', 'B'] as const).map(which => {
          const rot = which === 'A' ? rotA : rotB;
          return (
            <div key={which} style={{ flex: '1 1 260px', minWidth: 220 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>
                {lang === 'zh' ? `旋转 ${which}` : `Rotation ${which}`}
              </div>

              {/* Preset buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {PRESETS.map(p => (
                  <button key={p.label} className="gt-chip" style={{ fontSize: 10 }}
                    onClick={() => applyPreset(which, p)}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Axis sliders */}
              {([['ux', 'u_x'], ['uy', 'u_y'], ['uz', 'u_z']] as [keyof RotState, string][]).map(([field, texLabel]) => (
                <div key={field} className="gt-panel-input-row" style={{ gap: 6 }}>
                  <label style={{ minWidth: 28, fontFamily: 'var(--mono)', fontSize: 11 }}><TeX src={String.raw`${texLabel}`} /></label>
                  <input type="range" min={-10} max={10} step={1} value={Math.round((rot[field] as number) * 10)}
                    onChange={e => updateRot(which, field, Number(e.target.value) / 10)}
                    style={{ flex: 1 }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 32, color: 'var(--ink-dim)' }}>
                    {((rot[field] as number)).toFixed(1)}
                  </span>
                </div>
              ))}

              {/* Angle slider */}
              <div className="gt-panel-input-row" style={{ gap: 6 }}>
                <label style={{ minWidth: 28, fontFamily: 'var(--mono)', fontSize: 11 }}><TeX src={String.raw`\theta`} /></label>
                <input type="range" min={-180} max={180} step={5} value={rot.deg}
                  onChange={e => updateRot(which, 'deg', Number(e.target.value))}
                  style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 36, color: 'var(--ink-dim)' }}>
                  {rot.deg}°
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order toggle */}
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
          <L zh="合成顺序" en="Order" />
        </label>
        {(['AB', 'BA'] as const).map(o => (
          <button key={o} className={`gt-chip${order === o ? ' gt-chip-active' : ''}`}
            onClick={() => setOrder(o)}>
            {o === 'AB'
              ? tr({ zh: '先 A 后 B (AB)', en: 'A then B (AB)'
                                })
              : tr({ zh: '先 B 后 A (BA)', en: 'B then A (BA)'
                                })}
          </button>
        ))}
      </div>

      {/* Commutativity status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: areEqual
          ? 'color-mix(in srgb, var(--green) 10%, var(--bg-elev))'
          : 'color-mix(in srgb, var(--accent) 10%, var(--bg-elev))',
        border: `1px solid ${areEqual ? 'var(--green)' : 'var(--accent)'}`,
        borderRadius: 4, marginBottom: 16,
        fontFamily: 'var(--mono)', fontSize: 12,
        color: areEqual ? 'var(--green)' : 'var(--accent)',
      }}>
        {areEqual
          ? tr({ zh: 'AB = BA（此时可交换，例如同轴或零角）', en: 'AB = BA (commute here — e.g. same axis or zero angle)'
                          })
          : tr({ zh: 'AB ≠ BA — SO(3) 非交换！高亮格 = 差异项', en: 'AB ≠ BA — SO(3) is non-abelian! Highlighted cells differ'
                          })}
      </div>

      {/* SVG: cube visualization + matrices */}
      <svg viewBox="0 0 520 200" width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* Left cube: current order */}
        <text x={90} y={14} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
          fill="var(--accent)">{order}</text>
        <IsoCube matrix={displayMat} cx={90} cy={110} s={52} />
        <IsoAxes matrix={displayMat} cx={90} cy={110} s={52} />

        {/* Right cube: other order */}
        <text x={270} y={14} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
          fill={areEqual ? 'var(--green)' : 'var(--accent-2)'}>
          {order === 'AB' ? 'BA' : 'AB'}
        </text>
        <IsoCube matrix={otherMat} cx={270} cy={110} s={52} />
        <IsoAxes matrix={otherMat} cx={270} cy={110} s={52} />

        {/* Not-equal marker */}
        <text x={185} y={110} textAnchor="middle"
          style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}
          fill={areEqual ? 'var(--green)' : 'var(--accent)'}>
          {areEqual ? '=' : '≠'}
        </text>

        {/* Matrix display — AB */}
        <g transform="translate(358, 20)">
          {[0, 1, 2].map(row =>
            [0, 1, 2].map(col => {
              const idx = row * 3 + col;
              const hl = diffHighlight[idx];
              return (
                <g key={idx}>
                  <rect x={col * 46} y={row * 26} width={44} height={24} rx={2}
                    fill={hl ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-elev))' : 'var(--bg-elev)'}
                    stroke={hl ? 'var(--accent)' : 'var(--rule)'} strokeWidth={hl ? 1.5 : 1} />
                  <text x={col * 46 + 22} y={row * 26 + 16} textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                    fill={hl ? 'var(--accent)' : 'var(--ink)'}>{fmt(displayMat[idx])}</text>
                </g>
              );
            })
          )}
          <text x={69} y={95} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
            {lang === 'zh' ? `当前 (${order})` : `current (${order})`}
          </text>
        </g>
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label">dim SO(3)</span>
          <span className="gt-result-val-strong">3</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginLeft: 8 }}>
            = n(n-1)/2 = 3·2/2
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\det(AB)`} /></span>
          <span className="gt-result-val">
            {fmt(
              displayMat[0] * (displayMat[4] * displayMat[8] - displayMat[5] * displayMat[7])
              - displayMat[1] * (displayMat[3] * displayMat[8] - displayMat[5] * displayMat[6])
              + displayMat[2] * (displayMat[3] * displayMat[7] - displayMat[4] * displayMat[6])
            )}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginLeft: 8 }}>
              <L zh="(应恒为 1)" en="(always 1)" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Panel 2: SU(2) → SO(3) double cover ──────────────────────────────────────

function DoubleCoverPanel({}: { lang: 'zh' | 'en' }) {
  // Axis: polar angle φ_axis ∈ [0°,180°], azimuth λ ∈ [0°,360°]
  const [polarDeg, setPolarDeg] = useState(90);
  const [azimDeg, setAzimDeg] = useState(0);
  // Full rotation angle φ ∈ [0°,720°] (quaternion half-angle = φ/2)
  const [phiDeg, setPhiDeg] = useState(180);

  const axis = useMemo<Vec3>(() => {
    const p = polarDeg * Math.PI / 180;
    const a = azimDeg * Math.PI / 180;
    return [Math.sin(p) * Math.cos(a), Math.cos(p), Math.sin(p) * Math.sin(a)];
  }, [polarDeg, azimDeg]);

  // Quaternion q = (cos(φ/2), sin(φ/2)·axis)
  const halfAngle = phiDeg * Math.PI / 360;
  const qw = Math.cos(halfAngle);
  const qx = Math.sin(halfAngle) * axis[0];
  const qy = Math.sin(halfAngle) * axis[1];
  const qz = Math.sin(halfAngle) * axis[2];

  // Rotation matrix from quaternion (and its negative)
  const matQ = useMemo(() => quatToMat(qw, qx, qy, qz), [qw, qx, qy, qz]);
  const matNegQ = useMemo(() => quatToMat(-qw, -qx, -qy, -qz), [qw, qx, qy, qz]);
  const sameRotation = matsEqual(matQ, matNegQ);

  // Winding arc parameters
  const sweepFrac = phiDeg / 720;
  const arcR = 44;
  const arcCx = 55, arcCy = 55;
  function arcPoint(frac: number) {
    const angle = frac * 2 * Math.PI - Math.PI / 2;
    return { x: arcCx + arcR * Math.cos(angle), y: arcCy + arcR * Math.sin(angle) };
  }
  const arcEnd = arcPoint(sweepFrac);
  const largeArc = sweepFrac > 0.5 ? 1 : 0;

  const atHalf = Math.abs(phiDeg - 360) < 1;
  const markHalf = arcPoint(0.5);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="SU(2) → SO(3) 双重覆盖: q 与 −q 给出同一旋转" en="SU(2) → SO(3) double cover: q and −q yield the same rotation" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>旋转角 <TeX src={String.raw`\varphi`} /> 从 0° 到 720°。当 <TeX src={String.raw`\varphi=360°`} /> 时四元数变号 <TeX src={String.raw`q\to -q`} />，但旋转矩阵不变——这就是自旋 1/2 的 4π 周期。</>}
          en={<>Rotation angle <TeX src={String.raw`\varphi`} /> from 0° to 720°. At <TeX src={String.raw`\varphi=360°`} />, the quaternion flips sign <TeX src={String.raw`q\to -q`} />, but the rotation matrix is unchanged — the spin-½ 4π periodicity.</>}
        />
      </div>

      <div className="gt-panel-input-row">
        <label style={{ minWidth: 60, fontFamily: 'var(--mono)', fontSize: 11 }}>
          <TeX src={String.raw`\varphi`} /> (°)
        </label>
        <input type="range" min={0} max={720} step={5} value={phiDeg}
          onChange={e => setPhiDeg(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, minWidth: 40, color: 'var(--ink-dim)' }}>{phiDeg}°</span>
      </div>

      <div className="gt-panel-input-row">
        <label style={{ minWidth: 60, fontFamily: 'var(--mono)', fontSize: 11 }}>
          <L zh="极角" en="Polar" /> (°)
        </label>
        <input type="range" min={0} max={180} step={5} value={polarDeg}
          onChange={e => setPolarDeg(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 36, color: 'var(--ink-dim)' }}>{polarDeg}°</span>
      </div>

      <div className="gt-panel-input-row">
        <label style={{ minWidth: 60, fontFamily: 'var(--mono)', fontSize: 11 }}>
          <L zh="方位角" en="Azimuth" /> (°)
        </label>
        <input type="range" min={0} max={360} step={5} value={azimDeg}
          onChange={e => setAzimDeg(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 36, color: 'var(--ink-dim)' }}>{azimDeg}°</span>
      </div>

      <svg viewBox="0 0 520 200" width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* Winding indicator (left) */}
        <g>
          {/* Full circle (720° track, split at 360° mark) */}
          <circle cx={arcCx} cy={arcCy} r={arcR} fill="none" stroke="var(--rule)" strokeWidth={2} />
          {/* 360° mark */}
          <line x1={arcCx} y1={arcCy - arcR - 6} x2={arcCx} y2={arcCy - arcR + 6}
            stroke="var(--gold)" strokeWidth={2} />
          <text x={arcCx + 5} y={arcCy - arcR + 4}
            style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--gold)">360°</text>

          {/* Arc swept so far */}
          {phiDeg > 0 && (
            <path
              d={`M ${arcCx} ${arcCy - arcR} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`}
              fill="none"
              stroke={phiDeg >= 360 ? 'var(--accent-2)' : 'var(--accent)'}
              strokeWidth={3} strokeLinecap="round" />
          )}

          {/* Marker dot */}
          <circle cx={arcEnd.x} cy={arcEnd.y} r={5}
            fill={phiDeg >= 360 ? 'var(--accent-2)' : 'var(--accent)'} />

          {/* 360° antipode marker */}
          <circle cx={markHalf.x} cy={markHalf.y} r={4}
            fill="none" stroke="var(--gold)" strokeWidth={1.5} />

          {/* φ label */}
          <text x={arcCx} y={arcCy + 4} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700 }}
            fill={phiDeg >= 360 ? 'var(--accent-2)' : 'var(--accent)'}>
            {phiDeg}°
          </text>
          <text x={arcCx} y={arcCy + 108 - arcR} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
            <L zh="旋转角 φ" en="rotation angle φ" />
          </text>
        </g>

        {/* Quaternion bars (center) */}
        <g transform="translate(120, 10)">
          <text x={60} y={12} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
            q = (w, x, y, z)
          </text>
          {([['w', qw], ['x', qx], ['y', qy], ['z', qz]] as [string, number][]).map(([lbl, val], i) => {
            const barW = Math.abs(val) * 50;
            const barX = val >= 0 ? 60 : 60 - barW;
            return (
              <g key={lbl} transform={`translate(0, ${24 + i * 32})`}>
                <text x={14} y={16} textAnchor="end"
                  style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-dim)">{lbl}</text>
                <rect x={20} y={6} width={80} height={14} rx={2}
                  fill="var(--bg-elev)" stroke="var(--rule)" strokeWidth={1} />
                {barW > 0.5 && (
                  <rect x={20 + barX - 60 + 40} y={7} width={barW} height={12} rx={2}
                    fill={val >= 0 ? 'var(--accent)' : 'var(--accent-2)'} opacity={0.75} />
                )}
                <line x1={60} y1={6} x2={60} y2={20}
                  stroke="var(--rule)" strokeWidth={1} strokeDasharray="2 2" />
                <text x={108} y={16} textAnchor="start"
                  style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                  {val.toFixed(2)}
                </text>
              </g>
            );
          })}
          {/* −q label */}
          <text x={60} y={165} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
            {tr({ zh: '−q 给出同一矩阵', en: '−q gives same matrix'
            })}
          </text>
        </g>

        {/* Cube driven by R(q) (right) */}
        <text x={390} y={14} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
          <L zh="对应旋转" en="resulting rotation" />
        </text>
        <IsoCube matrix={matQ} cx={390} cy={105} s={52} />
        <IsoAxes matrix={matQ} cx={390} cy={105} s={52} />

        {/* 360° annotation */}
        {(phiDeg >= 355 && phiDeg <= 365) && (
          <text x={390} y={185} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--gold)">
            {tr({ zh: 'q → −q，旋转不变！', en: 'q → −q, rotation unchanged!'
            })}
          </text>
        )}
        {atHalf && (
          <text x={390} y={190} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--gold)">
            {tr({ zh: 'q → −q，旋转不变！', en: 'q → −q, rotation unchanged!'
            })}
          </text>
        )}
      </svg>

      {/* Numerical proof that R(q) = R(−q) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, alignItems: 'flex-start' }}>
        <MatrixGrid M={matQ} label={`R(q), φ=${phiDeg}°`} />
        <MatrixGrid M={matNegQ} label="R(−q)" highlight={matQ.map((v, i) => Math.abs(v - matNegQ[i]) > 1e-4)} />
      </div>

      <div className="gt-panel-result" style={{ marginTop: 12 }}>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="R(q) = R(−q)?" en="R(q) = R(−q)?" /></span>
          <span className="gt-result-val-strong" style={{ color: sameRotation ? 'var(--green)' : 'var(--warn)' }}>
            {sameRotation
              ? tr({ zh: '总是相等（数值验证通过）', en: 'always equal (numerically verified)'
                                      })
              : tr({ zh: '计算误差 > 1e-4（不应发生）', en: 'numerical error > 1e-4 (should not happen)'
                                      })}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`|q|^2`} /></span>
          <span className="gt-result-val">{(qw * qw + qx * qx + qy * qy + qz * qz).toFixed(6)}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginLeft: 8 }}>
            <L zh="(单位四元数, 恒 = 1)" en="(unit quaternion, always = 1)" />
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="π₁(SO(3))" en="π₁(SO(3))" />
          </span>
          <span className="gt-result-val">ℤ/2ℤ</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginLeft: 8 }}>
            <L zh="360°转 q→−q，720° 回到 q" en="360° sends q→−q; 720° returns to q" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Panel 3: Finite subgroups of SO(3) gallery ───────────────────────────────

type SubgroupType = 'Cn' | 'Dn' | 'T' | 'O' | 'I';

interface SubgroupInfo {
  key: SubgroupType;
  labelZh: string;
  labelEn: string;
  order: (n: number) => number;
  iso: string;
  desc: { zh: string; en: string
 };
}

const SUBGROUPS: SubgroupInfo[] = [
  {
    key: 'Cn', labelZh: 'C_n (循环)', labelEn: 'C_n (cyclic)', order: n => n,
    iso: 'ℤ/n', desc: {
      zh: '绕固定轴旋转 2πk/n，阶为 n',
      en: 'Rotations by 2πk/n about a fixed axis, order n'
    }
},
  {
    key: 'Dn', labelZh: 'D_n (二面体旋转)', labelEn: 'D_n (dihedral rotation)', order: n => 2 * n,
    iso: 'Dih(n)', desc: {
      zh: '正 n 边形嵌入 ℝ³ 的旋转群，阶 2n（含 n 条平面内旋转轴）',
      en: 'Rotational symmetry of n-gon in ℝ³, order 2n (n in-plane flip axes)'
    }
},
  {
    key: 'T', labelZh: '四面体 T ≅ A₄', labelEn: 'Tetrahedral T ≅ A₄', order: () => 12,
    iso: 'A₄', desc: {
      zh: '正四面体旋转群，阶 12 = 4!/2，由 4 个三重轴和 3 个二重轴生成',
      en: 'Rotation group of tetrahedron, order 12 = 4!/2; 4 threefold axes, 3 twofold axes'
    }
},
  {
    key: 'O', labelZh: '正方体/八面体 O ≅ S₄', labelEn: 'Cube/octahedron O ≅ S₄', order: () => 24,
    iso: 'S₄', desc: {
      zh: '正方体（及正八面体）旋转群，阶 24 = 4!，置换 4 条体对角线。这正是魔方形状的刚体旋转群！',
      en: 'Rotation group of cube (and octahedron), order 24 = 4!, permuting 4 body diagonals. This is the rigid symmetry group of the Rubik\'s cube shape!'
    }
},
  {
    key: 'I', labelZh: '正十二/二十面体 I ≅ A₅', labelEn: 'Dodecahedron/icosahedron I ≅ A₅', order: () => 60,
    iso: 'A₅', desc: {
      zh: '正十二面体（及正二十面体）旋转群，阶 60 = 5!/2，单群（非可解）',
      en: 'Rotation group of dodecahedron (and icosahedron), order 60 = 5!/2; a simple group (non-solvable)'
    }
},
];

/** Generate octahedral group (O ≅ S₄, 24 elements) by closure starting from Rx(90) and Ry(90). */
function generateOctahedralGroup(): Mat3[] {
  const genA = rodrigues(1, 0, 0, Math.PI / 2);
  const genB = rodrigues(0, 1, 0, Math.PI / 2);
  const group: Mat3[] = [identity3()];
  const key = (M: Mat3) => M.map(v => Math.round(v * 100) / 100).join(',');
  const seen = new Set<string>([key(identity3())]);
  let changed = true;
  while (changed) {
    changed = false;
    const current = [...group];
    for (const m of current) {
      for (const gen of [genA, genB]) {
        const prod = matMul(m, gen);
        const k = key(prod);
        if (!seen.has(k)) {
          seen.add(k);
          group.push(prod);
          changed = true;
        }
      }
    }
  }
  return group;
}

// Tetrahedron vertices (inscribed in cube)
const TETRA_VERTS: Vec3[] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
const TETRA_EDGES: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

// Cube (already defined above as CUBE_VERTS/CUBE_EDGES)

// Icosahedron vertices (golden ratio φ = 1.618...)
const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSA_VERTS: Vec3[] = (() => {
  const v: Vec3[] = [];
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    v.push([0, s1 * 1, s2 * PHI]);
    v.push([s1 * 1, s2 * PHI, 0]);
    v.push([s1 * PHI, 0, s2 * 1]);
  }
  // Normalize to unit sphere
  const mag = Math.sqrt(1 + PHI * PHI);
  return v.map(([x, y, z]) => [x / mag, y / mag, z / mag]);
})();
// Icosahedron edges: pairs within distance threshold
const ICOSA_EDGE_DIST = 1.1;
const ICOSA_EDGES: [number, number][] = (() => {
  const e: [number, number][] = [];
  for (let i = 0; i < ICOSA_VERTS.length; i++)
    for (let j = i + 1; j < ICOSA_VERTS.length; j++) {
      const d = Math.sqrt(
        (ICOSA_VERTS[i][0] - ICOSA_VERTS[j][0]) ** 2 +
        (ICOSA_VERTS[i][1] - ICOSA_VERTS[j][1]) ** 2 +
        (ICOSA_VERTS[i][2] - ICOSA_VERTS[j][2]) ** 2
      );
      if (d < ICOSA_EDGE_DIST) e.push([i, j]);
    }
  return e;
})();

function PolyhedronSVG({ type, matrix, cx, cy, s }: { type: SubgroupType; matrix: Mat3; cx: number; cy: number; s: number }) {
  const verts = type === 'T' ? TETRA_VERTS : type === 'I' ? ICOSA_VERTS : CUBE_VERTS;
  const edges = type === 'T' ? TETRA_EDGES : type === 'I' ? ICOSA_EDGES : CUBE_EDGES;

  const projected = useMemo(() => verts.map(v => {
    const rv = matVec(matrix, v);
    return isoProject(rv, cx, cy, s);
  }), [verts, matrix, cx, cy, s]);

  return (
    <>
      {edges.map(([a, b], ei) => (
        <line key={ei}
          x1={projected[a].px.toFixed(1)} y1={projected[a].py.toFixed(1)}
          x2={projected[b].px.toFixed(1)} y2={projected[b].py.toFixed(1)}
          stroke="var(--accent-2)" strokeWidth={1.5} opacity={0.7} />
      ))}
      {verts.map((_, vi) => (
        <circle key={vi} cx={projected[vi].px} cy={projected[vi].py} r={3}
          fill="var(--accent)" opacity={0.9} />
      ))}
    </>
  );
}

function FiniteSubgroupPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [selected, setSelected] = useState<SubgroupType>('O');
  const [nVal, setNVal] = useState(4);
  const [elementIdx, setElementIdx] = useState(0);

  // The octahedral group (precomputed for the cube demo)
  const octGroup = useMemo(() => generateOctahedralGroup(), []);

  // Determine current group elements as rotation matrices
  const groupElements = useMemo<Mat3[]>(() => {
    if (selected === 'Cn') {
      return Array.from({ length: nVal }, (_, k) =>
        rodrigues(0, 1, 0, 2 * Math.PI * k / nVal));
    }
    if (selected === 'Dn') {
      const rots: Mat3[] = Array.from({ length: nVal }, (_, k) =>
        rodrigues(0, 1, 0, 2 * Math.PI * k / nVal));
      const flips: Mat3[] = Array.from({ length: nVal }, (_, k) => {
        const flipAxis: Vec3 = [Math.cos(Math.PI * k / nVal), 0, Math.sin(Math.PI * k / nVal)];
        return rodrigues(...flipAxis, Math.PI);
      });
      return [...rots, ...flips];
    }
    if (selected === 'T') {
      // Tetrahedral group A₄: rotations of tetrahedron
      // 12 elements: identity + 8 rotations by ±2π/3 about 4 body diagonals + 3 rotations by π about edge midpoints
      const bodyDiags: Vec3[] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
      const mats: Mat3[] = [identity3()];
      for (const d of bodyDiags) {
        mats.push(rodrigues(...d, 2 * Math.PI / 3));
        mats.push(rodrigues(...d, -2 * Math.PI / 3));
      }
      // 3 twofold axes: x, y, z
      for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]) {
        mats.push(rodrigues(...axis, Math.PI));
      }
      return mats.slice(0, 12);
    }
    if (selected === 'O') {
      return octGroup;
    }
    // Icosahedral A₅: 60 elements. Generate by closure from a genuine 5-fold
    // vertex-axis rotation (about (1,φ,0), an actual icosahedron vertex) and a
    // 2-fold rotation R_x(π). This pair generates the full order-60 group;
    // a 5-fold about a coordinate axis is NOT a symmetry and only gives D₅ (10).
    const g1 = rodrigues(1, PHI, 0, 2 * Math.PI / 5);
    const g2 = rodrigues(1, 0, 0, Math.PI);
    const group: Mat3[] = [identity3()];
    const key = (M: Mat3) => M.map(v => Math.round(v * 1000) / 1000).join(',');
    const seen = new Set<string>([key(identity3())]);
    let changed = true;
    while (changed) {
      changed = false;
      const current = [...group];
      for (const m of current) {
        for (const gen of [g1, g2]) {
          const prod = matMul(m, gen);
          const k = key(prod);
          if (!seen.has(k)) {
            seen.add(k);
            group.push(prod);
            changed = true;
          }
        }
      }
    }
    return group.slice(0, 60);
  }, [selected, nVal, octGroup]);

  const info = SUBGROUPS.find(s => s.key === selected)!;
  const clampedIdx = Math.min(elementIdx, groupElements.length - 1);
  const currentMat = groupElements[clampedIdx] ?? identity3();

  // Axis description for the current element
  const axisLabel = (() => {
    if (selected === 'O' && clampedIdx < octGroup.length) {
      // Classify by trace tr = 1 + 2cos(angle):
      //   tr=3 identity; tr=1 → 90°/270° (face axis); tr=0 → 120°/240° (body
      //   diagonal); tr=-1 → 180° (face or edge axis, indistinguishable by trace).
      const m = octGroup[clampedIdx];
      const trace = m[0] + m[4] + m[8];
      if (Math.abs(trace - 3) < 0.01) return tr({ zh: '单位元', en: 'identity'
    });
      if (Math.abs(trace - 1) < 0.05) return tr({ zh: '面轴 (90°/270°)', en: 'face axis (90°/270°)'
    });
      if (Math.abs(trace - 0) < 0.05) return tr({ zh: '体对角线轴 (120°/240°)', en: 'body-diagonal axis (120°/240°)'
    });
      if (Math.abs(trace - (-1)) < 0.05) return tr({ zh: '180° 旋转 (面轴或棱轴)', en: '180° rotation (face or edge axis)'
    });
    }
    return `#${clampedIdx}`;
  })();

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="SO(3) 有限子群五族: 正方体 S₄ 在其中的位置" en="Five families of finite subgroups of SO(3): where cube S₄ fits" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一族，拖动滑块遍历其全部元素并查看旋转效果。"
          en="Pick a family, drag the slider to cycle through all group elements and see each rotation applied."
        />
      </div>

      {/* Family selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {SUBGROUPS.map(sg => (
          <button key={sg.key}
            className={`gt-chip${selected === sg.key ? ' gt-chip-active' : ''}`}
            onClick={() => { setSelected(sg.key); setElementIdx(0); }}
            style={{ fontSize: 11 }}>
            {lang === 'zh' ? sg.labelZh : sg.labelEn}
          </button>
        ))}
      </div>

      {/* n slider (Cn/Dn only) */}
      {(selected === 'Cn' || selected === 'Dn') && (
        <div className="gt-panel-input-row">
          <label style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 16 }}>n</label>
          <input type="range" min={2} max={8} step={1} value={nVal}
            onChange={e => { setNVal(Number(e.target.value)); setElementIdx(0); }}
            style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 24, color: 'var(--ink-dim)' }}>{nVal}</span>
        </div>
      )}

      {/* Element index slider */}
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 60 }}>
          <L zh="元素" en="Element" /> #{clampedIdx + 1}
        </label>
        <input type="range" min={0} max={groupElements.length - 1} step={1} value={clampedIdx}
          onChange={e => setElementIdx(Number(e.target.value))}
          style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 44, color: 'var(--ink-dim)' }}>
          {clampedIdx + 1} / {groupElements.length}
        </span>
      </div>

      {/* SVG: polyhedron */}
      <svg viewBox="0 0 520 180" width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <PolyhedronSVG
          type={selected === 'Cn' || selected === 'Dn' ? 'O' : selected}
          matrix={currentMat} cx={110} cy={90} s={selected === 'I' ? 72 : 62} />
        <IsoAxes matrix={currentMat} cx={110} cy={90} s={55} />

        {/* Info panel */}
        <g transform="translate(230, 10)">
          <text x={0} y={16} style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }} fill="var(--accent)">
            {lang === 'zh' ? info.labelZh : info.labelEn}
          </text>
          <text x={0} y={36} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--ink-dim)">
            |G| = {info.order(nVal)}
          </text>
          <text x={0} y={52} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--ink-dim)">
            {tr({ zh: '同构型', en: 'Isomorphism'
            })}: {info.iso}
          </text>
          <foreignObject x={0} y={60} width={280} height={80}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
              {tr(info.desc)}
            </div>
          </foreignObject>
          <text x={0} y={155} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
            {lang === 'zh' ? `当前: ${axisLabel}` : `current: ${axisLabel}`}
          </text>
        </g>

        {/* 5 family summary strip */}
        <g transform="translate(0, 155)">
          {SUBGROUPS.map((sg, i) => {
            const ordVal = sg.key === 'Cn' || sg.key === 'Dn' ? sg.order(nVal) : sg.order(nVal);
            const isActive = sg.key === selected;
            return (
              <g key={sg.key} transform={`translate(${i * 104}, 0)`}
                style={{ cursor: 'pointer' }} onClick={() => { setSelected(sg.key); setElementIdx(0); }}>
                <rect x={0} y={0} width={100} height={22} rx={2}
                  fill={isActive ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-elev))' : 'var(--bg-elev)'}
                  stroke={isActive ? 'var(--accent)' : 'var(--rule)'} strokeWidth={isActive ? 1.5 : 1} />
                <text x={50} y={10} textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 8.5 }}
                  fill={isActive ? 'var(--accent)' : 'var(--ink-faint)'}>
                  {sg.iso}
                </text>
                <text x={50} y={19} textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 8.5 }}
                  fill={isActive ? 'var(--accent-2)' : 'var(--ink-faint)'}>
                  |G|={ordVal}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="魔方形状的刚体旋转群" en="Rigid rotation group of cube shape" /></span>
          <span className="gt-result-val-strong">O ≅ S₄, |G| = 24</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="轨道稳定子验证" en="Orbit-stabilizer check" /></span>
          <span className="gt-result-val">6 faces × 4 rotations = {6 * 4}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="SO(3) 中闭包生成元素数" en="Closure-generated count in SO(3)" /></span>
          <span className="gt-result-val-strong" style={{ color: 'var(--green)' }}>
            {octGroup.length} <L zh="(数值验证 = 24)" en="(numerically verified = 24)" />
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="注意" en="Note" /></span>
          <span className="gt-result-val" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            <L
              zh="此 S₄ 是魔方『形状』的旋转群，不是魔方『拼图』群（后者阶约 4.3×10¹⁹）。"
              en="This S₄ is the rotation group of the cube's shape, NOT the Rubik's puzzle group (order ≈ 4.3×10¹⁹)."
            />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── §59 MatrixLieGroups ───────────────────────────────────────────────────────

export default function MatrixLieGroups() {
  const lang = useLang();

  return (
    <GTSec id="matrix-lie-groups" className="gt-sec">
      <div className="gt-sec-num">§59</div>
      <h2 className="gt-sec-title">
        <L zh="矩阵群与李群" en="Matrix &amp; Lie groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            抽象群论给了我们语言，但物理学家和几何学家最爱的那些群——三维旋转、量子自旋变换、相对论 boost——都活在矩阵的世界里。
            把群结构和光滑流形结构叠在一起，就得到<strong>李群</strong>（Lie group）：一个既可以"乘法运算"又可以"微分"的连续对称体。
            三维旋转群 <TeX src={String.raw`\mathrm{SO}(3)`} /> 是 3 维李群；它的有限子群恰好分为五族，
            其中阶为 24 的正八面体群 <TeX src={String.raw`O\cong S_4`} /> 正是魔方刚体形状的旋转群，是 <TeX src={String.raw`\mathrm{SO}(3)`} /> 中最大的多面体子群。
          </>}
          en={<>
            Abstract group theory gives us the language, but the groups beloved by physicists and geometers — 3-D rotations, quantum-spin transformations, relativistic boosts — all live inside the world of matrices.
            Layering a smooth manifold structure on top of the group axioms yields a <strong>Lie group</strong>: a continuous symmetry that can be both "multiplied" and "differentiated."
            The 3-D rotation group <TeX src={String.raw`\mathrm{SO}(3)`} /> is a 3-dimensional Lie group; its finite subgroups fall into exactly five families,
            and the order-24 octahedral group <TeX src={String.raw`O\cong S_4`} /> is precisely the rigid-rotation group of the Rubik&apos;s cube shape — the largest polyhedral subgroup of <TeX src={String.raw`\mathrm{SO}(3)`} />.
          </>}
        />
      </p>

      {/* ── Definition box: classical matrix groups ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 六大经典矩阵群" en="Definition: the six classical matrix Lie groups" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`F=\mathbb{R}`} /> 或 <TeX src={String.raw`\mathbb{C}`} />，<TeX src={String.raw`n\geq 1`} />。以下六族矩阵群均是李群（<TeX src={String.raw`\mathrm{GL}_n`} /> 的闭子群），维数为实流形维数：
            </>}
            en={<>
              Let <TeX src={String.raw`F=\mathbb{R}`} /> or <TeX src={String.raw`\mathbb{C}`} />, <TeX src={String.raw`n\geq 1`} />. The following six families are all Lie groups (closed subgroups of <TeX src={String.raw`\mathrm{GL}_n`} />), with dimensions as real manifolds:
            </>}
          />
          <table className="gt-compare" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th><L zh="记号" en="Symbol" /></th>
                <th><L zh="定义条件" en="Defining condition" /></th>
                <th><L zh="实维数" en="Real dim" /></th>
                <th><L zh="几何意义" en="Geometric meaning" /></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><TeX src={String.raw`\mathrm{GL}(n,\mathbb{R})`} /></td>
                <td><TeX src={String.raw`\det A\neq 0`} /></td>
                <td><TeX src={String.raw`n^2`} /></td>
                <td><L zh="可逆线性映射" en="Invertible linear maps" /></td>
              </tr>
              <tr>
                <td><TeX src={String.raw`\mathrm{SL}(n,\mathbb{R})`} /></td>
                <td><TeX src={String.raw`\det A=1`} /></td>
                <td><TeX src={String.raw`n^2-1`} /></td>
                <td><L zh="保体积定向" en="Volume- and orientation-preserving" /></td>
              </tr>
              <tr>
                <td><TeX src={String.raw`\mathrm{O}(n)`} /></td>
                <td><TeX src={String.raw`A^\top A=I`} /></td>
                <td><TeX src={String.raw`n(n-1)/2`} /></td>
                <td><L zh="保欧氏内积, det = ±1" en="Preserves Euclidean inner product, det = ±1" /></td>
              </tr>
              <tr>
                <td><TeX src={String.raw`\mathrm{SO}(n)`} /></td>
                <td><TeX src={String.raw`A^\top A=I,\;\det A=1`} /></td>
                <td><TeX src={String.raw`n(n-1)/2`} /></td>
                <td><L zh="旋转（保定向保长度）" en="Rotations (orientation + length preserving)" /></td>
              </tr>
              <tr>
                <td><TeX src={String.raw`\mathrm{U}(n)`} /></td>
                <td><TeX src={String.raw`A^* A=I`} /></td>
                <td><TeX src={String.raw`n^2`} /></td>
                <td><L zh="保 Hermitian 内积, |det| = 1" en="Preserves Hermitian inner product, |det| = 1" /></td>
              </tr>
              <tr>
                <td><TeX src={String.raw`\mathrm{SU}(n)`} /></td>
                <td><TeX src={String.raw`A^* A=I,\;\det A=1`} /></td>
                <td><TeX src={String.raw`n^2-1`} /></td>
                <td><L zh="量子力学的核心舞台" en="Central stage of quantum mechanics" /></td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-dim)' }}>
            <L
              zh={<>
                注意维数公式：<TeX src={String.raw`\dim\mathrm{SO}(3)=3\cdot 2/2=3`} />，
                <TeX src={String.raw`\dim\mathrm{SU}(2)=2^2-1=3`} />。两者维数相同，因为 <TeX src={String.raw`\mathrm{SU}(2)\to\mathrm{SO}(3)`} /> 是覆叠映射（局部微分同胚）。
              </>}
              en={<>
                Dimension check: <TeX src={String.raw`\dim\mathrm{SO}(3)=3\cdot 2/2=3`} />,
                <TeX src={String.raw`\dim\mathrm{SU}(2)=2^2-1=3`} />. Equal because <TeX src={String.raw`\mathrm{SU}(2)\to\mathrm{SO}(3)`} /> is a covering map (local diffeomorphism).
              </>}
            />
          </p>
        </div>
      </div>

      {/* Rodrigues formula block */}
      <p>
        <L
          zh={<>
            在 <TeX src={String.raw`\mathrm{SO}(3)`} /> 中，每个非单位元对应绕某一单位轴 <TeX src={String.raw`\mathbf{u}`} /> 旋转角度 <TeX src={String.raw`\theta`} />，其矩阵由 <strong>Rodrigues 公式</strong>给出：
          </>}
          en={<>
            In <TeX src={String.raw`\mathrm{SO}(3)`} />, every non-identity element is a rotation by angle <TeX src={String.raw`\theta`} /> about a unit axis <TeX src={String.raw`\mathbf{u}`} />, with matrix given by the <strong>Rodrigues formula</strong>:
          </>}
        />
      </p>
      <TeXBlock src={String.raw`R(\mathbf{u},\theta) = \cos\theta\cdot I + (1-\cos\theta)\,\mathbf{u}\mathbf{u}^\top + \sin\theta\,[\mathbf{u}]_\times,`} />
      <p>
        <L
          zh={<>
            其中 <TeX src={String.raw`[\mathbf{u}]_\times`} /> 是叉积对应的反对称矩阵。代入 <TeX src={String.raw`\mathbf{u}=(1,0,0)`} />、<TeX src={String.raw`\theta=90°`} /> 得
          </>}
          en={<>
            where <TeX src={String.raw`[\mathbf{u}]_\times`} /> is the skew-symmetric matrix of the cross product. Substituting <TeX src={String.raw`\mathbf{u}=(1,0,0)`} />, <TeX src={String.raw`\theta=90°`} /> yields
          </>}
        />
      </p>
      <TeXBlock src={String.raw`R_x(90°)=\begin{pmatrix}1&0&0\\0&0&-1\\0&1&0\end{pmatrix},\quad R_y(90°)=\begin{pmatrix}0&0&1\\0&1&0\\-1&0&0\end{pmatrix}.`} />
      <p>
        <L
          zh={<>
            直接计算：<TeX src={String.raw`R_x(90°)R_y(90°)=\begin{pmatrix}0&0&1\\1&0&0\\0&1&0\end{pmatrix}`} />，
            而 <TeX src={String.raw`R_y(90°)R_x(90°)=\begin{pmatrix}0&1&0\\0&0&-1\\-1&0&0\end{pmatrix}`} />，两者不等——<strong><TeX src={String.raw`\mathrm{SO}(3)`} /> 是非交换群</strong>（而 <TeX src={String.raw`\mathrm{SO}(2)`} /> 是交换的，因为平面旋转满足 <TeX src={String.raw`R(\alpha)R(\beta)=R(\alpha+\beta)`} />）。
          </>}
          en={<>
            Direct computation: <TeX src={String.raw`R_x(90°)R_y(90°)=\begin{pmatrix}0&0&1\\1&0&0\\0&1&0\end{pmatrix}`} />,
            while <TeX src={String.raw`R_y(90°)R_x(90°)=\begin{pmatrix}0&1&0\\0&0&-1\\-1&0&0\end{pmatrix}`} /> — they differ, so <strong><TeX src={String.raw`\mathrm{SO}(3)`} /> is non-abelian</strong> (while <TeX src={String.raw`\mathrm{SO}(2)`} /> is abelian since planar rotations satisfy <TeX src={String.raw`R(\alpha)R(\beta)=R(\alpha+\beta)`} />).
          </>}
        />
      </p>

      {/* ── Panel 1: Rotation Composer ── */}
      <RotationComposerPanel lang={lang} />

      {/* ── Theorem: double cover ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="SU(2) 是 SO(3) 的双重覆盖" en="SU(2) is the double cover of SO(3)" />
      </h3>

      <p>
        <L
          zh={<>
            <TeX src={String.raw`\mathrm{SU}(2)=\left\{\begin{pmatrix}\alpha&-\bar\beta\\\beta&\bar\alpha\end{pmatrix}:\alpha,\beta\in\mathbb{C},|\alpha|^2+|\beta|^2=1\right\}`} />
            作为实流形同胚于单位三球 <TeX src={String.raw`S^3\subset\mathbb{R}^4`} />，是单连通空间。将 <TeX src={String.raw`\mathrm{SU}(2)`} /> 与单位四元数等同：<TeX src={String.raw`q=(w,x,y,z)`} />，<TeX src={String.raw`|q|=1`} />，则 <TeX src={String.raw`q`} /> 对纯虚四元数 <TeX src={String.raw`v\in\mathbb{R}^3`} /> 的作用 <TeX src={String.raw`v\mapsto qvq^{-1}`} /> 是一个旋转。
          </>}
          en={<>
            <TeX src={String.raw`\mathrm{SU}(2)=\left\{\begin{pmatrix}\alpha&-\bar\beta\\\beta&\bar\alpha\end{pmatrix}:\alpha,\beta\in\mathbb{C},|\alpha|^2+|\beta|^2=1\right\}`} />
            is diffeomorphic as a real manifold to the unit 3-sphere <TeX src={String.raw`S^3\subset\mathbb{R}^4`} />, which is simply connected. Identifying <TeX src={String.raw`\mathrm{SU}(2)`} /> with unit quaternions <TeX src={String.raw`q=(w,x,y,z)`} />, <TeX src={String.raw`|q|=1`} />, the action <TeX src={String.raw`v\mapsto qvq^{-1}`} /> on a pure-imaginary quaternion <TeX src={String.raw`v\in\mathbb{R}^3`} /> gives a rotation.
          </>}
        />
      </p>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: SU(2) → SO(3) 双重覆盖" en="Theorem: SU(2) → SO(3) double cover" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              存在满的李群同态 <TeX src={String.raw`\varphi:\mathrm{SU}(2)\to\mathrm{SO}(3)`} />，其核 <TeX src={String.raw`\ker\varphi=\{I,-I\}\cong\mathbb{Z}/2`} />。
              因此 <TeX src={String.raw`\varphi`} /> 恰好 2 对 1，<TeX src={String.raw`\mathrm{SO}(3)\cong\mathrm{SU}(2)/\{\pm I\}`} />。
              拓扑上，<TeX src={String.raw`\mathrm{SO}(3)\cong\mathbb{RP}^3`} />，<TeX src={String.raw`\pi_1(\mathrm{SO}(3))\cong\mathbb{Z}/2`} />；
              而 <TeX src={String.raw`\mathrm{SU}(2)\cong S^3`} /> 单连通。
            </>}
            en={<>
              There is a surjective Lie-group homomorphism <TeX src={String.raw`\varphi:\mathrm{SU}(2)\to\mathrm{SO}(3)`} /> with kernel <TeX src={String.raw`\ker\varphi=\{I,-I\}\cong\mathbb{Z}/2`} />.
              Thus <TeX src={String.raw`\varphi`} /> is exactly 2-to-1 and <TeX src={String.raw`\mathrm{SO}(3)\cong\mathrm{SU}(2)/\{\pm I\}`} />.
              Topologically, <TeX src={String.raw`\mathrm{SO}(3)\cong\mathbb{RP}^3`} />, <TeX src={String.raw`\pi_1(\mathrm{SO}(3))\cong\mathbb{Z}/2`} />;
              while <TeX src={String.raw`\mathrm{SU}(2)\cong S^3`} /> is simply connected.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            四元数 → 旋转矩阵的显式公式：对单位四元数 <TeX src={String.raw`q=(w,x,y,z)`} />，
          </>}
          en={<>
            Explicit quaternion-to-matrix formula: for unit quaternion <TeX src={String.raw`q=(w,x,y,z)`} />,
          </>}
        />
      </p>
      <TeXBlock src={String.raw`R(q)=\begin{pmatrix}1-2(y^2+z^2)&2(xy-wz)&2(xz+wy)\\2(xy+wz)&1-2(x^2+z^2)&2(yz-wx)\\2(xz-wy)&2(yz+wx)&1-2(x^2+y^2)\end{pmatrix}.`} />
      <p>
        <L
          zh={<>
            每个分量都是 <TeX src={String.raw`q`} /> 的分量的<em>二次式</em>，因此将 <TeX src={String.raw`q`} /> 换成 <TeX src={String.raw`-q`} /> 后矩阵完全不变：<TeX src={String.raw`R(q)=R(-q)`} />。
            物理含义：自旋 1/2 粒子的量子态在旋转 360° 后变号（<TeX src={String.raw`q\to -q`} />），但可观测的旋转矩阵不变；只有绕同一轴转 720° 才回到原始量子态 <TeX src={String.raw`q`} />。
          </>}
          en={<>
            Every entry is <em>quadratic</em> in the components of <TeX src={String.raw`q`} />, so replacing <TeX src={String.raw`q`} /> by <TeX src={String.raw`-q`} /> leaves every entry unchanged: <TeX src={String.raw`R(q)=R(-q)`} />.
            Physical meaning: a spin-½ particle&apos;s quantum state picks up a sign under a 360° rotation (<TeX src={String.raw`q\to -q`} />), while the observable rotation matrix is unchanged; only a full 720° rotation returns the quantum state to <TeX src={String.raw`q`} />.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>小心：720° 转法适用于四元数/旋量态，不适用于普通物体。</strong>
            一个物理的魔方转一圈（360°）会回到原位。需要 720° 的是量子态 <TeX src={String.raw`q\in S^3`} />（皮带/板子把戏演示的正是 <TeX src={String.raw`\pi_1(\mathrm{SO}(3))=\mathbb{Z}/2`} /> 的非平凡圈）。
            另外：全对称群（含镜面反射）是 <TeX src={String.raw`S_4\times C_2`} />，阶 48，是 <TeX src={String.raw`\mathrm{O}(3)`} /> 而非 <TeX src={String.raw`\mathrm{SO}(3)`} /> 的子群。
          </>}
          en={<>
            <strong>Caution: the 720° statement applies to quaternion/spinor states, not to ordinary objects.</strong>
            A physical cube returns to its starting orientation after a 360° rotation. What requires 720° is the quantum state <TeX src={String.raw`q\in S^3`} /> (the belt/plate trick demonstrates the nontrivial element of <TeX src={String.raw`\pi_1(\mathrm{SO}(3))=\mathbb{Z}/2`} />).
            Also: the full symmetry group of the cube shape (including reflections) is <TeX src={String.raw`S_4\times C_2`} />, order 48, a subgroup of <TeX src={String.raw`\mathrm{O}(3)`} />, not <TeX src={String.raw`\mathrm{SO}(3)`} />.
          </>}
        />
      </div>

      {/* ── Panel 2: Double Cover ── */}
      <DoubleCoverPanel lang={lang} />

      {/* ── Theorem: classification of finite subgroups ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="SO(3) 的有限子群分类与魔方" en="Finite subgroups of SO(3) and the cube" />
      </h3>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理（Artin §9.7）: SO(3) 的有限子群完全分类" en="Theorem (Artin §9.7): Classification of finite subgroups of SO(3)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <TeX src={String.raw`\mathrm{SO}(3)`} /> 的每个有限子群都与下列恰好一族共轭：
              <ol style={{ marginTop: 8, paddingLeft: 22, lineHeight: 2 }}>
                <li>循环群 <TeX src={String.raw`C_n`} />（<TeX src={String.raw`n\geq 1`} />，阶 <TeX src={String.raw`n`} />）：绕固定轴的 <TeX src={String.raw`n`} /> 次旋转。</li>
                <li>二面体旋转群 <TeX src={String.raw`D_n`} />（<TeX src={String.raw`n\geq 2`} />，阶 <TeX src={String.raw`2n`} />）：正 <TeX src={String.raw`n`} /> 边形嵌入 <TeX src={String.raw`\mathbb{R}^3`} /> 后的旋转群。</li>
                <li>四面体群 <TeX src={String.raw`T\cong A_4`} />（阶 12）：正四面体的旋转群。</li>
                <li>正八面体群 <TeX src={String.raw`O\cong S_4`} />（阶 24）：正方体（等价地，正八面体）的旋转群；置换 4 条体对角线。</li>
                <li>正二十面体群 <TeX src={String.raw`I\cong A_5`} />（阶 60）：正十二面体（等价地，正二十面体）的旋转群；<TeX src={String.raw`A_5`} /> 是单群。</li>
              </ol>
              证明的关键：统计单位球上的极点（旋转轴与球的交点），再用轨道稳定子定理/Burnside 计数推导方程，最终枚举所有满足整性约束的解。
            </>}
            en={<>
              Every finite subgroup of <TeX src={String.raw`\mathrm{SO}(3)`} /> is conjugate (within <TeX src={String.raw`\mathrm{SO}(3)`} />) to exactly one of:
              <ol style={{ marginTop: 8, paddingLeft: 22, lineHeight: 2 }}>
                <li>Cyclic group <TeX src={String.raw`C_n`} /> (<TeX src={String.raw`n\geq 1`} />, order <TeX src={String.raw`n`} />): the <TeX src={String.raw`n`} /> rotations about a fixed axis.</li>
                <li>Dihedral rotation group <TeX src={String.raw`D_n`} /> (<TeX src={String.raw`n\geq 2`} />, order <TeX src={String.raw`2n`} />): rotation group of a regular <TeX src={String.raw`n`} />-gon embedded in <TeX src={String.raw`\mathbb{R}^3`} />.</li>
                <li>Tetrahedral group <TeX src={String.raw`T\cong A_4`} /> (order 12): rotation group of the regular tetrahedron.</li>
                <li>Octahedral group <TeX src={String.raw`O\cong S_4`} /> (order 24): rotation group of the cube (equivalently, the octahedron); permutes 4 body diagonals.</li>
                <li>Icosahedral group <TeX src={String.raw`I\cong A_5`} /> (order 60): rotation group of the dodecahedron (equivalently, the icosahedron); <TeX src={String.raw`A_5`} /> is a simple group.</li>
              </ol>
              Proof strategy: count &ldquo;poles&rdquo; (axis-sphere intersections) on the unit sphere, apply the orbit-stabilizer theorem / Burnside&apos;s counting lemma, and solve the resulting integrality constraints to enumerate all solutions.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            魔方与这个定理的联系是<em>真实且核心</em>的。正方体有 4 条体对角线；将旋转群 <TeX src={String.raw`O`} /> 作用于这 4 条对角线，得到 <TeX src={String.raw`S_4`} /> 的忠实表示。
            轨道稳定子定理验算：6 个面各作为轨道点，稳定子为绕该面中心的 4 次旋转（<TeX src={String.raw`0°,90°,180°,270°`} />），故 <TeX src={String.raw`|O|=6\times 4=24=|S_4|`} />。
            由分类定理，<TeX src={String.raw`O`} /> 恰好就是阶 24 的多面体子群——<strong>SO(3) 五族中唯一阶为 24 的那一族</strong>。
          </>}
          en={<>
            The connection between the Rubik&apos;s cube and this theorem is <em>genuine and central</em>. The cube has 4 body diagonals; letting <TeX src={String.raw`O`} /> act on these 4 diagonals gives a faithful representation as <TeX src={String.raw`S_4`} />.
            Orbit-stabilizer check: 6 faces each as an orbit point, stabilizer = 4 rotations about that face&apos;s center (<TeX src={String.raw`0°,90°,180°,270°`} />), so <TeX src={String.raw`|O|=6\times 4=24=|S_4|`} />.
            By the classification theorem, <TeX src={String.raw`O`} /> is exactly the order-24 polyhedral subgroup — <strong>the unique family of order 24 among the five types of finite subgroups of SO(3)</strong>.
          </>}
        />
      </p>

      {/* ── Panel 3: Finite subgroup gallery ── */}
      <FiniteSubgroupPanel lang={lang} />

      {/* ── References ── */}
      <div style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontFamily: 'var(--serif)', fontSize: 14.5, color: 'var(--ink-dim)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>
            Brian C. Hall, <em>Lie Groups, Lie Algebras, and Representations</em>, 2nd ed. (Springer GTM 222, 2015),
            Ch. 1 (matrix Lie groups, dimensions) and §1.4 / Ch. 13 (the <TeX src={String.raw`\mathrm{SU}(2)\to\mathrm{SO}(3)`} /> double cover).
          </li>
          <li>
            Michael Artin, <em>Algebra</em>, 2nd ed. (Pearson, 2011), §9.7
            &ldquo;The finite subgroups of the rotation group SO(3)&rdquo;
            (classification: <TeX src={String.raw`C_n, D_n, T\cong A_4, O\cong S_4, I\cong A_5`} />).
          </li>
          <li>
            Wikipedia, &ldquo;<a href="https://en.wikipedia.org/wiki/Special_unitary_group" target="_blank" rel="noopener noreferrer">Special unitary group</a>&rdquo;
            (<TeX src={String.raw`\mathrm{SU}(n)`} /> real dimension <TeX src={String.raw`n^2-1`} />, <TeX src={String.raw`\mathrm{SU}(2)\cong S^3`} />, 2:1 homomorphism <TeX src={String.raw`\mathrm{SU}(2)\to\mathrm{SO}(3)`} />)
            and &ldquo;<a href="https://en.wikipedia.org/wiki/Rotation_matrix" target="_blank" rel="noopener noreferrer">Rotation matrix</a>&rdquo;
            (explicit <TeX src={String.raw`R_x, R_y, R_z`} /> and the Rodrigues axis-angle formula, right-handed CCW convention).
          </li>
        </ol>
      </div>
    </GTSec>
  );
}
