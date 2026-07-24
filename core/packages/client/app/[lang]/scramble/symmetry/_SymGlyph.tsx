'use client';

/**
 * 48 个对称元素的小图示:一个三向立方体 + 该元素的几何标记。
 *   旋转轴 —— 一条穿过立方体的实心轴线,两端实心圆点
 *   瑕旋转 —— 同样的轴线,但端点画成空心(det = −1)
 *   镜面   —— 画出镜面与立方体的截面多边形
 *   反演   —— 只在中心点一个点
 * 轴的颜色按类型:面轴红、体对角绿、棱轴蓝、反演用品牌色。
 *
 * 几何在模块加载时算好(48 条),渲染只是拼 SVG。投影方向刻意取一个三个坐标
 * 分量都不相等的方向,保证 13 条对称轴没有一条退化成一个点。
 */

import { memo } from 'react';
import { SYM_ELEMENTS } from './_sym_core';

type V3 = [number, number, number];

// 视线基:视线方向 (0.549, 0.403, 0.732) 朝观察者,三个分量互不相等,
// 保证 13 条对称轴没有一条平行于视线而退化成点。UU 屏幕向右,VV 屏幕向上。
const UU: V3 = [0.7999, 0, -0.5998];
const VV: V3 = [-0.2415, 0.915, -0.3221];
const S = 7;

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

function proj(p: V3): [number, number] {
  return [+(dot(p, UU) * S).toFixed(2), +(-dot(p, VV) * S).toFixed(2)];
}

const poly = (pts: V3[]) => pts.map((p) => proj(p).join(',')).join(' ');

/** 三个朝向观察者的面(W 三个分量都为正,所以恒为 U / R / F)。 */
const FACE_U = poly([[1, 1, 1], [1, 1, -1], [-1, 1, -1], [-1, 1, 1]]);
const FACE_R = poly([[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]]);
const FACE_F = poly([[1, 1, 1], [-1, 1, 1], [-1, -1, 1], [1, -1, 1]]);

/** 立方体的 12 条棱(顶点对)。 */
const CUBE_EDGES: [V3, V3][] = (() => {
  const verts: V3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) verts.push([x, y, z]);
  const out: [V3, V3][] = [];
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      let diff = 0;
      for (let k = 0; k < 3; k++) if (verts[i][k] !== verts[j][k]) diff++;
      if (diff === 1) out.push([verts[i], verts[j]]);
    }
  }
  return out;
})();

/** 过原点、法向为 n 的平面与立方体的截面多边形(按平面内角度排好序)。 */
function planeSection(n: V3): V3[] {
  const pts: V3[] = [];
  const push = (p: V3) => {
    if (!pts.some((q) => Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9 && Math.abs(q[2] - p[2]) < 1e-9)) {
      pts.push(p);
    }
  };
  for (const [a, b] of CUBE_EDGES) {
    const da = dot(a, n);
    const db = dot(b, n);
    if (da === 0) push(a);
    if (db === 0) push(b);
    if (da * db < 0) {
      const t = da / (da - db);
      push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  // 平面内建正交基后按极角排序
  const ref: V3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1raw: V3 = [
    ref[0] - n[0] * dot(ref, n) / dot(n, n),
    ref[1] - n[1] * dot(ref, n) / dot(n, n),
    ref[2] - n[2] * dot(ref, n) / dot(n, n),
  ];
  const l1 = Math.hypot(...e1raw);
  const e1 = scale(e1raw, 1 / l1);
  const e2raw: V3 = [
    n[1] * e1[2] - n[2] * e1[1],
    n[2] * e1[0] - n[0] * e1[2],
    n[0] * e1[1] - n[1] * e1[0],
  ];
  const l2 = Math.hypot(...e2raw);
  const e2 = scale(e2raw, 1 / l2);
  return pts.slice().sort((p, q) => Math.atan2(dot(p, e2), dot(p, e1)) - Math.atan2(dot(q, e2), dot(q, e1)));
}

type Tone = 'face' | 'corner' | 'edge' | 'point';

interface Glyph {
  tone: Tone;
  /** 轴线两端(屏幕坐标);null = 没有轴线。 */
  line: [[number, number], [number, number]] | null;
  /** 端点空心(瑕旋转 / 镜面)。 */
  hollow: boolean;
  /** 镜面截面多边形的 points 串。 */
  plane: string | null;
  /** 只画中心点(恒等 / 反演)。 */
  centre: boolean;
}

const GLYPHS: Glyph[] = SYM_ELEMENTS.map((e) => {
  const nonZero = e.axisVec.filter((v) => v !== 0).length;
  const tone: Tone = e.cls === 'E' || e.cls === 'i' ? 'point'
    : nonZero === 1 ? 'face' : nonZero === 3 ? 'corner' : 'edge';
  if (e.cls === 'E') return { tone, line: null, hollow: false, plane: null, centre: false };
  if (e.cls === 'i') return { tone, line: null, hollow: false, plane: null, centre: true };
  if (e.cls === 'sh' || e.cls === 'sd') {
    return { tone, line: null, hollow: true, plane: poly(planeSection(e.axisVec)), centre: false };
  }
  const a = scale(e.axisVec, 1.18);
  return {
    tone,
    line: [proj(scale(a, -1)), proj(a)],
    hollow: e.det < 0,
    plane: null,
    centre: false,
  };
});

export const SYM_GLYPH_TONE = GLYPHS.map((g) => g.tone);

interface Props {
  idx: number;
  size?: number;
  className?: string;
}

function SymGlyphImpl({ idx, size = 22, className }: Props) {
  const g = GLYPHS[idx];
  return (
    <svg
      className={`sym-glyph tone-${g.tone}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="-12 -12 24 24"
      aria-hidden
      focusable="false"
    >
      <polygon className="sym-glyph-face sym-glyph-face-u" points={FACE_U} />
      <polygon className="sym-glyph-face sym-glyph-face-r" points={FACE_R} />
      <polygon className="sym-glyph-face sym-glyph-face-f" points={FACE_F} />
      {g.plane && <polygon className="sym-glyph-plane" points={g.plane} />}
      {g.line && (
        <>
          <line
            className="sym-glyph-axis"
            x1={g.line[0][0]} y1={g.line[0][1]} x2={g.line[1][0]} y2={g.line[1][1]}
          />
          {g.line.map((p, i) => (
            <circle
              key={i}
              className={`sym-glyph-dot${g.hollow ? ' is-hollow' : ''}`}
              cx={p[0]} cy={p[1]} r={2.4}
            />
          ))}
        </>
      )}
      {g.centre && <circle className="sym-glyph-dot" cx={0} cy={0} r={2.6} />}
      {!g.line && !g.plane && !g.centre && (
        <circle className="sym-glyph-dot is-hollow" cx={0} cy={0} r={2.6} />
      )}
    </svg>
  );
}

export const SymGlyph = memo(SymGlyphImpl);
