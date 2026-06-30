'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';
import BoolToggle from '@/components/BoolToggle';

// ── Types ─────────────────────────────────────────────────────────────────────

type FriezeId = 'p1' | 'p11g' | 'p1m1' | 'p2' | 'p2mg' | 'p11m' | 'p2mm';

interface FriezeInfo {
  id: FriezeId;
  hasV: boolean;  // vertical mirror
  hasH: boolean;  // horizontal mirror
  hasR: boolean;  // 180° rotation
  hasEG: boolean; // essential glide (half-period)
  absClass: string;
  absClassZh: string;
}

const FRIEZE_TABLE: FriezeInfo[] = [
  { id: 'p1',   hasV: false, hasH: false, hasR: false, hasEG: false, absClass: 'ℤ',            absClassZh: 'ℤ' },
  { id: 'p11g', hasV: false, hasH: false, hasR: false, hasEG: true,  absClass: 'ℤ',            absClassZh: 'ℤ' },
  { id: 'p1m1', hasV: true,  hasH: false, hasR: false, hasEG: false, absClass: 'D∞',           absClassZh: 'D∞' },
  { id: 'p2',   hasV: false, hasH: false, hasR: true,  hasEG: false, absClass: 'D∞',           absClassZh: 'D∞' },
  { id: 'p2mg', hasV: true,  hasH: false, hasR: true,  hasEG: true,  absClass: 'D∞',           absClassZh: 'D∞' },
  { id: 'p11m', hasV: false, hasH: true,  hasR: false, hasEG: false, absClass: 'ℤ × ℤ₂',      absClassZh: 'ℤ × ℤ₂' },
  { id: 'p2mm', hasV: true,  hasH: true,  hasR: true,  hasEG: false, absClass: 'D∞ × ℤ₂',    absClassZh: 'D∞ × ℤ₂' },
];

// Map IUC id to Conway nickname + zh description
const FRIEZE_NAMES: Record<FriezeId, { en: string; zh: string; conway: string
 }> = {
  p1:   { en: 'Translation only',                    zh: '仅平移',                conway: 'hop'
},
  p11g: { en: 'Glide reflection',                    zh: '滑动反射',              conway: 'step'
},
  p1m1: { en: 'Vertical mirrors',                    zh: '竖直镜面',              conway: 'sidle'
},
  p2:   { en: '180° rotations',                      zh: '半转旋转',              conway: 'spinning hop'
},
  p2mg: { en: 'Vertical mirrors + glide + rotation', zh: '竖直镜面 + 滑动 + 半转', conway: 'spinning sidle'
},
  p11m: { en: 'Horizontal mirror',                   zh: '水平镜面',              conway: 'jump'
},
  p2mm: { en: 'All symmetries',                      zh: '全部对称',              conway: 'spinning jump'
},
};

// ── SVG motif: asymmetric "L" footprint ──────────────────────────────────────
// Base motif centered at (0,0), fitting in about ±14 x ±14 box
// We use a stylized "R" letter shape — clearly asymmetric

function buildMotifPath(): string {
  // An asymmetric footprint-like glyph, fitting in [-12,12] x [-14,14]
  // This is a stylized letter "R" (asymmetric):
  return 'M -8 12 L -8 -12 L 2 -12 Q 10 -12 10 -4 Q 10 4 2 4 L 8 12 Z M -3 -7 L 2 -7 Q 5 -7 5 -4 Q 5 0 2 0 L -3 0 Z';
}

const MOTIF_PATH = buildMotifPath();

// ── Transform helpers ─────────────────────────────────────────────────────────

// period = 60 units in SVG coords; mid-axis at y=0
const PERIOD = 60;
const HALF = PERIOD / 2;

type Transform = { dx: number; dy: number; flipX: boolean; flipY: boolean };

function getTransforms(info: FriezeInfo): Transform[] {
  // Returns the fundamental domain transforms for the chosen group.
  // We place reference motif at origin; vertical mirrors at x = 0.
  const id: Transform = { dx: 0, dy: 0, flipX: false, flipY: false };
  const h: Transform  = { dx: 0, dy: 0, flipX: false, flipY: true  }; // horizontal mirror
  const v: Transform  = { dx: 0, dy: 0, flipX: true,  flipY: false }; // vertical mirror about x=0
  const r: Transform  = { dx: 0, dy: 0, flipX: true,  flipY: true  }; // 180° rotation = flip both
  const g: Transform  = { dx: HALF, dy: 0, flipX: false, flipY: true }; // glide: shift p/2, flip y

  switch (info.id) {
    case 'p1':   return [id];
    case 'p11g': return [id, g];
    case 'p1m1': return [id, v];
    case 'p2':   return [id, r];
    case 'p2mg': return [id, v, g, { dx: HALF, dy: 0, flipX: true, flipY: true }]; // v◦g = rot
    case 'p11m': return [id, h];
    case 'p2mm': return [id, h, v, r];
  }
}

function svgTransformAttr(t: Transform, tx: number): string {
  // SVG transform string: translate(tx+t.dx, t.dy) scale(flipX ? -1:1, flipY ? -1:1)
  const scX = t.flipX ? -1 : 1;
  const scY = t.flipY ? -1 : 1;
  return `translate(${tx + t.dx},${t.dy}) scale(${scX},${scY})`;
}

// ── Overlay helpers ───────────────────────────────────────────────────────────

// Colors from the palette
const COL_TRANS  = '#2A4D69'; // translation arrow
const COL_VMIRR  = '#8B2E3C'; // vertical mirror
const COL_HMIRR  = '#3F7050'; // horizontal mirror
const COL_ROT    = '#B8860B'; // rotation center
const COL_GLIDE  = '#6B4E9C'; // glide axis

// ── Widget 1: SevenTypeFriezeExplorer ─────────────────────────────────────────

function SevenTypeFriezeExplorer({ lang }: { lang: 'zh' | 'en' }) {
  const [selectedId, setSelectedId] = useState<FriezeId>('p1');
  const [showTrans,  setShowTrans]  = useState(true);
  const [showV,      setShowV]      = useState(false);
  const [showH,      setShowH]      = useState(false);
  const [showR,      setShowR]      = useState(false);
  const [showG,      setShowG]      = useState(false);
  const [animating,  setAnimating]  = useState(false);
  const [animOffset, setAnimOffset] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const info = FRIEZE_TABLE.find(f => f.id === selectedId)!;

  const stopAnim = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAnimating(false);
    setAnimOffset(0);
  }, []);

  const startAnim = useCallback(() => {
    if (rafRef.current !== null) { stopAnim(); return; }
    setAnimating(true);
    const duration = 1200; // ms
    const step = (ts: number) => {
      if (startTimeRef.current === 0) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const frac = (elapsed % duration) / duration;
      setAnimOffset(-frac * PERIOD); // slide left by one period
      rafRef.current = requestAnimationFrame(step);
    };
    startTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
  }, [stopAnim]);

  useEffect(() => {
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ViewBox: -180 to 180 in x, -40 to 40 in y. We render n in [-3..3].
  const vbW = 360; const vbH = 80;
  const transforms = getTransforms(info);
  const nRange = [-3, -2, -1, 0, 1, 2, 3];

  // Compute vertical mirror x positions
  const vmirrorXs: number[] = [];
  if (info.hasV) {
    // mirrors at x = 0, ±p, ±2p
    for (let n = -3; n <= 3; n++) vmirrorXs.push(n * PERIOD);
    if (info.id === 'p2mg') {
      // also at half-period
      for (let n = -3; n <= 3; n++) vmirrorXs.push(n * PERIOD + HALF);
    }
  }

  // Rotation center x positions (on mid-axis)
  const rotCenterXs: number[] = [];
  if (info.hasR) {
    if (info.id === 'p2') {
      for (let n = -3; n <= 3; n++) rotCenterXs.push(n * PERIOD + HALF);
    } else if (info.id === 'p2mg') {
      for (let n = -3; n <= 3; n++) {
        rotCenterXs.push(n * PERIOD + PERIOD / 4);
        rotCenterXs.push(n * PERIOD + 3 * PERIOD / 4);
      }
    } else if (info.id === 'p2mm') {
      for (let n = -3; n <= 3; n++) {
        rotCenterXs.push(n * PERIOD);
        rotCenterXs.push(n * PERIOD + HALF);
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Group selector */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>
          {tr({ zh: '选择带饰群', en: 'Choose frieze group'
        })}
        </span>
        <select
          className="gt-input"
          value={selectedId}
          onChange={e => { stopAnim(); setSelectedId(e.target.value as FriezeId); }}
          style={{ fontFamily: 'var(--mono)', fontSize: 14, minWidth: 100 }}
        >
          {FRIEZE_TABLE.map(f => (
            <option key={f.id} value={f.id}>
              {f.id} — {tr(FRIEZE_NAMES[f.id])}
            </option>
          ))}
        </select>
      </div>

      {/* SVG strip */}
      <div style={{ background: 'var(--bg-elev)', borderRadius: 6, border: '1px solid var(--rule)', overflow: 'hidden' }}>
        <svg
          viewBox={`${-vbW / 2} ${-vbH / 2} ${vbW} ${vbH}`}
          width="100%"
          style={{ display: 'block', maxWidth: vbW }}
          aria-label={tr({ zh: '带饰图案', en: 'Frieze pattern'
        })}
        >
          <defs>
            <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={COL_TRANS} />
            </marker>
            <marker id="garr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={COL_GLIDE} />
            </marker>
            {/* Clip to visible area */}
            <clipPath id="strip-clip">
              <rect x={-vbW / 2} y={-vbH / 2} width={vbW} height={vbH} />
            </clipPath>
          </defs>

          {/* Strip background */}
          <rect x={-vbW / 2} y={-vbH / 2} width={vbW} height={vbH} fill="var(--bg)" />
          <rect x={-vbW / 2} y={-vbH / 2} width={vbW} height={vbH} fill="none" stroke="var(--rule)" strokeWidth={0.5} />

          {/* Mid-axis */}
          <line x1={-vbW / 2} y1={0} x2={vbW / 2} y2={0} stroke="var(--rule)" strokeWidth={0.5} strokeDasharray="4 4" />

          <g clipPath="url(#strip-clip)" transform={`translate(${animOffset},0)`}>
            {/* Motif copies */}
            {nRange.map(n =>
              transforms.map((t, ti) => {
                const cx = n * PERIOD;
                return (
                  <path
                    key={`${n}-${ti}`}
                    d={MOTIF_PATH}
                    transform={svgTransformAttr(t, cx)}
                    fill="var(--accent-2, #2A4D69)"
                    fillOpacity={0.75}
                    stroke="none"
                  />
                );
              })
            )}

            {/* Overlay: vertical mirrors */}
            {showV && vmirrorXs.map((mx, i) => (
              <line key={`vm-${i}`} x1={mx} y1={-vbH / 2} x2={mx} y2={vbH / 2}
                stroke={COL_VMIRR} strokeWidth={1.2} strokeDasharray="5 3" opacity={0.85} />
            ))}

            {/* Overlay: horizontal mirror */}
            {showH && info.hasH && (
              <line x1={-vbW / 2} y1={0} x2={vbW / 2} y2={0}
                stroke={COL_HMIRR} strokeWidth={1.8} opacity={0.85} />
            )}

            {/* Overlay: rotation centers */}
            {showR && rotCenterXs.map((rx, i) => (
              <circle key={`rc-${i}`} cx={rx} cy={0} r={3}
                fill={COL_ROT} stroke="var(--bg)" strokeWidth={1} opacity={0.9} />
            ))}

            {/* Overlay: glide axis */}
            {showG && info.hasEG && (
              <>
                <line x1={-vbW / 2} y1={2} x2={vbW / 2} y2={2}
                  stroke={COL_GLIDE} strokeWidth={1.2} strokeDasharray="8 2 2 2" opacity={0.85} />
                {nRange.map(n => (
                  <path key={`ga-${n}`}
                    d={`M${n * PERIOD + 2} 5 L${n * PERIOD + HALF - 2} 5`}
                    stroke={COL_GLIDE} strokeWidth={1} markerEnd="url(#garr)" opacity={0.7} />
                ))}
              </>
            )}

            {/* Overlay: translation vector */}
            {showTrans && (
              <line x1={0} y1={-24} x2={PERIOD - 4} y2={-24}
                stroke={COL_TRANS} strokeWidth={1.5} markerEnd="url(#arr)" />
            )}
          </g>

          {/* Legend */}
          {showTrans && (
            <text x={HALF - animOffset} y={-27} textAnchor="middle"
              fontSize={8} fill={COL_TRANS} fontFamily="var(--mono)">
              T = {PERIOD}
            </text>
          )}
        </svg>
      </div>

      {/* Overlay toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <ToggleBtn active={showTrans} onClick={() => setShowTrans(v => !v)} color={COL_TRANS}
          label={tr({ zh: '平移向量 T', en: 'Translation T' })} />
        <ToggleBtn active={showV} onClick={() => setShowV(v => !v)} color={COL_VMIRR}
          label={tr({ zh: '竖直镜面 v', en: 'Vertical mirrors v'
        })}
          disabled={!info.hasV} />
        <ToggleBtn active={showH} onClick={() => setShowH(v => !v)} color={COL_HMIRR}
          label={tr({ zh: '水平镜面 h', en: 'Horizontal mirror h'
        })}
          disabled={!info.hasH} />
        <ToggleBtn active={showR} onClick={() => setShowR(v => !v)} color={COL_ROT}
          label={tr({ zh: '旋转中心 r', en: 'Rotation centers r'
        })}
          disabled={!info.hasR} />
        <ToggleBtn active={showG} onClick={() => setShowG(v => !v)} color={COL_GLIDE}
          label={tr({ zh: '滑动轴 g', en: 'Glide axis g'
        })}
          disabled={!info.hasEG} />
      </div>

      {/* Play button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="gt-btn" onClick={animating ? stopAnim : startAnim}>
          {animating
            ? tr({ zh: '停止', en: 'Stop' })
            : tr({ zh: '播放平移', en: 'Play translation' })}
        </button>
        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
          {lang === 'zh'
            ? `Conway 名称: "${FRIEZE_NAMES[selectedId].conway}"`
            : `Conway name: "${FRIEZE_NAMES[selectedId].conway}"`}
        </span>
      </div>

      {/* Group info row */}
      <div className="gt-result-row">
        <span className="gt-result-label">{tr({ zh: '抽象同构类', en: 'Abstract class'
        })}</span>
        <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)' }}>
          {info.absClass}
        </span>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, color, label, disabled }: {
  active: boolean; onClick: () => void; color: string; label: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 4,
        border: `1px solid ${disabled ? 'var(--rule)' : color}`,
        background: active && !disabled ? color : 'transparent',
        color: active && !disabled ? 'var(--bg)' : disabled ? 'var(--ink-faint)' : color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'var(--mono)',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ── Widget 2: BuildYourOwnFrieze ──────────────────────────────────────────────

// Closure logic: given user toggles, compute the closed frieze group
function computeClosure(wantV: boolean, wantH: boolean, wantR: boolean, wantEG: boolean): {
  info: FriezeInfo;
  forcedV: boolean; forcedH: boolean; forcedR: boolean; forcedEG: boolean;
} {
  // Start with what user wants
  let hasV = wantV, hasH = wantH, hasR = wantR, hasEG = wantEG;

  // Close under composition rules (fixed-point iteration):
  // h + v → r (perpendicular mirrors give half-turn)
  // v + r → v (already have v, r)
  // h + r → h (already have h, r — but also: h◦r(x,y)=h(-x,-y)=(−x,y)=v(x,y), so need v)
  //   Actually: h composed with r = vertical mirror; so h+r → v
  // g + g → T (g² = T, always present)
  // h + g → trivial glide (not an essential new generator)
  // v + g → r (v composed with g = half-turn at shifted center)
  let changed = true;
  while (changed) {
    changed = false;
    if (hasH && hasV && !hasR) { hasR = true; changed = true; }
    if (hasH && hasR && !hasV) { hasV = true; changed = true; }
    if (hasV && hasR && !hasH) { /* does NOT imply h — p2mg has v+r without h */ }
    if (hasV && hasEG && !hasR) { hasR = true; changed = true; } // v◦g = r
    if (hasH && hasR && hasV && hasEG) { /* fine */ }
    // p2mg: v + EG → r (but NOT h)
  }

  // Now map to the 7 IUC groups
  // Key: hasH forces away from glide-only groups
  let matched: FriezeId = 'p1';
  if (!hasV && !hasH && !hasR && !hasEG) matched = 'p1';
  else if (!hasV && !hasH && !hasR &&  hasEG) matched = 'p11g';
  else if ( hasV && !hasH && !hasR && !hasEG) matched = 'p1m1';
  else if (!hasV && !hasH &&  hasR && !hasEG) matched = 'p2';
  else if ( hasV && !hasH &&  hasR &&  hasEG) matched = 'p2mg';
  else if (!hasV &&  hasH && !hasR && !hasEG) matched = 'p11m';
  else if ( hasV &&  hasH &&  hasR)           matched = 'p2mm';
  else {
    // Fallback: snap to nearest valid group
    if (hasH) matched = hasV ? 'p2mm' : hasR ? 'p2mm' : 'p11m';
    else if (hasV && hasEG) matched = 'p2mg';
    else if (hasV) matched = 'p1m1';
    else if (hasR) matched = 'p2';
    else if (hasEG) matched = 'p11g';
    else matched = 'p1';
  }

  const info = FRIEZE_TABLE.find(f => f.id === matched)!;
  return {
    info,
    forcedV: info.hasV && !wantV,
    forcedH: info.hasH && !wantH,
    forcedR: info.hasR && !wantR,
    forcedEG: info.hasEG && !wantEG,
  };
}

function BuildYourOwnFrieze({ lang }: { lang: 'zh' | 'en' }) {
  const [wantV,  setWantV]  = useState(false);
  const [wantH,  setWantH]  = useState(false);
  const [wantR,  setWantR]  = useState(false);
  const [wantEG, setWantEG] = useState(false);

  const { info, forcedV, forcedH, forcedR, forcedEG } = computeClosure(wantV, wantH, wantR, wantEG);

  const vbW = 300; const vbH = 70;
  const transforms = getTransforms(info);
  const nRange = [-2, -1, 0, 1, 2];

  const forcedParts: string[] = [];
  if (forcedV)  forcedParts.push(tr({ zh: '竖直镜面 v', en: 'vertical mirror v'
}));
  if (forcedH)  forcedParts.push(tr({ zh: '水平镜面 h', en: 'horizontal mirror h'
}));
  if (forcedR)  forcedParts.push(tr({ zh: '半转 r', en: 'half-turn r'
}));
  if (forcedEG) forcedParts.push(tr({ zh: '滑动 g', en: 'glide g'
}));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Checkboxes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {([
          { key: 'v', label: tr({ zh: '竖直镜面 v', en: 'Vertical mirror v'
        }), val: wantV, set: setWantV },
          { key: 'h', label: tr({ zh: '水平镜面 h', en: 'Horizontal mirror h'
        }), val: wantH, set: setWantH },
          { key: 'r', label: tr({ zh: '半转 r', en: 'Half-turn r'
        }),         val: wantR, set: setWantR },
          { key: 'g', label: tr({ zh: '滑动反射 g', en: 'Glide reflection g'
        }),  val: wantEG, set: setWantEG },
        ] as const).map(item => (
          <BoolToggle
            key={item.key}
            value={item.val}
            onChange={item.set}
            label={<span style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{item.label}</span>}
            ariaLabel={item.label}
          />
        ))}
      </div>

      {/* Closure warning */}
      {forcedParts.length > 0 && (
        <div style={{ background: 'var(--bg-deep)', borderLeft: '3px solid var(--warn)',
          padding: '8px 12px', borderRadius: 3, fontSize: 12, color: 'var(--ink-dim)' }}>
          {lang === 'zh'
            ? `⚠ 自动补全：群的封闭性要求加入 ${forcedParts.join('、')}`
            : `⚠ Closure adds: ${forcedParts.join(', ')}`}
        </div>
      )}

      {/* SVG strip */}
      <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
        <svg viewBox={`${-vbW / 2} ${-vbH / 2} ${vbW} ${vbH}`} width="100%" style={{ display: 'block', maxWidth: vbW }}>
          <rect x={-vbW / 2} y={-vbH / 2} width={vbW} height={vbH} fill="var(--bg)" />
          <line x1={-vbW / 2} y1={0} x2={vbW / 2} y2={0} stroke="var(--rule)" strokeWidth={0.5} strokeDasharray="4 4" />
          {nRange.map(n =>
            transforms.map((t, ti) => (
              <path key={`${n}-${ti}`}
                d={MOTIF_PATH}
                transform={svgTransformAttr(t, n * PERIOD)}
                fill={COL_TRANS}
                fillOpacity={0.7}
                stroke="none"
              />
            ))
          )}
        </svg>
      </div>

      {/* Result badge */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--green)' }}>
          {info.id}
        </span>
        <span style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
          {tr(FRIEZE_NAMES[info.id])}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)',
          background: 'var(--bg-deep)', padding: '2px 8px', borderRadius: 4 }}>
          {lang === 'zh' ? `抽象同构: ${info.absClassZh}` : `Abstract: ${info.absClass}`}
        </span>
      </div>
    </div>
  );
}

// ── Widget 3: GlideVsMirrorAnimator ──────────────────────────────────────────

// Footprint motif: left foot (asymmetric blob)
function footprintPath(flip: boolean): string {
  const s = flip ? -1 : 1;
  // Simple stylized footprint for the heel/toe orientation
  return `M${s * -5} 8 Q${s * -10} 0 ${s * -7} -6 Q${s * -4} -12 0 -12 Q${s * 5} -12 ${s * 7} -6 Q${s * 9} 0 ${s * 5} 6 Q${s * 2} 10 ${s * -2} 10 Z`;
}

function GlideVsMirrorAnimator({ lang }: { lang: 'zh' | 'en' }) {
  const [scrub,    setScrub]    = useState(0);
  const [showMirrorGhost, setShowMirrorGhost] = useState(false);
  const [showSquared, setShowSquared] = useState(false);

  // Glide transform: interpolate from (0,y) → (p/2, -y)
  // scaleY: 1 at s=0, -1 at s=1 (linear); tx: 0 at s=0, p/2 at s=1
  const tx = scrub * HALF;
  const scaleY = 1 - 2 * scrub; // 1 → -1

  // Squared (g²): run from p/2 to p, y back to original
  const tx2 = HALF + scrub * HALF;  // p/2 → p
  const scaleY2 = -1 + 2 * scrub;   // -1 → 1 (back to upright)

  const vbW = 300; const vbH = 120;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Slider */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--ink-dim)', minWidth: 80 }}>
          {tr({ zh: '动画进度', en: 'Scrub'
        })}
        </label>
        <input type="range" min={0} max={100} value={Math.round(scrub * 100)}
          onChange={e => setScrub(parseInt(e.target.value) / 100)}
          style={{ flex: 1, minWidth: 100, maxWidth: 240 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', width: 36 }}>
          {Math.round(scrub * 100)}%
        </span>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <BoolToggle
          value={showMirrorGhost}
          onChange={setShowMirrorGhost}
          label={<span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{tr({ zh: '显示纯镜像（p11m 对比）', en: 'Show mirror ghost (p11m)' })}</span>}
          ariaLabel={tr({ zh: '显示纯镜像（p11m 对比）', en: 'Show mirror ghost (p11m)' })}
        />
        <BoolToggle
          value={showSquared}
          onChange={setShowSquared}
          label={<span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{tr({ zh: '显示 g² = T（第二步）', en: 'Show g² = T (second step)' })}</span>}
          ariaLabel={tr({ zh: '显示 g² = T（第二步）', en: 'Show g² = T (second step)' })}
        />
      </div>

      {/* SVG */}
      <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
        <svg viewBox={`${-vbW / 2} ${-vbH / 2} ${vbW} ${vbH}`} width="100%" style={{ display: 'block', maxWidth: vbW }}>
          <rect x={-vbW / 2} y={-vbH / 2} width={vbW} height={vbH} fill="var(--bg)" />

          {/* Mid-axis */}
          <line x1={-vbW / 2} y1={0} x2={vbW / 2} y2={0} stroke="var(--rule)" strokeWidth={0.7} />

          {/* Top label: p11g */}
          <text x={-vbW / 2 + 6} y={-vbH / 2 + 12} fontSize={9} fill="var(--ink-dim)" fontFamily="var(--mono)">
            p11g {tr({ zh: '（滑动反射）', en: '(glide reflection)'
            })}
          </text>

          {/* Static background footprints for p11g */}
          {[-2, -1, 1, 2, 3].map(n => {
            const isOdd = Math.abs(n) % 2 === 1;
            const baseX = n * HALF;
            return (
              <path key={`bg-${n}`}
                d={footprintPath(isOdd)}
                transform={`translate(${baseX}, ${isOdd ? 0 : 0}) scale(1, ${isOdd ? -1 : 1})`}
                fill="var(--ink-faint)"
                opacity={0.35}
              />
            );
          })}

          {/* Highlighted animated footprint */}
          <g transform={`translate(${-PERIOD + tx}, 0) scale(1, ${scaleY})`}>
            <path d={footprintPath(false)} fill={COL_GLIDE} opacity={0.9} />
          </g>

          {/* Mirror ghost: same x-position but just flipped, no translation */}
          {showMirrorGhost && (
            <g transform={`translate(${-PERIOD}, 0) scale(1, -1)`}>
              <path d={footprintPath(false)} fill={COL_HMIRR} opacity={0.35} />
            </g>
          )}

          {/* g² = T: second footprint, continuing the animation */}
          {showSquared && (
            <g transform={`translate(${-PERIOD + tx2}, 0) scale(1, ${scaleY2})`}>
              <path d={footprintPath(false)} fill={COL_ROT} opacity={0.8} />
            </g>
          )}

          {/* Label showing current displacement */}
          <text x={0} y={vbH / 2 - 6} textAnchor="middle" fontSize={9} fill="var(--ink-dim)" fontFamily="var(--mono)">
            {lang === 'zh'
              ? `x 位移: ${Math.round(tx)} / ${HALF}  scaleY: ${scaleY.toFixed(2)}`
              : `x shift: ${Math.round(tx)} / ${HALF}  scaleY: ${scaleY.toFixed(2)}`}
          </text>

          {/* g² annotation */}
          {showSquared && scrub > 0 && (
            <text x={60} y={vbH / 2 - 6} textAnchor="middle" fontSize={9} fill={COL_ROT} fontFamily="var(--mono)">
              {lang === 'zh' ? `g²: x=${Math.round(PERIOD - PERIOD + tx2)}` : `g²: x=${Math.round(tx2 - HALF + HALF)}`}
            </text>
          )}
        </svg>
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
        {lang === 'zh'
          ? <>拖动滑块可见：滑动反射 = 反射 + 平移 <TeX src={String.raw`\tfrac{T}{2}`} />。到 100% 时落在下一个格点。<br />
              <TeX src={String.raw`g^2 = T`} />（两次滑动 = 整一期平移，而非恒等）。</>
          : <>Drag to see: glide = reflect then shift by <TeX src={String.raw`\tfrac{T}{2}`} />. At 100% it lands on the next lattice point.<br />
              <TeX src={String.raw`g^2 = T`} /> (two glides = one full translation, NOT the identity).</>}
      </div>
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────

function FriezeTable({ lang }: { lang: 'zh' | 'en' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="gt-compare" style={{ fontSize: 12, minWidth: 440 }}>
        <thead>
          <tr>
            <th>IUC</th>
            <th>{lang === 'zh' ? 'Conway' : 'Conway'}</th>
            <th>T</th>
            <th>v</th>
            <th>h</th>
            <th>r</th>
            <th>g</th>
            <th>{tr({ zh: '抽象群', en: 'Abstract' })}</th>
          </tr>
        </thead>
        <tbody>
          {FRIEZE_TABLE.map(f => (
            <tr key={f.id}>
              <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{f.id}</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{FRIEZE_NAMES[f.id].conway}</td>
              <td style={{ textAlign: 'center', color: 'var(--green)' }}>✓</td>
              <td style={{ textAlign: 'center', color: f.hasV ? 'var(--green)' : 'var(--ink-faint)' }}>
                {f.hasV ? '✓' : '−'}
              </td>
              <td style={{ textAlign: 'center', color: f.hasH ? 'var(--green)' : 'var(--ink-faint)' }}>
                {f.hasH ? '✓' : '−'}
              </td>
              <td style={{ textAlign: 'center', color: f.hasR ? 'var(--green)' : 'var(--ink-faint)' }}>
                {f.hasR ? '✓' : '−'}
              </td>
              <td style={{ textAlign: 'center', color: f.hasEG ? 'var(--green)' : 'var(--ink-faint)' }}>
                {f.hasEG ? '✓' : '−'}
              </td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
                {f.absClass}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main section export ───────────────────────────────────────────────────────

export default function FriezeGroups() {
  const lang = useLang();

  return (
    <GTSec id="frieze-groups" className="gt-sec">
      <div className="gt-sec-num">§43</div>
      <h2 className="gt-sec-title">
        <L zh="七种带饰群" en="The 7 frieze groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            将一块图案沿着无限长的带子周期性重复，它能拥有哪些对称？答案精确地是七种，称为<strong>带饰群</strong>（frieze group，又译"带状群"），由 1D 平移格点叠加至多四种等距变换——竖直镜、水平镜、半转、滑动反射——生成。虽然群有无穷多个元素，但几何类型只有 7 种，抽象同构类仅有 4 种。
          </>}
          en={<>
            Tile a pattern periodically along an infinite strip: exactly how many symmetry groups can it have? The answer is precisely seven, called <strong>frieze groups</strong>, each built from a 1D translation lattice and at most four additional isometries — vertical mirror, horizontal mirror, 180° rotation, and glide reflection. Despite having infinitely many elements, there are only 7 geometric types and just 4 abstract isomorphism classes.
          </>}
        />
      </p>

      {/* Definition box */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 带饰群" en="Definition: Frieze group" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>带饰群</strong>是平面等距群 <TeX src={String.raw`E(2)`} /> 的子群 <TeX src={String.raw`G`} />，满足：
              (i) <TeX src={String.raw`G`} /> 是离散的（最短非零平移有正下界）；
              (ii) <TeX src={String.raw`G`} /> 中所有平移构成的子群 <TeX src={String.raw`T(G) \cong \mathbb{Z}`} />（沿固定方向的单向格点），即<em>一维平移格</em>。
              正是这个"秩 1 格"区分带饰群（<TeX src={String.raw`\mathbb{Z}`} />）与壁纸群（<TeX src={String.raw`\mathbb{Z}^2`} />）。
            </>}
            en={<>
              A <strong>frieze group</strong> is a subgroup <TeX src={String.raw`G`} /> of the plane isometry group <TeX src={String.raw`E(2)`} /> such that:
              (i) <TeX src={String.raw`G`} /> is discrete (there is a minimum positive translation length);
              (ii) the translation subgroup <TeX src={String.raw`T(G) \cong \mathbb{Z}`} /> (a one-dimensional lattice along a fixed direction).
              It is this rank-1 lattice — not any dimensional property of the plane — that separates frieze groups (<TeX src={String.raw`\mathbb{Z}`} />) from wallpaper groups (<TeX src={String.raw`\mathbb{Z}^2`} />).
            </>}
          />
          <p style={{ marginTop: 10, marginBottom: 0 }}>
            <L
              zh={<>
                平面等距变换共四种：平移、旋转、反射、滑动反射。带饰群中只允许 180° 旋转（因更高阶旋转需要二维格），故生成元集合来自 <TeX src={String.raw`\{T,\,v,\,h,\,r,\,g\}`} />（其中 <TeX src={String.raw`r`} /> 阶为 2，<TeX src={String.raw`g^2=T`} />）。
              </>}
              en={<>
                Every plane isometry is a translation, rotation, reflection, or glide reflection. In frieze groups only 180° rotations are possible (higher-order ones need a 2D lattice), so generators come from <TeX src={String.raw`\{T,\,v,\,h,\,r,\,g\}`} /> with <TeX src={String.raw`r^2 = e`} /> and the key identity <TeX src={String.raw`g^2 = T`} />.
              </>}
            />
          </p>
        </div>
      </div>

      {/* Classification theorem */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: 恰好七种带饰群" en="Theorem: There are exactly 7 frieze groups" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              在仿射等价意义下（坐标变换共轭），带饰群恰好有 7 种，其 IUC 记号为
              <TeX src={String.raw`\mathrm{p1},\ \mathrm{p11g},\ \mathrm{p1m1},\ \mathrm{p2},\ \mathrm{p2mg},\ \mathrm{p11m},\ \mathrm{p2mm}`} />，
              由包含哪些对称元素 <TeX src={String.raw`\{v,h,r,g\}`} /> 完全区分。
            </>}
            en={<>
              Up to affine equivalence, there are exactly 7 frieze groups, with IUC names
              <TeX src={String.raw`\mathrm{p1},\ \mathrm{p11g},\ \mathrm{p1m1},\ \mathrm{p2},\ \mathrm{p2mg},\ \mathrm{p11m},\ \mathrm{p2mm}`} />,
              distinguished by which subset of <TeX src={String.raw`\{v,h,r,g\}`} /> accompanies the mandatory translation <TeX src={String.raw`T`} />.
            </>}
          />
          <div className="gt-proof">
            <div className="gt-proof-title">
              {tr({ zh: '证明思路', en: 'Proof sketch'
            })}
            </div>
            <p style={{ margin: '6px 0' }}>
              <L
                zh={<>
                  由于 <TeX src={String.raw`T(G) \trianglelefteq G`} />（平移子群正规），群 <TeX src={String.raw`G`} /> 分解为半直积 <TeX src={String.raw`G = T(G) \rtimes P`} />，其中<em>点群</em> <TeX src={String.raw`P = G/T(G)`} /> 只能是带截面对称的有限子群之一：<TeX src={String.raw`\{e\}`} />、<TeX src={String.raw`\mathbb{Z}_2`} />（由 <TeX src={String.raw`h`} /> 或 <TeX src={String.raw`r`} />）、<TeX src={String.raw`\mathbb{Z}_2 \times \mathbb{Z}_2`} />（由 <TeX src={String.raw`h,v`} />），共枚举出 7 种相容组合。
                </>}
                en={<>
                  Since <TeX src={String.raw`T(G) \trianglelefteq G`} /> (the translation subgroup is normal), the group decomposes as <TeX src={String.raw`G = T(G) \rtimes P`} /> where the <em>point group</em> <TeX src={String.raw`P = G/T(G)`} /> must be a finite subgroup of the strip's cross-sectional symmetries. Enumerating all consistent (P, lattice-coupling) combinations yields exactly 7 cases. <span className="gt-proof-end">□</span>
                </>}
              />
            </p>
          </div>
        </div>
      </div>

      <p>
        <L
          zh={<>
            <strong>7 种几何类型，4 种抽象群。</strong>作为抽象群，7 种带饰群归入 4 个同构类：
          </>}
          en={<>
            <strong>7 geometric types, but only 4 abstract groups.</strong> As abstract groups the 7 frieze groups fall into exactly 4 isomorphism classes:
          </>}
        />
      </p>
      <TeXBlock src={String.raw`
        \underbrace{\mathrm{p1},\,\mathrm{p11g}}_{\cong\,\mathbb{Z}}
        \quad
        \underbrace{\mathrm{p11m}}_{\cong\,\mathbb{Z}\times\mathbb{Z}_2}
        \quad
        \underbrace{\mathrm{p1m1},\,\mathrm{p2},\,\mathrm{p2mg}}_{\cong\,D_\infty}
        \quad
        \underbrace{\mathrm{p2mm}}_{\cong\,D_\infty\times\mathbb{Z}_2}
      `} />
      <p>
        <L
          zh={<>
            其中无限二面体群 <TeX src={String.raw`D_\infty = \mathbb{Z} \rtimes_\varphi \mathbb{Z}_2`} />（<TeX src={String.raw`\varphi`} /> 为取逆自同构 <TeX src={String.raw`n\mapsto -n`} />），表现为 <TeX src={String.raw`\langle t,s \mid s^2=e,\; sts^{-1}=t^{-1}\rangle`} />。注意 p1 与 p11g 抽象同构（均 <TeX src={String.raw`\cong\mathbb{Z}`} />）但几何不同：前者生成元是平移 <TeX src={String.raw`T`} />，后者生成元是滑动 <TeX src={String.raw`g`} />（有 <TeX src={String.raw`g^2=T`} />）。
          </>}
          en={<>
            Here <TeX src={String.raw`D_\infty = \mathbb{Z}\rtimes_\varphi \mathbb{Z}_2`} /> (with <TeX src={String.raw`\varphi`} /> the inversion <TeX src={String.raw`n\mapsto -n`} />), presented as <TeX src={String.raw`\langle t,s\mid s^2=e,\;sts^{-1}=t^{-1}\rangle`} />. Note: p1 and p11g are abstractly identical (<TeX src={String.raw`\cong\mathbb{Z}`} />) but geometrically distinct — p1's generator is the translation <TeX src={String.raw`T`} /> while p11g's is the glide <TeX src={String.raw`g`} /> satisfying <TeX src={String.raw`g^2=T`} />.
          </>}
        />
      </p>

      {/* Dimensional sequence aside */}
      <div className="gt-aside">
        <L
          zh={<>
            <strong>晶体学中的序列：</strong>带饰群 7 种（1D 格）→ 壁纸群 17 种（2D 格）→ 空间群 230 种（3D 格）。
            从带饰到壁纸只是将平移格从 <TeX src={String.raw`\mathbb{Z}`} /> 升为 <TeX src={String.raw`\mathbb{Z}^2`} />，代价是组合数从 7 暴增到 17。
          </>}
          en={<>
            <strong>Crystallographic sequence:</strong> 7 frieze groups (1D lattice) → 17 wallpaper groups (2D lattice) → 230 space groups (3D lattice). Upgrading the translation lattice from <TeX src={String.raw`\mathbb{Z}`} /> to <TeX src={String.raw`\mathbb{Z}^2`} /> multiplies the count from 7 to 17; one more dimension gives 230.
          </>}
        />
      </div>

      {/* Symmetry table */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="七种带饰群速查表" en="Quick-reference table" />
      </h3>

      <FriezeTable lang={lang} />

      <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>
        <L
          zh={<>v = 竖直镜；h = 水平镜；r = 半转 180°；g = 本质滑动（周期 <TeX src={String.raw`T/2`} /> 的滑动反射）。p11m 与 p2mm 含平凡滑动（<TeX src={String.raw`h\circ T`} />），但非独立生成元，故不列在 g 列。</>}
          en={<>v = vertical mirror; h = horizontal mirror; r = 180° rotation; g = essential glide (glide reflection by period <TeX src={String.raw`T/2`} />). p11m and p2mm contain a trivial glide (<TeX src={String.raw`h\circ T`} />) but it is not an independent generator, so the g column is left empty for them.</>}
        />
      </p>

      {/* Key identity callout */}
      <div className="gt-pullquote">
        <L
          zh={<>
            <TeX src={String.raw`g^2 = T`} />：滑动反射的平方是整一期平移，而非恒等。<br />
            滑动 <TeX src={String.raw`g`} /> 的阶无穷大。合成规则 <TeX src={String.raw`h\circ v = r`} /> 说明竖直与水平镜的同时出现会<em>强制</em>产生半转，这正是 7 种（而非 <TeX src={String.raw`2^4=16`} /> 种）组合的根本原因。
          </>}
          en={<>
            <TeX src={String.raw`g^2 = T`} />: the square of a glide is a full period translation, not the identity. The glide <TeX src={String.raw`g`} /> has infinite order. The composition rule <TeX src={String.raw`h\circ v = r`} /> (perpendicular reflections compose to a half-turn) means having both mirrors <em>forces</em> a rotation — which is why there are exactly 7 (not <TeX src={String.raw`2^4=16`} />) consistent combinations.
          </>}
        />
        <div className="gt-pullquote-cite">Gallian, <em>Contemporary Abstract Algebra</em>, Ch. 28</div>
      </div>

      {/* Widget 1 */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="探索七种带饰图案" en="Explore the 7 frieze patterns" />
      </h3>
      <p style={{ marginBottom: 16 }}>
        <L
          zh={<>选择一种带饰群，查看其对称元素在图案中的位置。字母"R"的不对称性使每种对称操作（反射、半转、滑动）在视觉上一目了然——若改用圆形或对称花纹，所有群看起来将毫无区别。</>}
          en={<>Choose a frieze group to see its symmetry elements overlaid on the pattern. The asymmetric glyph makes every isometry (reflection, half-turn, glide) visually distinct — a symmetric motif would make all groups look identical.</>}
        />
      </p>
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="带饰群探索器" en="Frieze type explorer" />
        </div>
        <div className="gt-panel-sub">
          <L zh="选择群类型，切换对称元素叠加层，播放平移动画" en="Select group type, toggle symmetry overlays, play translation animation" />
        </div>
        <SevenTypeFriezeExplorer lang={lang} />
      </div>

      {/* Widget 2 */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="自己搭建带饰群" en="Build your own frieze group" />
      </h3>
      <p style={{ marginBottom: 16 }}>
        <L
          zh={<>勾选你想要的对称元素，程序自动计算群的闭包——你会发现有些组合强制引入额外的对称。这正是 7 种（而非 16 种）的来源：<em>并非所有组合都自洽</em>。</>}
          en={<>Check which symmetries you want. The widget closes the set under composition — you will find some combinations force additional symmetries. This is exactly why there are 7, not 16: <em>not all combinations are self-consistent</em>.</>}
        />
      </p>
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="带饰群构造器" en="Frieze group builder" />
        </div>
        <div className="gt-panel-sub">
          <L zh="勾选对称元素，自动判定所属群类型" en="Toggle symmetries, group type resolves automatically" />
        </div>
        <BuildYourOwnFrieze lang={lang} />
      </div>

      {/* Widget 3 */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="滑动反射 vs 水平镜面" en="Glide reflection vs horizontal mirror" />
      </h3>
      <p style={{ marginBottom: 16 }}>
        <L
          zh={<>滑动反射（p11g）和纯水平反射（p11m）在图案上的区别极易混淆。动画展示了滑动如何将脚印"反转再平移 <TeX src={String.raw`T/2`} />"，以及两次滑动如何恢复到原始方向但整整前进了一个周期：<TeX src={String.raw`g^2 = T`} />。</>}
          en={<>The glide (p11g) and pure horizontal reflection (p11m) are famously easy to confuse. The animation shows how a glide "reflects then shifts by <TeX src={String.raw`T/2`} />", and how two glides restore orientation while advancing by one full period: <TeX src={String.raw`g^2 = T`} />.</>}
        />
      </p>
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="滑动 vs 镜面动画" en="Glide vs mirror animator" />
        </div>
        <div className="gt-panel-sub">
          <L zh="拖动进度条查看 g 的作用；勾选 g² 验证 g² = T" en="Scrub to see g act; enable g² to verify g² = T" />
        </div>
        <GlideVsMirrorAnimator lang={lang} />
      </div>

      {/* Cube connection */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="与魔方的结构类比" en="Structural analogy to the Rubik's cube" />
      </h3>
      <div className="gt-aside">
        <L
          zh={<>
            <strong>诚实的类比，而非错误的等同。</strong>魔方群是<em>有限</em>群（<TeX src={String.raw`4.3\times 10^{19}`} /> 阶），而每个带饰群都是<em>无穷</em>群；带饰群不直接作用于魔方。但结构上有两处真实的共鸣：
            <br /><br />
            (1) <strong>半直积分解</strong>：带饰群分解为 <TeX src={String.raw`G = T \rtimes P`} />（正规平移格被有限点群扩展）。魔方群同样分解为正规"朝向子群"（角块 <TeX src={String.raw`\mathbb{Z}_3^7`} />，棱块 <TeX src={String.raw`\mathbb{Z}_2^{11}`} />）被置换群半直积扩展。两者都是"正规子群 + 对称作用"的结构。
            <br /><br />
            (2) <strong>二面体积木</strong>：7 种带饰群中有 3 种抽象同构于无穷二面体群 <TeX src={String.raw`D_\infty = \varinjlim D_n`} />；魔方单面的对称群是有限二面体群 <TeX src={String.raw`D_4`} />（阶 8），整体旋转对称群是阶 24 的有限点群，均属同一家族。带饰群是学习半直积与二面体结构最小的非平凡例子。
          </>}
          en={<>
            <strong>Genuine analogy, not false identity.</strong> The Rubik's cube group is <em>finite</em> (order <TeX src={String.raw`\approx 4.3\times 10^{19}`} />) while every frieze group is <em>infinite</em>; no frieze group literally acts on the cube. But two structural resonances are real:
            <br /><br />
            (1) <strong>Semidirect-product decomposition:</strong> every frieze group decomposes as <TeX src={String.raw`G = T \rtimes P`} /> (a normal translation lattice extended by a finite point group acting on it). The cube group likewise decomposes — a normal "orientation" subgroup (<TeX src={String.raw`\mathbb{Z}_3^7`} /> for corners, <TeX src={String.raw`\mathbb{Z}_2^{11}`} /> for edges) is extended semidirectly by a permutation group. Both use the same "normal subgroup of states, symmetry action on top" architecture.
            <br /><br />
            (2) <strong>Dihedral building block:</strong> three of the 7 frieze groups are abstractly isomorphic to the infinite dihedral group <TeX src={String.raw`D_\infty`} />; the symmetry group of one cube face is the finite dihedral group <TeX src={String.raw`D_4`} /> (order 8). Frieze groups are the smallest non-trivial arena for the semidirect-product and dihedral machinery cubers already use.
          </>}
        />
      </div>

      {/* Pitfalls */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="常见误区" en="Common pitfalls" />
      </h3>
      <ul style={{ lineHeight: 1.9, color: 'var(--ink)', paddingLeft: 20 }}>
        {(lang === 'zh' ? [
          '带饰群有 7 种（几何类型），不是 4 种——4 只是抽象同构类数。',
          '带饰群是无穷群，不是单个瓦片的有限对称群。',
          '区分带饰与壁纸群的是平移格的秩（1 vs 2），而非"1D vs 2D 空间"（两者都活在平面里）。',
          '水平镜 h 与竖直镜 v 同时存在时，自动生成半转 r（h∘v = r），故封闭的组合只有 7 种，不是 2⁴=16 种。',
          '带饰群中旋转只有 180°；3、4、6 折旋转需要二维格，带饰群中不存在。',
          'p11m 和 p2mm 含平凡滑动（h∘T），但本质对称元素是水平镜，不应再画滑动轴。',
          'p2mg 有本质滑动、竖直镜和半转，但没有水平镜——不要为它画水平镜线。',
          'g² = T，不是 g² = 恒等；滑动反射的阶是无穷大。',
          '图案必须用不对称图元（如"R"或脚印）；对称图元会掩盖不同群的区别。',
        ] : [
          'There are 7 frieze groups (geometric types), not 4 — 4 is the count of abstract isomorphism classes.',
          'Frieze groups are infinite groups, not finite symmetry groups of a single tile.',
          'What separates frieze from wallpaper groups is the rank of the translation lattice (1 vs 2), not "1D vs 2D space" (both live in the plane).',
          'Having both h and v forces a half-turn r (h∘v = r), so only 7 (not 2⁴=16) combinations are self-consistent.',
          'Rotations in frieze groups are only 180°; 3-, 4-, or 6-fold rotations require a 2D lattice and are absent.',
          'p11m and p2mm contain a trivial glide (h∘T) but the essential symmetry is the horizontal mirror — do not draw a glide axis for them.',
          'p2mg has an essential glide, vertical mirrors, and half-turns, but NO horizontal mirror.',
          'g² = T, not the identity; the glide reflection has infinite order.',
          'The motif must be asymmetric (R, footprint); a symmetric motif hides the difference between groups.',
        ]).map((txt, i) => (
          <li key={i} style={{ fontSize: 14, marginBottom: 4 }}>{txt}</li>
        ))}
      </ul>

      {/* References */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="参考文献" en="References" />
      </h3>
      <ul style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ink-dim)', paddingLeft: 20 }}>
        <li>Gallian, J. A. <em>Contemporary Abstract Algebra</em>, 9th ed., Ch. 28 "Frieze Groups and Crystallographic Groups."</li>
        <li>Landau, T. "Classifications of Frieze Groups and an Introduction to Crystallographic Groups." Whitman College, 2019.</li>
        <li>Wikipedia. "Frieze group." (IUC notation, comparison table, Conway nicknames.)</li>
      </ul>

      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 16 }}>
        <L
          zh={<>IUC 符号遵循 International Tables / Wikipedia 惯例：p1, p11g, p1m1, p2, p2mg, p11m, p2mm。部分教材（含 Gallian）使用旧式四符号写法（p111, p1g1, pm11 等），含义相同，符号不同。</>}
          en={<>IUC symbols follow the International Tables / Wikipedia convention: p1, p11g, p1m1, p2, p2mg, p11m, p2mm. Some texts (including Gallian) use older four-character forms (p111, p1g1, pm11, …) — same symmetry content, different symbol strings.</>}
        />
      </p>
    </GTSec>
  );
}
