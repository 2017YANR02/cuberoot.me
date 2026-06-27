'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── 2D geometry helpers ──────────────────────────────────────────────────────

/** 2D vector */
type Vec2 = [number, number];

function dot(a: Vec2, b: Vec2): number { return a[0]*b[0] + a[1]*b[1]; }
function cross2(a: Vec2, b: Vec2): number { return a[0]*b[1] - a[1]*b[0]; }
function norm(v: Vec2): number { return Math.hypot(v[0], v[1]); }
function normalize(v: Vec2): Vec2 { const n = norm(v); return n < 1e-12 ? [1,0] : [v[0]/n, v[1]/n]; }
function perp(v: Vec2): Vec2 { return [-v[1], v[0]]; }
function add(a: Vec2, b: Vec2): Vec2 { return [a[0]+b[0], a[1]+b[1]]; }
function sub(a: Vec2, b: Vec2): Vec2 { return [a[0]-b[0], a[1]-b[1]]; }
function scale(v: Vec2, s: number): Vec2 { return [v[0]*s, v[1]*s]; }

/**
 * Reflect point x across line through point p with unit direction u.
 * n = perp(u) is the unit normal.
 * f(x) = x - 2*((x-p)·n)*n
 */
function reflectPoint(x: Vec2, p: Vec2, u: Vec2): Vec2 {
  const n = perp(normalize(u));
  const d = dot(sub(x, p), n);
  return sub(x, scale(n, 2*d));
}

/** Reflect all points of the motif (list of Vec2) across line (p, u). */
function reflectMotif(pts: Vec2[], p: Vec2, u: Vec2): Vec2[] {
  return pts.map(pt => reflectPoint(pt, p, u));
}

/**
 * Classify the composite s2 ∘ s1 (apply s1 first then s2).
 * Lines: L1 through p1 with direction u1, L2 through p2 with direction u2.
 * Returns { type: 'rotation', angle, center } or { type: 'translation', vec }.
 */
interface RotResult { type: 'rotation'; angle: number; center: Vec2 }
interface TransResult { type: 'translation'; vec: Vec2 }
type CompositeResult = RotResult | TransResult;

function classifyComposite(p1: Vec2, u1: Vec2, p2: Vec2, u2: Vec2): CompositeResult {
  const un1 = normalize(u1);
  const un2 = normalize(u2);
  // Signed angle FROM L1 TO L2
  const sinA = cross2(un1, un2);
  const cosA = dot(un1, un2);
  const eps = 1e-6;
  if (Math.abs(sinA) < eps) {
    // Parallel lines: translation by 2d*n1, where n1 = perp(u1)
    const n1 = perp(un1);
    const d = dot(sub(p2, p1), n1); // signed distance from L1 to L2
    return { type: 'translation', vec: scale(n1, 2*d) };
  } else {
    // Intersecting: rotation about intersection by 2*theta
    const theta = Math.atan2(sinA, cosA); // angle from u1 to u2
    // Find intersection O of L1 and L2
    // L1: p1 + t*u1, L2: p2 + s*u2
    // cross product method:
    const dp = sub(p2, p1);
    const denom = cross2(un1, un2);
    const t = cross2(dp, un2) / denom;
    const center: Vec2 = [p1[0] + t*un1[0], p1[1] + t*un1[1]];
    return { type: 'rotation', angle: 2*theta, center };
  }
}

// ── The "F" shaped motif in local coords (asymmetric) ───────────────────────
// Defined in a coordinate system where the canvas viewBox is ~[-2,2]x[-2,2]
const MOTIF_BASE: Vec2[] = [
  // Stem of F (left side vertical)
  [-0.25, -0.5], [0.05, -0.5], [0.05, 0.5], [-0.25, 0.5],
];
const MOTIF_CROSSBARS: [Vec2[], Vec2[]] = [
  // Top crossbar
  [[0.05, 0.25], [0.45, 0.25], [0.45, 0.5], [0.05, 0.5]],
  // Middle crossbar
  [[0.05, 0.0], [0.35, 0.0], [0.35, 0.2], [0.05, 0.2]],
];

/** Render an "F" motif as SVG path data from a list of polygon pieces. */
function renderMotif(pieces: Vec2[][], toSvgX: (x: number) => number, toSvgY: (y: number) => number, fill: string, opacity = 1, strokeColor = 'none') {
  return pieces.map((pts, i) => (
    <polygon
      key={i}
      points={pts.map(([x,y]) => `${toSvgX(x).toFixed(2)},${toSvgY(y).toFixed(2)}`).join(' ')}
      fill={fill}
      fillOpacity={opacity}
      stroke={strokeColor}
      strokeWidth={strokeColor !== 'none' ? 0.8 : 0}
    />
  ));
}

/** Translate motif pieces by a vector. */
function translateMotifPieces(pieces: Vec2[][], offset: Vec2): Vec2[][] {
  return pieces.map(pts => pts.map(pt => add(pt, offset)));
}

/** Reflect all pieces of a motif. */
function reflectMotifPieces(pieces: Vec2[][], p: Vec2, u: Vec2): Vec2[][] {
  return pieces.map(pts => reflectMotif(pts, p, u));
}

// ── Widget 1: Two-mirror composer ────────────────────────────────────────────

interface LineState {
  /** A point on the line (in world coords, [-2,2] viewBox) */
  p: Vec2;
  /** Direction angle of the line (radians) */
  angle: number;
}

function toDeg(r: number): number { return r * 180 / Math.PI; }

function TwoMirrorComposer() {
  const lang = useLang();

  // Line 1: default nearly vertical, on the left
  const [line1, setLine1] = useState<LineState>({ p: [-0.6, 0], angle: Math.PI/2 - 0.3 });
  // Line 2: default tilted, on the right / intersecting
  const [line2, setLine2] = useState<LineState>({ p: [0.6, 0], angle: Math.PI/2 + 0.5 });
  const [showGhost, setShowGhost] = useState(true);

  // SVG canvas setup: viewBox [-2.2, 2.2]^2, 300x300 px
  const VB = 2.2;
  const svgSize = 300;
  const toSvgX = (x: number) => (x + VB) / (2*VB) * svgSize;
  const toSvgY = (y: number) => (-y + VB) / (2*VB) * svgSize;
  const fromSvgX = (sx: number) => (sx / svgSize) * (2*VB) - VB;
  const fromSvgY = (sy: number) => -((sy / svgSize) * (2*VB) - VB);

  const svgRef = useRef<SVGSVGElement>(null);

  // Dragging state: which handle is being dragged
  type DragTarget = 'l1-p' | 'l1-a' | 'l2-p' | 'l2-a' | null;
  const dragRef = useRef<DragTarget>(null);

  const getSvgCoords = useCallback((e: React.PointerEvent<SVGSVGElement>): Vec2 => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * svgSize;
    const py = (e.clientY - rect.top) / rect.height * svgSize;
    return [fromSvgX(px), fromSvgY(py)];
  }, [fromSvgX, fromSvgY]);

  const handlePointerDown = useCallback((target: DragTarget) => (e: React.PointerEvent<SVGElement>) => {
    dragRef.current = target;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  }, []);

  const handleSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const [wx, wy] = getSvgCoords(e);
    const t = dragRef.current;
    if (t === 'l1-p') setLine1(l => ({ ...l, p: [wx, wy] }));
    else if (t === 'l2-p') setLine2(l => ({ ...l, p: [wx, wy] }));
    else if (t === 'l1-a') {
      setLine1(l => {
        const a = Math.atan2(wy - l.p[1], wx - l.p[0]);
        return { ...l, angle: a };
      });
    } else if (t === 'l2-a') {
      setLine2(l => {
        const a = Math.atan2(wy - l.p[1], wx - l.p[0]);
        return { ...l, angle: a };
      });
    }
  }, [getSvgCoords]);

  const handleSvgPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // Compute motif and reflections
  const motifOffset: Vec2 = [-1.2, -0.6];
  const motifPieces: Vec2[][] = [translateMotifPieces([MOTIF_BASE, ...MOTIF_CROSSBARS], motifOffset)[0],
    ...translateMotifPieces([MOTIF_BASE, ...MOTIF_CROSSBARS], motifOffset).slice(1)];

  const u1 = useMemo((): Vec2 => [Math.cos(line1.angle), Math.sin(line1.angle)], [line1.angle]);
  const u2 = useMemo((): Vec2 => [Math.cos(line2.angle), Math.sin(line2.angle)], [line2.angle]);

  const afterL1 = useMemo(() => reflectMotifPieces(motifPieces, line1.p, u1), [motifPieces, line1.p, u1]);
  const afterL2 = useMemo(() => reflectMotifPieces(afterL1, line2.p, u2), [afterL1, line2.p, u2]);

  const result = useMemo(() => classifyComposite(line1.p, u1, line2.p, u2), [line1.p, u1, line2.p, u2]);

  /** Extend a line to canvas edges for drawing. Returns [x1,y1, x2,y2] in SVG coords. */
  function lineEndpoints(p: Vec2, u: Vec2): [number, number, number, number] {
    const tMax = 6;
    return [
      toSvgX(p[0] - tMax * u[0]), toSvgY(p[1] - tMax * u[1]),
      toSvgX(p[0] + tMax * u[0]), toSvgY(p[1] + tMax * u[1]),
    ];
  }

  const [lx1, ly1, lx2, ly2] = lineEndpoints(line1.p, u1);
  const [mx1, my1, mx2, my2] = lineEndpoints(line2.p, u2);

  // Handle positions for dragging angle
  const handleOffset = 0.9;
  const h1a: Vec2 = [line1.p[0] + handleOffset * u1[0], line1.p[1] + handleOffset * u1[1]];
  const h2a: Vec2 = [line2.p[0] + handleOffset * u2[0], line2.p[1] + handleOffset * u2[1]];

  // Result label
  let resultLabel: string;
  let angleDeg = 0;
  if (result.type === 'rotation') {
    angleDeg = toDeg(result.angle);
    const deg = Math.round(angleDeg * 10) / 10;
    resultLabel = lang === 'zh'
      ? `旋转 ${deg}° 绕交点`
      : `Rotation ${deg}° about intersection`;
  } else {
    const vx = Math.round(result.vec[0] * 100) / 100;
    const vy = Math.round(result.vec[1] * 100) / 100;
    const mag = Math.round(norm(result.vec) * 100) / 100;
    resultLabel = lang === 'zh'
      ? `平移 (${vx}, ${vy})，|v| = ${mag}`
      : `Translation (${vx}, ${vy}), |v| = ${mag}`;
  }

  // Angle between lines for display
  const sinA = Math.abs(cross2(u1, u2));
  const cosA = Math.abs(dot(u1, u2));
  const angleBetween = Math.atan2(sinA, cosA);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="双镜复合器：拖动镜面，实时分类复合等距" en="Two-Mirror Composer: drag the mirrors, classify the composite live" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>拖动 <strong>L₁</strong>（红色）和 <strong>L₂</strong>（蓝色）的中心点或角度手柄，观察「先反射 L₁、再反射 L₂」的合成。两线相交 → 绕交点旋转 <TeX src={String.raw`2\theta`} />；两线平行 → 沿垂直方向平移 <TeX src={String.raw`2d`} />。</>}
          en={<>Drag the center or angle handle of <strong>L₁</strong> (red) and <strong>L₂</strong> (blue). The composite s₂∘s₁ (apply L₁ first) is classified live: intersecting lines → rotation by 2θ; parallel lines → translation by 2d.</>}
        />
      </p>
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)' }}>
          <input type="checkbox" checked={showGhost} onChange={e => setShowGhost(e.target.checked)} style={{ marginRight: 6 }} />
          <L zh="显示中间像（经 L₁ 后）" en="Show ghost (after L₁ only)" />
        </label>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        width="100%"
        style={{ display: 'block', maxWidth: 380, margin: '8px auto', touchAction: 'none', cursor: 'default' }}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
      >
        {/* Background */}
        <rect x={0} y={0} width={svgSize} height={svgSize} fill="var(--bg-elev)" rx={4} />
        {/* Grid lines */}
        {[-1, 0, 1].map(v => (
          <g key={v}>
            <line x1={toSvgX(v)} y1={0} x2={toSvgX(v)} y2={svgSize} stroke="var(--rule)" strokeWidth={v===0?1:0.5} strokeDasharray={v===0?'':' 3 3'} />
            <line x1={0} y1={toSvgY(v)} x2={svgSize} y2={toSvgY(v)} stroke="var(--rule)" strokeWidth={v===0?1:0.5} strokeDasharray={v===0?'':' 3 3'} />
          </g>
        ))}

        {/* Mirror lines */}
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="var(--accent)" strokeWidth={1.8} opacity={0.8} />
        <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="var(--accent-2)" strokeWidth={1.8} opacity={0.8} />

        {/* Line labels */}
        <text x={toSvgX(line1.p[0]) + 10} y={toSvgY(line1.p[1]) - 10} fontSize={13} fill="var(--accent)" fontFamily="var(--mono)" fontWeight="600">L₁</text>
        <text x={toSvgX(line2.p[0]) + 10} y={toSvgY(line2.p[1]) - 10} fontSize={13} fill="var(--accent-2)" fontFamily="var(--mono)" fontWeight="600">L₂</text>

        {/* Result annotation */}
        {result.type === 'rotation' && (() => {
          const cx = toSvgX(result.center[0]);
          const cy = toSvgY(result.center[1]);
          const arcR = 22;
          // Draw arc from start angle to start + 2*theta
          const startAngle = 0;
          const endAngle = -result.angle; // SVG y-axis is flipped
          const x1 = cx + arcR * Math.cos(startAngle);
          const y1 = cy + arcR * Math.sin(startAngle);
          const x2 = cx + arcR * Math.cos(endAngle);
          const y2 = cy + arcR * Math.sin(endAngle);
          const largeArc = Math.abs(result.angle) > Math.PI ? 1 : 0;
          const sweep = result.angle > 0 ? 0 : 1;
          return (
            <>
              <circle cx={cx} cy={cy} r={5} fill="var(--green)" />
              <path d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 ${largeArc} ${sweep} ${x2} ${y2}`}
                fill="none" stroke="var(--green)" strokeWidth={1.5} />
              <text x={cx + 10} y={cy - 8} fontSize={10} fill="var(--green)" fontFamily="var(--mono)">O</text>
            </>
          );
        })()}
        {result.type === 'translation' && (() => {
          const cx = toSvgX(0.5), cy = toSvgY(0.5);
          const ex = cx + result.vec[0] * svgSize / (2*VB) * 0.5;
          const ey = cy - result.vec[1] * svgSize / (2*VB) * 0.5;
          // Arrow
          const dx = ex - cx, dy = ey - cy;
          const len = Math.hypot(dx, dy);
          if (len > 5) {
            const nx = dx/len, ny = dy/len;
            const ah = 8;
            return (
              <g>
                <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--gold)" strokeWidth={2} />
                <polygon
                  points={`${ex},${ey} ${ex-ah*nx+ah*0.4*ny},${ey-ah*ny-ah*0.4*nx} ${ex-ah*nx-ah*0.4*ny},${ey-ah*ny+ah*0.4*nx}`}
                  fill="var(--gold)" />
                <text x={(cx+ex)/2+6} y={(cy+ey)/2-6} fontSize={10} fill="var(--gold)" fontFamily="var(--mono)">2d</text>
              </g>
            );
          }
          return null;
        })()}

        {/* Original motif (red-ish) */}
        {renderMotif(motifPieces, toSvgX, toSvgY, 'var(--accent)', 0.7)}

        {/* Ghost after L1 (dashed outline only if showGhost) */}
        {showGhost && afterL1.map((pts, i) => (
          <polygon
            key={`ghost-${i}`}
            points={pts.map(([x,y]) => `${toSvgX(x).toFixed(2)},${toSvgY(y).toFixed(2)}`).join(' ')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.5}
          />
        ))}

        {/* Final image after L2 (blue solid) */}
        {renderMotif(afterL2, toSvgX, toSvgY, 'var(--accent-2)', 0.75)}

        {/* Drag handles: center of L1 */}
        <circle
          cx={toSvgX(line1.p[0])} cy={toSvgY(line1.p[1])} r={7}
          fill="var(--accent)" stroke="var(--bg)" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handlePointerDown('l1-p')}
        />
        {/* Angle handle L1 */}
        <circle
          cx={toSvgX(h1a[0])} cy={toSvgY(h1a[1])} r={5}
          fill="var(--bg)" stroke="var(--accent)" strokeWidth={2}
          style={{ cursor: 'crosshair' }}
          onPointerDown={handlePointerDown('l1-a')}
        />
        {/* Center handle L2 */}
        <circle
          cx={toSvgX(line2.p[0])} cy={toSvgY(line2.p[1])} r={7}
          fill="var(--accent-2)" stroke="var(--bg)" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handlePointerDown('l2-p')}
        />
        {/* Angle handle L2 */}
        <circle
          cx={toSvgX(h2a[0])} cy={toSvgY(h2a[1])} r={5}
          fill="var(--bg)" stroke="var(--accent-2)" strokeWidth={2}
          style={{ cursor: 'crosshair' }}
          onPointerDown={handlePointerDown('l2-a')}
        />
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="两镜夹角 θ" en="angle between mirrors θ" /></span>
          <span className="gt-result-val">{Math.round(toDeg(angleBetween) * 10)/10}°</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="复合类型" en="composite type" /></span>
          <span className="gt-result-val-strong" style={{ color: result.type === 'rotation' ? 'var(--green)' : 'var(--gold)' }}>
            {result.type === 'rotation'
              ? tr({ zh: '旋转', en: 'Rotation'
                                      })
              : tr({ zh: '平移', en: 'Translation' })}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="结果" en="result" /></span>
          <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{resultLabel}</span>
        </div>
        {result.type === 'rotation' && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="旋转角 = 2θ" en="rotation angle = 2θ" /></span>
            <span className="gt-result-val"><TeX src={String.raw`2\times${Math.round(toDeg(angleBetween)*10)/10}^\circ = ${Math.round(2*toDeg(angleBetween)*10)/10}^\circ`} /></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Widget 2: Isometry classifier ────────────────────────────────────────────

type IsomType = 'rotation' | 'reflection';

function IsometryClassifier() {
  const lang = useLang();
  const [isomType, setIsomType] = useState<IsomType>('rotation');
  const [alpha, setAlpha] = useState(60); // rotation angle in degrees
  const [refAngle, setRefAngle] = useState(30); // reflection line angle in degrees
  const [tx, setTx] = useState(0.4); // translation vector x
  const [ty, setTy] = useState(0.5); // translation vector y

  // Compute the 2x2 matrix A and translation b
  const { A, b, detA, classResult } = useMemo(() => {
    const ar = alpha * Math.PI / 180;
    const ra = refAngle * Math.PI / 180;

    let A: [[number,number],[number,number]];
    if (isomType === 'rotation') {
      A = [[Math.cos(ar), -Math.sin(ar)], [Math.sin(ar), Math.cos(ar)]];
    } else {
      const c2 = Math.cos(2*ra), s2 = Math.sin(2*ra);
      A = [[c2, s2], [s2, -c2]];
    }
    const b: Vec2 = [tx, ty];
    const detA = A[0][0]*A[1][1] - A[0][1]*A[1][0];

    // Classify
    let classResult: string;
    if (Math.abs(detA - 1) < 1e-6) {
      // Direct isometry
      // Try to find fixed point: (I - A)c = b
      const d00 = 1 - A[0][0], d01 = -A[0][1];
      const d10 = -A[1][0], d11 = 1 - A[1][1];
      const denom = d00*d11 - d01*d10;
      if (Math.abs(denom) > 1e-6) {
        // Has fixed point -> rotation
        const cx = (d11*b[0] - d01*b[1]) / denom;
        const cy = (-d10*b[0] + d00*b[1]) / denom;
        const angleDeg = Math.round(ar * 1800 / Math.PI) / 10;
        classResult = lang === 'zh'
          ? `旋转 ${angleDeg}° 绕 (${Math.round(cx*100)/100}, ${Math.round(cy*100)/100})`
          : `Rotation ${angleDeg}° about (${Math.round(cx*100)/100}, ${Math.round(cy*100)/100})`;
      } else {
        // A = I, translation
        if (Math.hypot(b[0], b[1]) < 1e-6) {
          classResult = tr({ zh: '恒等变换（零平移）', en: 'Identity (zero translation)'
        });
        } else {
          classResult = lang === 'zh'
            ? `平移 (${Math.round(b[0]*100)/100}, ${Math.round(b[1]*100)/100})`
            : `Translation (${Math.round(b[0]*100)/100}, ${Math.round(b[1]*100)/100})`;
        }
      }
    } else {
      // Opposite isometry: det A = -1, A^2 = I
      // g = f∘f: linear part A^2 = I, translation part = Ab + b
      const gTx = A[0][0]*b[0] + A[0][1]*b[1] + b[0];
      const gTy = A[1][0]*b[0] + A[1][1]*b[1] + b[1];
      if (Math.hypot(gTx, gTy) < 1e-6) {
        // g = id => pure reflection
        const fixedAngle = isomType === 'reflection' ? refAngle : 0;
        classResult = lang === 'zh'
          ? `反射（轴角 ${fixedAngle}°）`
          : `Reflection (axis angle ${fixedAngle}°)`;
      } else {
        // Glide reflection: glide vector = (Ab+b)/2
        const gvx = Math.round(gTx/2*100)/100;
        const gvy = Math.round(gTy/2*100)/100;
        classResult = lang === 'zh'
          ? `滑移反射，滑移向量 (${gvx}, ${gvy})`
          : `Glide reflection, glide vector (${gvx}, ${gvy})`;
      }
    }

    return { A, b, detA, classResult };
  }, [isomType, alpha, refAngle, tx, ty, lang]);

  // Motif: unit square with a marked corner
  const squarePts: Vec2[] = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]];
  const markerPt: Vec2 = [0.5, 0.5]; // marked corner

  // Apply f to a point: f(x) = Ax + b
  function applyF(pt: Vec2): Vec2 {
    return [A[0][0]*pt[0] + A[0][1]*pt[1] + b[0], A[1][0]*pt[0] + A[1][1]*pt[1] + b[1]];
  }

  const transformedSq = squarePts.map(applyF);
  const transformedMarker = applyF(markerPt);

  const VB = 2.2;
  const svgSize = 280;
  const toSvgX = (x: number) => (x + VB) / (2*VB) * svgSize;
  const toSvgY = (y: number) => (-y + VB) / (2*VB) * svgSize;

  const directionLabel = Math.abs(detA - 1) < 1e-6
    ? tr({ zh: '正向（保向）', en: 'Direct (orientation-preserving)' })
    : tr({ zh: '反向（反向等距）', en: 'Opposite (orientation-reversing)' });

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="等距分类器：任意 f(x) = Ax + b 的实时类型判定" en="Isometry Classifier: live type detection for f(x) = Ax + b" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>选择线性部分 <TeX src={String.raw`A \in O(2)`} /> 的类型和平移向量 <TeX src={String.raw`b`} />，系统实时计算 <TeX src={String.raw`\det A`} />、不动点，以及四类等距中的归属。</>}
          en={<>Choose the linear part <TeX src={String.raw`A \in O(2)`} /> and translation vector <TeX src={String.raw`b`} />; the system computes <TeX src={String.raw`\det A`} />, fixed points, and the classification among the four types live.</>}
        />
      </p>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)' }}>
          <L zh="线性部分 A：" en="Linear part A:" />
        </span>
        <button
          className={`gt-chip ${isomType === 'rotation' ? 'gt-chip-active' : ''}`}
          onClick={() => setIsomType('rotation')}>
          <L zh="旋转矩阵 R(α)" en="Rotation R(α)" />
        </button>
        <button
          className={`gt-chip ${isomType === 'reflection' ? 'gt-chip-active' : ''}`}
          onClick={() => setIsomType('reflection')}>
          <L zh="反射矩阵 M(a)" en="Reflection M(a)" />
        </button>
      </div>

      {isomType === 'rotation' && (
        <div className="gt-panel-input-row">
          <label style={{ fontFamily: 'var(--mono)', fontSize: 13, whiteSpace: 'nowrap' }}>
            α = {alpha}°
          </label>
          <input type="range" min={-180} max={180} step={5} value={alpha}
            onChange={e => setAlpha(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }} />
        </div>
      )}
      {isomType === 'reflection' && (
        <div className="gt-panel-input-row">
          <label style={{ fontFamily: 'var(--mono)', fontSize: 13, whiteSpace: 'nowrap' }}>
            a = {refAngle}°
          </label>
          <input type="range" min={0} max={175} step={5} value={refAngle}
            onChange={e => setRefAngle(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-2)' }} />
        </div>
      )}

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)', whiteSpace: 'nowrap' }}>
          <L zh="平移 b:" en="Translation b:" />
        </span>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          bₓ {Math.round(tx*100)/100}
          <input type="range" min={-1} max={1} step={0.05} value={tx}
            onChange={e => setTx(Number(e.target.value))}
            style={{ width: 80, accentColor: 'var(--gold)' }} />
        </label>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          b_y {Math.round(ty*100)/100}
          <input type="range" min={-1} max={1} step={0.05} value={ty}
            onChange={e => setTy(Number(e.target.value))}
            style={{ width: 80, accentColor: 'var(--gold)' }} />
        </label>
      </div>

      <svg viewBox={`0 0 ${svgSize} ${svgSize}`} width="100%"
        style={{ display: 'block', maxWidth: 340, margin: '10px auto' }}>
        <rect x={0} y={0} width={svgSize} height={svgSize} fill="var(--bg-elev)" rx={4} />
        {/* Axes */}
        <line x1={toSvgX(-VB)} y1={toSvgY(0)} x2={toSvgX(VB)} y2={toSvgY(0)} stroke="var(--rule)" strokeWidth={1} />
        <line x1={toSvgX(0)} y1={toSvgY(-VB)} x2={toSvgX(0)} y2={toSvgY(VB)} stroke="var(--rule)" strokeWidth={1} />
        {/* Original square */}
        <polygon
          points={squarePts.map(([x,y]) => `${toSvgX(x)},${toSvgY(y)}`).join(' ')}
          fill="var(--accent)" fillOpacity={0.25} stroke="var(--accent)" strokeWidth={1.5}
        />
        <circle cx={toSvgX(markerPt[0])} cy={toSvgY(markerPt[1])} r={4} fill="var(--accent)" />
        <text x={toSvgX(0.55)} y={toSvgY(0.55)} fontSize={10} fill="var(--accent)" fontFamily="var(--mono)">P</text>
        {/* Transformed square */}
        <polygon
          points={transformedSq.map(([x,y]) => `${toSvgX(x)},${toSvgY(y)}`).join(' ')}
          fill="var(--accent-2)" fillOpacity={0.25} stroke="var(--accent-2)" strokeWidth={1.5}
        />
        <circle cx={toSvgX(transformedMarker[0])} cy={toSvgY(transformedMarker[1])} r={4} fill="var(--accent-2)" />
        <text x={toSvgX(transformedMarker[0]+0.07)} y={toSvgY(transformedMarker[1]+0.07)} fontSize={10} fill="var(--accent-2)" fontFamily="var(--mono)">f(P)</text>
        {/* Reflection axis line if reflection type */}
        {isomType === 'reflection' && (() => {
          const ra = refAngle * Math.PI / 180;
          const u: Vec2 = [Math.cos(ra), Math.sin(ra)];
          const T = 2.5;
          return <line
            x1={toSvgX(-T*u[0])} y1={toSvgY(-T*u[1])}
            x2={toSvgX(T*u[0])} y2={toSvgY(T*u[1])}
            stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="5 3"
          />;
        })()}
        {/* Fixed point dot for rotations */}
        {(() => {
          if (Math.abs(detA - 1) < 1e-6) {
            const d00 = 1 - A[0][0], d01 = -A[0][1];
            const d10 = -A[1][0], d11 = 1 - A[1][1];
            const denom = d00*d11 - d01*d10;
            if (Math.abs(denom) > 1e-6) {
              const cx = (d11*b[0] - d01*b[1]) / denom;
              const cy = (-d10*b[0] + d00*b[1]) / denom;
              return <circle cx={toSvgX(cx)} cy={toSvgY(cy)} r={5} fill="var(--green)" stroke="var(--bg)" strokeWidth={1.5} />;
            }
          }
          return null;
        })()}
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\det A`} /></span>
          <span className="gt-result-val" style={{ color: Math.abs(detA-1) < 1e-6 ? 'var(--green)' : 'var(--warn)' }}>
            {Math.abs(detA-1) < 1e-6 ? '+1' : '−1'}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="方向性" en="Orientation" /></span>
          <span className="gt-result-val">{directionLabel}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="等距类型" en="Isometry type" /></span>
          <span className="gt-result-val-strong">{classResult}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="决策依据" en="Decision basis" /></span>
          <span className="gt-result-val" style={{ fontSize: 12, color: 'var(--ink-dim)', fontFamily: 'var(--mono)' }}>
            {Math.abs(detA-1) < 1e-6
              ? tr({ zh: 'det=+1 → 直接等距 → 检查不动点', en: 'det=+1 → direct → check fixed point'
                                      })
              : tr({ zh: 'det=−1 → 反向等距 → 检查 f∘f', en: 'det=−1 → opposite → check f∘f'
                                      })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Widget 3: Rotation = two reflections (non-uniqueness) ────────────────────

function RotationTwoReflections() {
  const [phi, setPhi] = useState(90); // target rotation angle in degrees
  const [beta, setBeta] = useState(20); // base orientation of mirror pair

  const phiR = phi * Math.PI / 180;
  const betaR = beta * Math.PI / 180;

  // L1: through origin at angle beta, L2: through origin at angle beta + phi/2
  const u1: Vec2 = [Math.cos(betaR), Math.sin(betaR)];
  const u2: Vec2 = [Math.cos(betaR + phiR/2), Math.sin(betaR + phiR/2)];
  const O: Vec2 = [0, 0];

  // Motif placed offset from center
  const motifOff: Vec2 = [0.9, 0.3];
  const motifPcs: Vec2[][] = translateMotifPieces([MOTIF_BASE, ...MOTIF_CROSSBARS], motifOff);

  const afterL1 = useMemo(() => reflectMotifPieces(motifPcs, O, u1), [motifPcs, u1]);
  const afterL2 = useMemo(() => reflectMotifPieces(afterL1, O, u2), [afterL1, u2]);

  // Verify: afterL2 should equal rotating motifPcs by phi about O
  const rotatePt = (pt: Vec2): Vec2 => [
    pt[0]*Math.cos(phiR) - pt[1]*Math.sin(phiR),
    pt[0]*Math.sin(phiR) + pt[1]*Math.cos(phiR),
  ];
  const expectedPts = motifPcs[0].map(rotatePt);
  const maxErr = Math.max(...afterL2[0].map((pt, i) => Math.hypot(pt[0]-expectedPts[i][0], pt[1]-expectedPts[i][1])));
  const verified = maxErr < 1e-9;

  const VB = 2.2;
  const svgSize = 290;
  const toSvgX = (x: number) => (x + VB) / (2*VB) * svgSize;
  const toSvgY = (y: number) => (-y + VB) / (2*VB) * svgSize;

  function extendedLine(u: Vec2, len = 2.5): [number, number, number, number] {
    return [toSvgX(-len*u[0]), toSvgY(-len*u[1]), toSvgX(len*u[0]), toSvgY(len*u[1])];
  }

  const [e1x1, e1y1, e1x2, e1y2] = extendedLine(u1);
  const [e2x1, e2y1, e2x2, e2y2] = extendedLine(u2);

  // Arc showing rotation
  const arcR = 30;
  // start direction: from O toward motif center
  const mc0 = motifOff;
  const startAngle = Math.atan2(mc0[1], mc0[0]);
  const endAngle = startAngle + phiR;
  const arcSx = toSvgX(0) + arcR * Math.cos(-startAngle); // SVG y flipped
  const arcSy = toSvgY(0) + arcR * Math.sin(-startAngle);
  const arcEx = toSvgX(0) + arcR * Math.cos(-endAngle);
  const arcEy = toSvgY(0) + arcR * Math.sin(-endAngle);
  const largeArc = Math.abs(phiR) > Math.PI ? 1 : 0;
  const sweepFlag = phiR > 0 ? 0 : 1;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="旋转 = 任意两次反射（镜面非唯一）" en="Rotation = any two reflections (mirrors non-unique)" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>固定旋转角 <TeX src={String.raw`\varphi`} /> 和中心 O，拖动「镜面朝向」滑块：只要两镜夹角恰为 <TeX src={String.raw`\varphi/2`} />，无论如何旋转这对镜面，合成的等距恒为「绕 O 旋转 <TeX src={String.raw`\varphi`} />」。</>}
          en={<>Fix rotation angle <TeX src={String.raw`\varphi`} /> and center O, then sweep the mirror orientation: as long as the two mirrors are <TeX src={String.raw`\varphi/2`} /> apart, any rotation of the pair leaves the composite unchanged — always a rotation by <TeX src={String.raw`\varphi`} /> about O.</>}
        />
      </p>

      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13, whiteSpace: 'nowrap' }}>
          φ = {phi}°
        </label>
        <input type="range" min={-175} max={175} step={5} value={phi}
          onChange={e => setPhi(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--green)' }} />
      </div>
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13, whiteSpace: 'nowrap' }}>
          <L zh="镜面朝向 β" en="mirror orient β" /> = {beta}°
        </label>
        <input type="range" min={0} max={175} step={5} value={beta}
          onChange={e => setBeta(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent-2)' }} />
      </div>

      <svg viewBox={`0 0 ${svgSize} ${svgSize}`} width="100%"
        style={{ display: 'block', maxWidth: 360, margin: '10px auto' }}>
        <rect x={0} y={0} width={svgSize} height={svgSize} fill="var(--bg-elev)" rx={4} />
        {/* Axes */}
        {[-1, 0, 1].map(v => (
          <g key={v}>
            <line x1={toSvgX(v)} y1={0} x2={toSvgX(v)} y2={svgSize} stroke="var(--rule)" strokeWidth={v===0?1:0.4} opacity={0.5} />
            <line x1={0} y1={toSvgY(v)} x2={svgSize} y2={toSvgY(v)} stroke="var(--rule)" strokeWidth={v===0?1:0.4} opacity={0.5} />
          </g>
        ))}

        {/* Mirror lines */}
        <line x1={e1x1} y1={e1y1} x2={e1x2} y2={e1y2} stroke="var(--accent)" strokeWidth={1.5} opacity={0.8} />
        <line x1={e2x1} y1={e2y1} x2={e2x2} y2={e2y2} stroke="var(--accent-2)" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.8} />

        {/* Labels */}
        <text x={toSvgX(u1[0]*1.9)} y={toSvgY(u1[1]*1.9)} fontSize={12} fill="var(--accent)" fontFamily="var(--mono)">L₁</text>
        <text x={toSvgX(u2[0]*1.9)} y={toSvgY(u2[1]*1.9)} fontSize={12} fill="var(--accent-2)" fontFamily="var(--mono)">L₂</text>

        {/* Rotation arc */}
        <path d={`M ${arcSx} ${arcSy} A ${arcR} ${arcR} 0 ${largeArc} ${sweepFlag} ${arcEx} ${arcEy}`}
          fill="none" stroke="var(--green)" strokeWidth={2} />
        {/* Rotation center */}
        <circle cx={toSvgX(0)} cy={toSvgY(0)} r={5} fill="var(--green)" stroke="var(--bg)" strokeWidth={1.5} />
        <text x={toSvgX(0)+8} y={toSvgY(0)-8} fontSize={11} fill="var(--green)" fontFamily="var(--mono)">O</text>

        {/* Motif: original */}
        {renderMotif(motifPcs, toSvgX, toSvgY, 'var(--accent)', 0.6)}
        {/* Ghost after L1 */}
        {afterL1.map((pts, i) => (
          <polygon key={`g1-${i}`}
            points={pts.map(([x,y]) => `${toSvgX(x)},${toSvgY(y)}`).join(' ')}
            fill="none" stroke="var(--accent)" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.45} />
        ))}
        {/* Final (blue) */}
        {renderMotif(afterL2, toSvgX, toSvgY, 'var(--green)', 0.7)}
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="目标旋转角 φ" en="target angle φ" /></span>
          <span className="gt-result-val">{phi}°</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="两镜夹角 = φ/2" en="mirror gap = φ/2" /></span>
          <span className="gt-result-val">{Math.round(phi/2 * 10)/10}°</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="数值验证（误差 < 1e-9）" en="numeric verify (err < 1e-9)" /></span>
          <span className="gt-result-val-strong" style={{ color: verified ? 'var(--green)' : 'var(--warn)' }}>
            {verified ? tr({ zh: '通过', en: 'pass'
                                  }) : `err ${maxErr.toExponential(2)}`}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="镜面朝向 β" en="mirror orientation β" /></span>
          <span className="gt-result-val">{beta}° <L zh="（改变 β 不影响合成）" en="(changing β does not affect composite)" /></span>
        </div>
      </div>
    </div>
  );
}

// ── Main section export ──────────────────────────────────────────────────────
export default function PlaneIsometries() {
  return (
    <GTSec id="plane-isometries" className="gt-sec">
      <div className="gt-sec-num">§47</div>
      <h2 className="gt-sec-title">
        <L zh="平面等距群" en="Isometries of the Plane" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            在欧氏平面 <TeX src={String.raw`\mathbb{R}^2`} /> 上保持距离不变的映射称为<strong>等距变换</strong>。一个经典的完全分类定理告诉我们：所有这样的映射恰好只有四种——<strong>平移、旋转、反射、滑移反射</strong>，彼此互不相交，合起来穷尽一切情形。这一结构极其刚性：没有第五种可能，没有"例外情形"。两次反射的合成是理解整个理论的核心：两镜相交角为 <TeX src={String.raw`\theta`} /> 时合成为旋转 <TeX src={String.raw`2\theta`} />，两镜平行距离为 <TeX src={String.raw`d`} /> 时合成为平移 <TeX src={String.raw`2d`} />。
          </>}
          en={<>
            A map <TeX src={String.raw`f\colon\mathbb{R}^2\to\mathbb{R}^2`} /> that preserves all distances is called an <strong>isometry of the plane</strong>. A complete classification theorem asserts that every such map is exactly one of four types: <strong>translation, rotation, reflection, or glide reflection</strong>. These four classes are mutually exclusive and exhaustive — no fifth type exists. The key engine behind this structure is the composition of two reflections: intersecting mirrors at angle <TeX src={String.raw`\theta`} /> produce a rotation by <TeX src={String.raw`2\theta`} />; parallel mirrors at separation <TeX src={String.raw`d`} /> produce a translation by <TeX src={String.raw`2d`} />.
          </>}
        />
      </p>

      {/* Definition box: isometry */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：平面等距变换" en="Definition: isometry of the plane" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              映射 <TeX src={String.raw`f\colon\mathbb{R}^2\to\mathbb{R}^2`} /> 称为<strong>等距变换</strong>，若对所有点 <TeX src={String.raw`P,Q\in\mathbb{R}^2`} /> 有 <TeX src={String.raw`|f(P)-f(Q)|=|P-Q|`} />。等价地（这是非平凡的定理），平面上每个保距映射都自动是双射，且具有形式
              <TeXBlock src={String.raw`f(x) = Ax + b,\quad A\in O(2),\; b\in\mathbb{R}^2.`} />
              不需要假设满射性，它可以从保距性推导出来。当 <TeX src={String.raw`\det A = +1`} /> 时（<TeX src={String.raw`A\in SO(2)`} />），<TeX src={String.raw`f`} /> 称为<strong>正向（保向）等距</strong>；当 <TeX src={String.raw`\det A = -1`} /> 时称为<strong>反向（反向）等距</strong>。
            </>}
            en={<>
              A map <TeX src={String.raw`f\colon\mathbb{R}^2\to\mathbb{R}^2`} /> is an <strong>isometry</strong> if <TeX src={String.raw`|f(P)-f(Q)|=|P-Q|`} /> for all <TeX src={String.raw`P,Q`} />. Equivalently (a nontrivial theorem), every distance-preserving map is automatically a bijection of the form
              <TeXBlock src={String.raw`f(x) = Ax + b,\quad A\in O(2),\; b\in\mathbb{R}^2.`} />
              Surjectivity need not be assumed — it follows. When <TeX src={String.raw`\det A=+1`} /> (<TeX src={String.raw`A\in SO(2)`} />) the map is <strong>direct (orientation-preserving)</strong>; when <TeX src={String.raw`\det A=-1`} /> it is <strong>opposite (orientation-reversing)</strong>.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            四种等距变换的不动点特征是区分它们的关键。<strong>平移</strong> <TeX src={String.raw`f(x)=x+b`} />（<TeX src={String.raw`b\ne 0`} />）无不动点；<strong>旋转</strong>以中心 <TeX src={String.raw`c`} /> 为唯一不动点（旋转角非 <TeX src={String.raw`2\pi`} /> 整数倍时）；<strong>反射</strong>固定整条镜像线（一维不动点集）并且是<strong>对合</strong>（<TeX src={String.raw`f\circ f=\mathrm{id}`} />）；<strong>滑移反射</strong>是沿镜像轴的非零平移与关于该轴的反射的合成，无不动点，且 <TeX src={String.raw`g\circ g`} /> 为非零平移（这正是与纯反射在代数上区分的判据）。
          </>}
          en={<>
            The fixed-point structure distinguishes the four types. A <strong>translation</strong> <TeX src={String.raw`f(x)=x+b`} /> (<TeX src={String.raw`b\ne 0`} />) has no fixed points. A <strong>rotation</strong> has exactly one, the center <TeX src={String.raw`c`} /> (when the angle is not a multiple of <TeX src={String.raw`2\pi`} />). A <strong>reflection</strong> fixes an entire line (a one-dimensional fixed set) and is an <strong>involution</strong> (<TeX src={String.raw`f\circ f=\mathrm{id}`} />). A <strong>glide reflection</strong> — a nonzero translation parallel to the axis composed with its reflection — has no fixed points, and <TeX src={String.raw`g\circ g`} /> is a nonzero translation, the algebraic test that distinguishes it from a pure reflection.
          </>}
        />
      </p>

      {/* Classification theorem box */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：平面等距分类定理" en="Theorem: Classification of plane isometries" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              欧氏平面的每个等距变换恰好属于以下四类之一，这四类两两不交且穷举所有情形：
              <ol style={{ margin: '10px 0 0 20px', lineHeight: 2 }}>
                <li><strong>平移</strong>（<TeX src={String.raw`A=I,\;b\ne 0`} />）：正向，无不动点。</li>
                <li><strong>旋转</strong>（<TeX src={String.raw`A=R(\alpha)\in SO(2),\;\alpha\not\equiv 0`} />）：正向，有唯一不动点（旋转中心）。</li>
                <li><strong>反射</strong>（<TeX src={String.raw`\det A=-1`} />，且 <TeX src={String.raw`f\circ f=\mathrm{id}`} />）：反向，不动点集是整条直线。</li>
                <li><strong>滑移反射</strong>（<TeX src={String.raw`\det A=-1`} />，且 <TeX src={String.raw`f\circ f\ne\mathrm{id}`} />）：反向，无不动点。</li>
              </ol>
              恒等变换约定为零平移（也是零角旋转的退化情形）。判定算法：先计算 <TeX src={String.raw`\det A`} /> 确认方向性；若 <TeX src={String.raw`\det A=+1`} />，检查 <TeX src={String.raw`(I-A)c=b`} /> 是否有解（有解 → 旋转，无解 → 平移）；若 <TeX src={String.raw`\det A=-1`} />，检查 <TeX src={String.raw`Ab+b=0`} /> 是否成立（成立 → 反射，否则 → 滑移反射）。
            </>}
            en={<>
              Every isometry of the Euclidean plane is exactly one of four types (mutually exclusive and exhaustive):
              <ol style={{ margin: '10px 0 0 20px', lineHeight: 2 }}>
                <li><strong>Translation</strong> (<TeX src={String.raw`A=I,\;b\ne 0`} />): direct, no fixed point.</li>
                <li><strong>Rotation</strong> (<TeX src={String.raw`A=R(\alpha)\in SO(2),\;\alpha\not\equiv 0`} />): direct, unique fixed point (the center).</li>
                <li><strong>Reflection</strong> (<TeX src={String.raw`\det A=-1`} /> and <TeX src={String.raw`f\circ f=\mathrm{id}`} />): opposite, fixed-point set is a full line.</li>
                <li><strong>Glide reflection</strong> (<TeX src={String.raw`\det A=-1`} /> and <TeX src={String.raw`f\circ f\ne\mathrm{id}`} />): opposite, no fixed point.</li>
              </ol>
              Convention: the identity is the zero translation (also the degenerate zero rotation). Classification algorithm: compute <TeX src={String.raw`\det A`} />; if <TeX src={String.raw`+1`} />, solve <TeX src={String.raw`(I-A)c=b`} /> (solvable → rotation, else translation); if <TeX src={String.raw`-1`} />, check <TeX src={String.raw`Ab+b=0`} /> (yes → reflection, no → glide).
            </>}
          />
        </div>
      </div>

      {/* Widget 1 */}
      <TwoMirrorComposer />

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="两次反射的合成定理" en="Composition of two reflections" />
      </h3>

      <p>
        <L
          zh={<>
            设 <TeX src={String.raw`s_1,s_2`} /> 分别是关于直线 <TeX src={String.raw`L_1,L_2`} /> 的反射。反射矩阵的代数形式：若直线过原点，方向角为 <TeX src={String.raw`a`} />，则反射矩阵为
            <TeXBlock src={String.raw`M(a) = \begin{pmatrix}\cos 2a & \sin 2a \\ \sin 2a & -\cos 2a\end{pmatrix}`} />
            直接计算
            <TeXBlock src={String.raw`M(a_2)\cdot M(a_1) = \begin{pmatrix}\cos 2(a_2-a_1) & -\sin 2(a_2-a_1) \\ \sin 2(a_2-a_1) & \cos 2(a_2-a_1)\end{pmatrix} = R(2\theta)`} />
            其中 <TeX src={String.raw`\theta = a_2 - a_1`} /> 是从 <TeX src={String.raw`L_1`} /> 到 <TeX src={String.raw`L_2`} /> 的有向夹角，乘积恰为绕交点旋转 <TeX src={String.raw`2\theta`} />（注意：旋转角是夹角的<strong>两倍</strong>，这是本节最重要的数字关系）。若两线平行，公法向量为 <TeX src={String.raw`n`} />，有符号距离 <TeX src={String.raw`d`} />（从 <TeX src={String.raw`L_1`} /> 到 <TeX src={String.raw`L_2`} />），则合成为平移向量 <TeX src={String.raw`2dn`} />，即<strong>距离的两倍</strong>。
          </>}
          en={<>
            Let <TeX src={String.raw`s_1, s_2`} /> be reflections across lines <TeX src={String.raw`L_1, L_2`} />. If a line through the origin has direction angle <TeX src={String.raw`a`} />, its reflection matrix is
            <TeXBlock src={String.raw`M(a) = \begin{pmatrix}\cos 2a & \sin 2a \\ \sin 2a & -\cos 2a\end{pmatrix}.`} />
            A direct computation gives
            <TeXBlock src={String.raw`M(a_2)\cdot M(a_1) = R(2\theta), \quad \theta = a_2 - a_1,`} />
            a pure rotation by twice the angle from <TeX src={String.raw`L_1`} /> to <TeX src={String.raw`L_2`} /> about their intersection. The rotation angle is <strong>twice</strong> the mirror angle — the most important numerical fact in this section. For parallel mirrors with signed separation <TeX src={String.raw`d`} /> and common unit normal <TeX src={String.raw`n`} />, the composite is translation by <TeX src={String.raw`2dn`} />, i.e., <strong>twice the separation</strong>.
          </>}
        />
      </p>

      {/* Three reflections theorem */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：三反射定理（Cartan-Dieudonné 平面版）" en="Theorem: Three-reflections theorem (plane Cartan-Dieudonné)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              平面上每个等距变换都可表示为<strong>至多三次反射</strong>的合成：恒等需 0 次；非恒等的正向等距（旋转或平移）恰好需要 2 次；纯反射需 1 次；滑移反射需 3 次（且不能更少）。反射是 <TeX src={String.raw`E(2)`} /> 的生成元。奇偶性规则：所需反射次数的奇偶性与 <TeX src={String.raw`\det A`} /> 的符号绑定：<TeX src={String.raw`\det A = +1`} /> 当且仅当可用偶数次反射表示；绝对不能用奇数次反射写出旋转，也不能用偶数次反射写出滑移反射。
            </>}
            en={<>
              Every isometry of <TeX src={String.raw`\mathbb{R}^2`} /> is a composite of <strong>at most three reflections</strong>: the identity needs 0; a nonidentity direct isometry (rotation or translation) needs exactly 2; a pure reflection needs 1; a glide reflection needs 3 (and no fewer). Reflections generate all of <TeX src={String.raw`E(2)`} />. Parity rule: the number of reflections has fixed parity equal to the orientation type — <TeX src={String.raw`\det A=+1`} /> if and only if expressible as an even number of reflections; a rotation can never be 3 reflections, a glide can never be 2.
            </>}
          />
        </div>
      </div>

      {/* Widget 2 */}
      <IsometryClassifier />

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="SE(2) 是 E(2) 的指数 2 正规子群" en="SE(2) is an index-2 normal subgroup of E(2)" />
      </h3>

      <p>
        <L
          zh={<>
            所有平面等距变换在合成下构成<strong>欧氏群</strong> <TeX src={String.raw`E(2) = \mathrm{Isom}(\mathbb{R}^2)`} />，它作为半直积可写为 <TeX src={String.raw`E(2) = \mathbb{R}^2 \rtimes O(2)`} />。正向等距（平移与旋转）构成子群 <TeX src={String.raw`SE(2) = \mathbb{R}^2 \rtimes SO(2)`} />，称为<strong>特殊欧氏群</strong>。映射
            <TeXBlock src={String.raw`\det\colon E(2)\to\{+1,-1\}\cong\mathbb{Z}/2,\quad (A,b)\mapsto \det A`} />
            是满射群同态，核为 <TeX src={String.raw`SE(2)`} />，故 <TeX src={String.raw`SE(2)`} /> 是 <TeX src={String.raw`E(2)`} /> 中<strong>指数 2 的正规子群</strong>，商群 <TeX src={String.raw`E(2)/SE(2)\cong\mathbb{Z}/2`} />。代数上的直接推论：两个反向等距的合成一定是正向等距（<TeX src={String.raw`(-1)\times(-1)=+1`} />），这正是为什么两次反射总给出旋转或平移。
          </>}
          en={<>
            All plane isometries under composition form the <strong>Euclidean group</strong> <TeX src={String.raw`E(2)=\mathrm{Isom}(\mathbb{R}^2)`} />, which as a semidirect product is <TeX src={String.raw`E(2)=\mathbb{R}^2\rtimes O(2)`} />. Direct isometries (translations and rotations) form the subgroup <TeX src={String.raw`SE(2)=\mathbb{R}^2\rtimes SO(2)`} />, the <strong>special Euclidean group</strong>. The map
            <TeXBlock src={String.raw`\det\colon E(2)\to\{+1,-1\}\cong\mathbb{Z}/2,\quad (A,b)\mapsto\det A`} />
            is a surjective group homomorphism with kernel <TeX src={String.raw`SE(2)`} />, making <TeX src={String.raw`SE(2)`} /> a <strong>normal subgroup of index 2</strong> in <TeX src={String.raw`E(2)`} />, with quotient <TeX src={String.raw`E(2)/SE(2)\cong\mathbb{Z}/2`} />. Direct corollary: the composite of two opposite isometries is always direct (<TeX src={String.raw`(-1)(-1)=+1`} />), which is exactly why two reflections always yield a rotation or translation.
          </>}
        />
      </p>

      {/* Widget 3 */}
      <RotationTwoReflections />

      {/* Comparison table */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="四类等距一览" en="Four isometry types at a glance" />
      </h3>

      <table className="gt-compare">
        <thead>
          <tr>
            <th><L zh="类型" en="Type" /></th>
            <th><L zh="det A" en="det A" /></th>
            <th><L zh="不动点" en="Fixed points" /></th>
            <th><L zh="f∘f" en="f∘f" /></th>
            <th><L zh="最少反射数" en="Min reflections" /></th>
          </tr>
        </thead>
        <tbody>
          {[
            {
              type: tr({ zh: '平移', en: 'Translation' }),
              det: '+1', fixed: tr({ zh: '无（b≠0）', en: 'none (b≠0)'
            }),
              square: tr({ zh: '平移 2b', en: 'translation 2b' }), minRef: '2'
            },
            {
              type: tr({ zh: '旋转', en: 'Rotation'
            }),
              det: '+1', fixed: tr({ zh: '唯一（中心 c）', en: 'unique (center c)' }),
              square: tr({ zh: '旋转 2α', en: 'rotation 2α'
            }), minRef: '2'
            },
            {
              type: tr({ zh: '反射', en: 'Reflection' }),
              det: '−1', fixed: tr({ zh: '整条镜像线', en: 'entire mirror line'
            }),
              square: tr({ zh: '恒等 id', en: 'identity'
            }), minRef: '1'
            },
            {
              type: tr({ zh: '滑移反射', en: 'Glide reflection' }),
              det: '−1', fixed: tr({ zh: '无', en: 'none'
            }),
              square: tr({ zh: '非零平移 T_{2v}', en: 'nonzero translation T_{2v}' }), minRef: '3'
            },
          ].map(row => (
            <tr key={row.type}>
              <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.type}</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 14, color: Math.abs(parseFloat(row.det) - 1) < 0.1 ? 'var(--green)' : 'var(--warn)' }}>{row.det}</td>
              <td style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{row.fixed}</td>
              <td style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{row.square}</td>
              <td style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700 }}>{row.minRef}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cube connection aside */}
      <div className="gt-aside" style={{ marginTop: 32 }}>
        <L
          zh={<>
            <strong>魔方联系（精确版）：</strong>正方体作为几何实体的全对称群阶为 48，通过与本节完全相同的 <TeX src={String.raw`\det=\pm1`} /> 同态，分裂为 24 个保向旋转（物理上可用手转到的，同构于 <TeX src={String.raw`S_4`} />，置换 4 条体对角线）和 24 个反向对称（镜像翻转，手转不到）。这是平面「正向 vs. 反向、指数 2 子群」结构在三维的精确类比。镜像打乱是真正的不同状态，只能重贴贴纸才能到达，永远无法靠拧动到达——这就是对称群 <TeX src={String.raw`S_4\subset O_h`} /> 的指数 2 结构在魔方实践中的含义。（与约 <TeX src={String.raw`4.3\times10^{19}`} /> 阶的拧动群无关，那是另一回事。）
          </>}
          en={<>
            <strong>Cube connection (precise):</strong> The full symmetry group of the cube as a solid has order 48 and splits, via the same <TeX src={String.raw`\det=\pm1`} /> homomorphism, into 24 orientation-preserving rotations (physically reachable by turning, isomorphic to <TeX src={String.raw`S_4`} /> permuting the 4 body diagonals) and 24 orientation-reversing symmetries (mirror images, not physically reachable). This is the exact 3D analogue of the plane's direct-vs-opposite, index-2 subgroup structure from this section. A mirror-imaged scramble is a genuinely distinct position — reachable only by re-stickering, never by turning — which is precisely the meaning of the index-2 structure <TeX src={String.raw`S_4\subset O_h`} /> in practice. (Unrelated to the <TeX src={String.raw`\sim 4.3\times10^{19}`} />-element move group.)
          </>}
        />
      </div>

      {/* Common pitfalls */}
      <div className="gt-aside" style={{ marginTop: 20 }}>
        <L
          zh={<>
            <strong>常见误区提醒：</strong>(1) 旋转角是两镜<em>夹角</em>的两倍（<TeX src={String.raw`2\theta`} />），不是 <TeX src={String.raw`\theta`} /> 本身。(2) 平移距离是两平行镜<em>间距</em>的两倍（<TeX src={String.raw`2d`} />），不是 <TeX src={String.raw`d`} />。(3) 顺序有意义：<TeX src={String.raw`s_2\circ s_1`} />（先 <TeX src={String.raw`L_1`} /> 后 <TeX src={String.raw`L_2`} />）与 <TeX src={String.raw`s_1\circ s_2`} /> 互为逆——角度符号翻转。(4) 滑移反射的平移分量<em>必须平行于</em>镜像轴；垂直分量只是把轴平移，仍是一次纯反射。(5) <TeX src={String.raw`E(2)`} /> 和 <TeX src={String.raw`SE(2)`} /> 都不是阿贝尔群——只有平移子群 <TeX src={String.raw`\mathbb{R}^2`} /> 是交换的。
          </>}
          en={<>
            <strong>Common pitfalls:</strong> (1) The rotation angle is <em>twice</em> the mirror angle (<TeX src={String.raw`2\theta`} />), not <TeX src={String.raw`\theta`} />. (2) The translation distance is twice the mirror separation (<TeX src={String.raw`2d`} />), not <TeX src={String.raw`d`} />. (3) Order matters: <TeX src={String.raw`s_2\circ s_1`} /> (apply <TeX src={String.raw`L_1`} /> first) and <TeX src={String.raw`s_1\circ s_2`} /> are inverses — the angle sign flips. (4) The glide translation component must be <em>parallel</em> to the axis; a perpendicular component just shifts the axis, giving a pure reflection. (5) Neither <TeX src={String.raw`E(2)`} /> nor <TeX src={String.raw`SE(2)`} /> is abelian — only the translation subgroup <TeX src={String.raw`\mathbb{R}^2`} /> is commutative.
          </>}
        />
      </div>

      {/* References */}
      <div style={{ marginTop: 40 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 12 }}>
          <L zh="参考文献" en="References" />
        </div>
        <div className="gt-refs">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2, fontSize: 15 }}>
            <li>H. S. M. Coxeter, <em>Introduction to Geometry</em>, 2nd ed., Wiley, 1969 — Ch. 3 (Sections 3.1–3.5).</li>
            <li>M. A. Armstrong, <em>Groups and Symmetry</em>, Springer UTM, 1988 — Chapters 2, 4, 5, 25.</li>
            <li>Euclidean plane isometry — Wikipedia (<em>classification, composition rules</em>).</li>
            <li>Euclidean group — Wikipedia (<em>E(n) = R<sup>n</sup> ⋊ O(n), index-2 subgroup SE(n)</em>).</li>
          </ol>
        </div>
      </div>
    </GTSec>
  );
}
