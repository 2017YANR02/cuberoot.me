'use client';

/**
 * PuzzleImageStudio — the whole puzzle-image control surface: preview + export
 * row + every control, extracted verbatim from app/[lang]/visualcube/page.tsx.
 *
 * FULLY CONTROLLED. It holds no URL state (project rule: `useQueryState` only in
 * page-level hosts — see useImageSpec.ts) and no spec state; the host passes
 * `spec` and receives patches. That is what lets the same component be the
 * /visualcube page and a panel inside /sim without forking.
 *
 * mode='panel' only reflows the layout (puzzle-image.css, .vc-studio-panel);
 * it drops no control.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Copy, Check, Download, RotateCcw, Plus, Trash2, Camera, Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// Type-only imports (fully erased at build) — the concrete sim engine + export
// module are dynamically imported inside the capture handler so /visualcube (which
// passes no simBridge) never bundles the ~1.2MB three/cuber engine.
import type * as THREE from 'three';
import type World from '@/app/[lang]/sim/engine/world';
import type { ExportProgress } from '@/app/[lang]/sim/sim_export';
import PillToggle from '@/components/PillToggle/PillToggle';
import CubeVirtualKeyboard from '@/components/CubeVirtualKeyboard';
import PuzzleImage from '@/components/puzzle-image/PuzzleImage';
import { publicApiUrl } from '@/lib/api-base';
import { appendArrow, buildArrowEntry } from '@/lib/puzzle-image/arrows';
import { pzlShort, specToParams } from '@/lib/puzzle-image/codec';
import {
  DEFAULTS, FACE_DEFAULTS,
  resetRotationsForPuzzle, rotationDefaultsFor,
  snapRotationOnVariantBoundary,
} from '@/lib/puzzle-image/defaults';
import {
  CORE_MASKS, EXTENDED_MASKS, MASK_ROTATIONS,
  SIZE2_MASKS, SIZE4_MASKS, SIZE5_MASKS, SIZE6_MASKS, SIZE7_MASKS, SIZE9_MASKS,
  type MaskOption,
} from '@/lib/puzzle-image/masks';
import { renderPaintedNetSvg } from '@/lib/puzzle-image/painted-net';
import { domRenderKindOf, renderSpecSvg } from '@/lib/puzzle-image/render';
import { FACE_LIST, type FaceKey, type ImageSpec, type PuzzleType, type PuzzleVariant, type SpecialView } from '@/lib/puzzle-image/types';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import './puzzle-image.css';

const IMAGE_SIZE_PRESETS = [64, 88, 128, 256, 512, 1000];

/** Size-specific mask groups, keyed by cube size. */
const SIZE_MASKS: Record<number, { label: string; items: MaskOption[] }> = {
  2: { label: '2x2', items: SIZE2_MASKS },
  3: { label: 'Extended (3x3)', items: EXTENDED_MASKS },
  4: { label: '4x4', items: SIZE4_MASKS },
  5: { label: '5x5', items: SIZE5_MASKS },
  6: { label: '6x6', items: SIZE6_MASKS },
  7: { label: '7x7', items: SIZE7_MASKS },
  9: { label: '9x9', items: SIZE9_MASKS },
};

const PUZZLE_LABELS: Record<PuzzleType, string> = {
  cube: 'NxN', sq1: 'Sq1', megaminx: 'Mega', pyraminx: 'Pyra', skewb: 'Skewb',
};

/** Which variants a non-cube puzzle offers. Skewb alone has a separate cubing.js
 *  Net on top of the WCA-coloured one; the others' Net was renamed to WCA. */
function variantsFor(t: PuzzleType): PuzzleVariant[] {
  if (t === 'skewb') return ['iso', 'top', 'net', 'wca'];
  if (t === 'megaminx') return ['iso', 'top', 'wca'];
  return ['iso', 'wca'];
}

/** The projected views — the ones with a shell, a viewport and per-sticker paint. */
function isProjected(s: ImageSpec): boolean {
  return s.puzzleType === 'cube'
    ? s.cubeView !== 'net' && s.cubeView !== 'wca'
    : s.puzzleVariant !== 'net' && s.puzzleVariant !== 'wca';
}

// ── small primitives ────────────────────────────────────────────────────────

function NumberRow({
  label, value, min, max, step = 1, onChange, onReset,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (n: number) => void; onReset?: () => void;
}) {
  return (
    <div className="vc-row">
      <label className="vc-label">{label}</label>
      <div className="vc-row-controls">
        <input
          type="number" className="vc-num" value={value} min={min} max={max} step={step}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
        />
        <input
          type="range" className="vc-range" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        />
        {onReset && (
          <button type="button" className="vc-btn-icon" onClick={onReset} title="Reset">
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function ColorRow({
  label, value, onChange, onReset, allowEmpty,
}: {
  label: string; value: string; onChange: (v: string) => void;
  onReset?: () => void; allowEmpty?: boolean;
}) {
  return (
    <div className="vc-row">
      <label className="vc-label">{label}</label>
      <div className="vc-row-controls">
        <input
          type="color" className="vc-color" value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text" className="vc-color-text" value={value}
          placeholder={allowEmpty ? '(none)' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
        {onReset && (
          <button type="button" className="vc-btn-icon" onClick={onReset} title="Reset">
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function CopyButton({ getValue, label }: { getValue: () => string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="vc-btn"
      onClick={() => {
        navigator.clipboard.writeText(getValue());
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />} {label}
    </button>
  );
}

// ── studio ──────────────────────────────────────────────────────────────────

/**
 * Live-simulator bridge — present ONLY when the studio is the /sim 图像 panel.
 * Absent on the /visualcube page (page mode), so the capture subgroup never
 * renders there and the golden fixtures stay byte-identical.
 *
 * It carries the sim's live handles (for the canvas PNG snapshot + offline-render
 * mp4) and its current setup + alg (the mp4 export animates the alg). The image's
 * puzzle / alg / colours are NOT pulled through here — the sim injects them into the
 * spec via the codec (see SimPage), so the panel always mirrors the sim automatically.
 */
export interface SimBridge {
  getCanvas: () => HTMLCanvasElement | null;
  getWorld: () => World | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  setup: string;
  alg: string;
}

export interface PuzzleImageStudioProps {
  spec: ImageSpec;
  onSpecChange: (patch: Partial<ImageSpec>) => void;
  mode: 'page' | 'panel';
  className?: string;
  /** Present only in /sim panel mode → shows the live capture subgroup + 从模拟器取. */
  simBridge?: SimBridge;
}

export default function PuzzleImageStudio({ spec, onSpecChange, mode, className, simBridge }: PuzzleImageStudioProps) {
  const t = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const s = spec;
  const set = useCallback(<K extends keyof ImageSpec>(key: K, value: ImageSpec[K]) => {
    onSpecChange({ [key]: value } as Partial<ImageSpec>);
  }, [onSpecChange]);

  const projected = isProjected(s);
  const isCube = s.puzzleType === 'cube';
  // In /sim panel mode the sim's own puzzle dropdown is the single puzzle selector:
  // the panel renders whatever puzzle the sim shows (SimPage mirrors it into the spec),
  // so the studio drops its own puzzle-type + NxN-size controls. Every render/view/mask
  // control below stays.
  const showPuzzleControls = mode === 'page';
  // Panel mode also drops the controls the sim already owns — 公式 / 六面配色 come
  // straight from the sim (SimPage injects them via the codec), 背景色 defaults to
  // transparent, and 视角旋转 to the puzzle's clean iso. One control per concept.
  const showInheritedControls = mode === 'page';

  const previewRef = useRef<HTMLDivElement | null>(null);

  // ── export ─────────────────────────────────────────────────────────────
  // Always ask the PURE renderer first — the old code scraped `.vc-preview > svg`
  // and silently exported an empty blob on the 3x3 net (paint editor = HTML divs,
  // no <svg> at all). Only the genuinely DOM-only renderers fall back to
  // serializing the live DOM.
  const getCurrentSvg = useCallback((): string => {
    try {
      const pure = renderSpecSvg(s);
      if (pure) return pure;
    } catch { /* fall through to the DOM */ }
    if (domRenderKindOf(s) === 'net-paint-3x3') return renderPaintedNetSvg(s.paintedFacelet);
    // skewb `net` renders inside <scramble-display>'s shadow root, which
    // querySelector can't reach → export is a no-op here, same as pre-migration.
    // Not worth piercing the shadow DOM: that view intentionally shows cubing.js's
    // layout, so a tnoodle-net fallback would export a picture unlike the preview.
    const node = previewRef.current?.querySelector('svg');
    return node ? new XMLSerializer().serializeToString(node) : '';
  }, [s]);

  const downloadSvg = () => {
    const out = getCurrentSvg();
    if (!out) return;
    const blob = new Blob([out], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.puzzleType}-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    const out = getCurrentSvg();
    if (!out) return;
    const svgBlob = new Blob([out], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG decode failed'));
        img.src = svgUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = s.imageSize;
      canvas.height = s.imageSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, s.imageSize, s.imageSize);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${s.puzzleType}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const shareUrl = useMemo(() => {
    const qs = specToParams(s, '').toString();
    if (typeof window === 'undefined') return `/visualcube${qs ? '?' + qs : ''}`;
    return `${window.location.origin}/visualcube${qs ? '?' + qs : ''}`;
  }, [s]);

  // The API endpoint's own (simplified) param set — not specToParams.
  const apiSvgUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (s.algorithm) p.set(s.algType, s.algorithm);
    if (s.puzzleType !== 'cube') {
      p.set('pzl', pzlShort(s.puzzleType));
      if (s.puzzleVariant !== DEFAULTS.puzzleVariant) p.set('view', s.puzzleVariant);
    } else {
      if (s.cubeView !== 'normal') p.set('view', s.cubeView);
      if (s.cubeSize !== DEFAULTS.cubeSize) p.set('pzl', String(s.cubeSize));
    }
    if (s.stageMask) p.set('mask', s.stageMask);
    if (s.imageSize !== DEFAULTS.imageSize) p.set('size', String(s.imageSize));
    if (s.backgroundColor) p.set('bg', s.backgroundColor);
    if (s.cubeColor !== DEFAULTS.cubeColor) p.set('cc', s.cubeColor);
    if (s.cubeOpacity !== DEFAULTS.cubeOpacity) p.set('co', String(s.cubeOpacity));
    const qs = p.toString();
    // Copy-out snippet (API link / <img> / Markdown) → always the public API
    // origin; a dev-relative or 127.0.0.1 URL is dead the moment it's pasted
    // into an external blog or README.
    return `${publicApiUrl('/v1/visualcube.svg')}${qs ? '?' + qs : ''}`;
  }, [s]);

  // ── arrow builder ──────────────────────────────────────────────────────
  const arrowMaxIdx = s.cubeSize * s.cubeSize - 1;
  const addArrow = () => {
    const entry = buildArrowEntry({
      face: s.arrowFace, from: s.arrowFrom, to: s.arrowTo,
      pass: s.arrowPass, scale: s.arrowScale, influence: s.arrowInfluence,
      color: s.arrowColor, cubeSize: s.cubeSize,
    });
    if (!entry) return;
    set('arrows', appendArrow(s.arrows, entry));
  };

  // ── algorithm textarea (uncontrolled, keyboard writes straight to the DOM) ──
  const algRef = useRef<HTMLTextAreaElement | null>(null);
  const syncAlgFromDom = useCallback(() => {
    if (algRef.current) set('algorithm', algRef.current.value);
  }, [set]);

  // ── live capture (sim panel only — moved out of the retired DirectorPanel) ──
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const capturePreviewRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const snapshot = useCallback(() => {
    const cv = simBridge?.getCanvas();
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sim-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [simBridge]);

  const startExport = useCallback(async () => {
    if (!simBridge) return;
    const world = simBridge.getWorld();
    const renderer = simBridge.getRenderer();
    if (!world || !renderer || exporting) return;
    setExporting(true);
    abortRef.current = { aborted: false };
    setProgress({ phase: t('准备...', 'Preparing...'), pct: 0, framesDone: 0, framesTotal: 0 });
    // wait a frame so the overlay mounts and capturePreviewRef is live
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const { exportSimVideo } = await import('@/app/[lang]/sim/sim_export');
      await exportSimVideo({
        world, renderer, setup: simBridge.setup, alg: simBridge.alg, isZh,
        abortRef: abortRef.current,
        onProgress: setProgress,
        previewCanvas: capturePreviewRef.current,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'aborted') {
        console.error('[Sim Export] failed:', e);
        // eslint-disable-next-line no-alert
        alert(t('导出失败:', 'Export failed: ') + msg);
      }
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }, [simBridge, exporting, isZh, t]);

  const cancelExport = useCallback(() => { abortRef.current.aborted = true; }, []);
  const canRecord = !!simBridge && simBridge.alg.trim().length > 0;

  return (
    <div className={`vc-studio vc-studio-${mode}${className ? ` ${className}` : ''}`}>
      <section className="vc-preview-wrap" ref={previewRef}>
        <PuzzleImage spec={s} onSpecChange={onSpecChange} />
      </section>

      <section className="vc-exports">
        <CopyButton label={t('分享链接', 'Share URL')} getValue={() => shareUrl} />
        <CopyButton label={t('API 链接', 'API URL')} getValue={() => apiSvgUrl} />
        <button type="button" className="vc-btn" onClick={downloadSvg}>
          <Download size={14} /> SVG
        </button>
        <button type="button" className="vc-btn" onClick={downloadPng}>
          <Download size={14} /> PNG
        </button>
        <CopyButton
          label={t('<img> 标签', '<img> tag')}
          getValue={() => `<img src="${apiSvgUrl}" alt="cube" width="${s.imageSize}" height="${s.imageSize}" />`}
        />
        <CopyButton label="Markdown" getValue={() => `![cube](${apiSvgUrl})`} />

        {simBridge && (
          <div className="vc-capture-group">
            <span className="vc-capture-label">{t('实时', 'Live')}</span>
            <button type="button" className="vc-btn" onClick={snapshot}>
              <Camera size={14} /> {t('截图', 'Snapshot')}
            </button>
            <button
              type="button"
              className="vc-btn"
              onClick={startExport}
              disabled={!canRecord || exporting}
              title={!canRecord
                ? t('解法为空, 无可导出动画', 'Alg is empty — nothing to record')
                : t('导出 mp4 1080p:离线渲染当前解法动画', 'Export mp4 1080p: offline render of the solution animation')}
            >
              <Film size={14} /> {t('录制 MP4', 'Record MP4')}
            </button>
          </div>
        )}
      </section>

      {simBridge && exporting && progress && (
        <div className="sim-export-overlay">
          <div className="sim-export-card">
            <div className="sim-export-title">{t('导出视频中', 'Exporting video')}</div>
            <canvas ref={capturePreviewRef} className="sim-export-preview" />
            <div className="sim-export-bar">
              <div className="sim-export-bar-fill" style={{ width: `${(progress.pct * 100).toFixed(1)}%` }} />
            </div>
            <div className="sim-export-msg">{progress.phase}</div>
            <button type="button" className="sim-export-cancel" onClick={cancelExport}>
              {t('取消', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <section className="vc-controls">
        {showPuzzleControls && (
          <div className="vc-row">
            <label className="vc-label">{t('魔方', 'Puzzle')}</label>
            <div className="vc-row-controls">
              {(['cube', 'sq1', 'megaminx', 'pyraminx', 'skewb'] as PuzzleType[]).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  className={`vc-btn vc-btn-sm${s.puzzleType === pt ? ' vc-btn-active' : ''}`}
                  onClick={() => onSpecChange(resetRotationsForPuzzle(s, { puzzleType: pt }))}
                >
                  {PUZZLE_LABELS[pt]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="vc-row">
          <label className="vc-label">{t('视图', 'View')}</label>
          <div className="vc-row-controls">
            {isCube ? (
              (['normal', 'plan', 'trans', 'net', 'wca'] as SpecialView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`vc-btn vc-btn-sm${s.cubeView === v ? ' vc-btn-active' : ''}`}
                  onClick={() => set('cubeView', v)}
                >
                  {v}
                </button>
              ))
            ) : (
              variantsFor(s.puzzleType).map((pv) => (
                <button
                  key={pv}
                  type="button"
                  className={`vc-btn vc-btn-sm${s.puzzleVariant === pv ? ' vc-btn-active' : ''}`}
                  onClick={() => onSpecChange(snapRotationOnVariantBoundary(s, { puzzleVariant: pv }))}
                >
                  {pv === 'iso' ? tr({ zh: '立体', en: 'iso' })
                    : pv === 'top' ? tr({ zh: '顶视', en: 'top' })
                    : pv === 'wca' ? 'wca'
                    : tr({ zh: '展开', en: 'net' })}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="vc-row">
          {isCube && showPuzzleControls && (
            <>
              <label className="vc-label">{t('阶数', 'NxN Size')}</label>
              <input
                type="number" className="vc-num" value={s.cubeSize} min={1} max={50}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) set('cubeSize', Math.max(1, Math.min(50, n)));
                }}
              />
            </>
          )}
          <label className={`vc-label${isCube && showPuzzleControls ? ' vc-label-secondary' : ''}`}>
            {t('图片尺寸 (px)', 'Image Size (px)')}
          </label>
          {/* Preset select + a free number input: `?size=300` used to show an
              empty select with no way to read or edit the actual value. */}
          <select
            className="vc-select"
            value={IMAGE_SIZE_PRESETS.includes(s.imageSize) ? String(s.imageSize) : ''}
            onChange={(e) => {
              if (!e.target.value) return;
              set('imageSize', parseInt(e.target.value, 10));
            }}
          >
            {!IMAGE_SIZE_PRESETS.includes(s.imageSize) && (
              <option value="">{t('自定义', 'custom')}</option>
            )}
            {IMAGE_SIZE_PRESETS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input
            type="number" className="vc-num" value={s.imageSize} min={1} max={1000}
            aria-label={t('图片尺寸 (px)', 'Image Size (px)')}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n)) set('imageSize', Math.max(1, Math.min(1000, n)));
            }}
          />
        </div>

        {showInheritedControls && (
          <div className="vc-row vc-row-block">
            <label className="vc-label">{t('公式', 'Algorithm')}</label>
            <div className="vc-row-controls vc-col">
              <div className="vc-algtype">
                <PillToggle
                  value={s.algType === 'alg'}
                  onChange={(v) => set('algType', v ? 'alg' : 'case')}
                  onLabel={t('应用公式', 'Apply alg')}
                  offLabel={t('Case (反向)', 'Case (inverse)')}
                  ariaLabel={t('公式模式', 'Algorithm mode')}
                />
              </div>
              <div className="vc-row-controls">
                <textarea
                  ref={algRef}
                  className="vc-text vc-textarea"
                  rows={2}
                  defaultValue={s.algorithm}
                  onInput={syncAlgFromDom}
                />
                <button
                  type="button" className="vc-btn-icon" title="Clear"
                  onClick={() => {
                    if (algRef.current) algRef.current.value = '';
                    set('algorithm', '');
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <CubeVirtualKeyboard target={algRef} onInput={syncAlgFromDom} />
            </div>
          </div>
        )}

        {isCube && projected && (
          <div className="vc-row vc-row-block">
            <label className="vc-label">{t('箭头', 'Arrow Definition')}</label>
            <div className="vc-row-controls vc-col">
              <div className="vc-arrow-builder">
                <span>{t('面', 'Face')}</span>
                <select value={s.arrowFace} onChange={(e) => set('arrowFace', e.target.value as FaceKey)}>
                  {FACE_LIST.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <span>{t('从', 'From')}</span>
                <input
                  type="number" className="vc-num-sm" value={s.arrowFrom} min={0} max={arrowMaxIdx}
                  onChange={(e) => set('arrowFrom', parseInt(e.target.value, 10) || 0)}
                />
                <span>{t('到', 'To')}</span>
                <input
                  type="number" className="vc-num-sm" value={s.arrowTo} min={0} max={arrowMaxIdx}
                  onChange={(e) => set('arrowTo', parseInt(e.target.value, 10) || 0)}
                />
                <span>{t('过', 'Pass')}</span>
                <input
                  type="number" className="vc-num-sm" value={s.arrowPass ?? ''} min={0} max={arrowMaxIdx}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    set('arrowPass', isNaN(v as number) ? null : v);
                  }}
                />
                <span>{t('缩放', 'Scale')}</span>
                <input
                  type="number" className="vc-num-sm" value={s.arrowScale ?? ''} min={0} max={20}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    set('arrowScale', isNaN(v as number) ? null : v);
                  }}
                />
                <span>{t('影响', 'Influence')}</span>
                <input
                  type="number" className="vc-num-sm" value={s.arrowInfluence ?? ''} min={0} max={50}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    set('arrowInfluence', isNaN(v as number) ? null : v);
                  }}
                />
                <span>{t('颜色', 'Color')}</span>
                <input
                  type="color" className="vc-color-sm" value={s.arrowColor}
                  onChange={(e) => set('arrowColor', e.target.value)}
                />
                <button type="button" className="vc-btn vc-btn-sm" onClick={addArrow}>
                  <Plus size={14} /> {t('添加', 'Add')}
                </button>
              </div>
              <div className="vc-row-controls">
                <input
                  type="text" className="vc-text" value={s.arrows} placeholder="U0U2-red,U6U8"
                  onChange={(e) => set('arrows', e.target.value)}
                />
                <button type="button" className="vc-btn-icon" onClick={() => set('arrows', '')} title="Clear">
                  <Trash2 size={14} />
                </button>
              </div>
              <ColorRow
                label={t('默认箭头色', 'Default Arrow Color')}
                value={s.defaultArrowColor}
                onChange={(v) => set('defaultArrowColor', v)}
                onReset={() => set('defaultArrowColor', '')}
                allowEmpty
              />
            </div>
          </div>
        )}

        {isCube && projected && (
          <div className="vc-row">
            <label className="vc-label">{t('Mask', 'Stage Mask')}</label>
            <div className="vc-row-controls">
              <select
                className="vc-select" value={s.stageMask}
                onChange={(e) => set('stageMask', e.target.value)}
              >
                <optgroup label="Core">
                  {CORE_MASKS.map((m) => (
                    <option key={m.value || 'none'} value={m.value}>{m.label}</option>
                  ))}
                </optgroup>
                {SIZE_MASKS[s.cubeSize] && (
                  <optgroup label={SIZE_MASKS[s.cubeSize].label}>
                    {SIZE_MASKS[s.cubeSize].items.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <select
                className="vc-select" value={s.maskAlg}
                onChange={(e) => set('maskAlg', e.target.value)}
              >
                {MASK_ROTATIONS.map((r) => (
                  <option key={r || 'none'} value={r}>{r || '— rot —'}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isCube && projected && showInheritedControls && (
          <div className="vc-row vc-row-block">
            <label className="vc-label">{t('六面配色', 'Color Schemes')}</label>
            <div className="vc-row-controls vc-col">
              <div className="vc-keyrow">
                <button type="button" className="vc-btn-sm" onClick={() => onSpecChange({
                  faceU: s.faceB, faceF: s.faceU, faceD: s.faceF, faceB: s.faceD,
                })}>x</button>
                <button type="button" className="vc-btn-sm" onClick={() => onSpecChange({
                  faceF: s.faceR, faceR: s.faceB, faceB: s.faceL, faceL: s.faceF,
                })}>y</button>
                <button type="button" className="vc-btn-sm" onClick={() => onSpecChange({
                  faceU: s.faceR, faceR: s.faceD, faceD: s.faceL, faceL: s.faceU,
                })}>z</button>
                <button type="button" className="vc-btn-sm" onClick={() => onSpecChange({
                  faceU: FACE_DEFAULTS.U, faceR: FACE_DEFAULTS.R, faceF: FACE_DEFAULTS.F,
                  faceD: FACE_DEFAULTS.D, faceL: FACE_DEFAULTS.L, faceB: FACE_DEFAULTS.B,
                })}>{t('重置', 'Reset')}</button>
              </div>
              <div className="vc-face-grid">
                {FACE_LIST.map((f) => {
                  const key = `face${f}` as 'faceU' | 'faceR' | 'faceF' | 'faceD' | 'faceL' | 'faceB';
                  return (
                    <div key={f} className="vc-face-cell">
                      <span>{f}</span>
                      <input
                        type="color" value={s[key]}
                        aria-label={`face ${f}`}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {projected && showInheritedControls && (
          <div className="vc-row vc-row-block">
            <label className="vc-label">{t('视角旋转', 'Rotation Sequence')}</label>
            <div className="vc-row-controls vc-col">
              {([1, 2] as const).map((i) => {
                const axisKey = `rotateAxis${i}` as 'rotateAxis1' | 'rotateAxis2';
                const angleKey = `rotateAngle${i}` as 'rotateAngle1' | 'rotateAngle2';
                return (
                  <div key={i} className="vc-row-controls">
                    <select
                      className="vc-select-sm" value={s[axisKey]}
                      aria-label={t('旋转轴', 'Rotation axis')}
                      onChange={(e) => set(axisKey, e.target.value)}
                    >
                      {['x', 'y'].map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <input
                      type="number" className="vc-num" value={s[angleKey]} min={-180} max={180}
                      aria-label={t('旋转角度', 'Rotation angle')}
                      onChange={(e) => set(angleKey, parseInt(e.target.value, 10) || 0)}
                    />
                    <input
                      type="range" className="vc-range" value={s[angleKey]} min={-180} max={180}
                      aria-label={t('旋转角度', 'Rotation angle')}
                      onChange={(e) => set(angleKey, parseInt(e.target.value, 10))}
                    />
                    <button
                      type="button" className="vc-btn-icon" title="Reset"
                      onClick={() => {
                        const d = rotationDefaultsFor(s);
                        onSpecChange({
                          [axisKey]: i === 1 ? d.axis1 : d.axis2,
                          [angleKey]: i === 1 ? d.angle1 : d.angle2,
                        } as Partial<ImageSpec>);
                      }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showInheritedControls && (
          <ColorRow
            label={t('背景色', 'Background Color')}
            value={s.backgroundColor}
            onChange={(v) => set('backgroundColor', v)}
            onReset={() => set('backgroundColor', '')}
            allowEmpty
          />
        )}
        {isCube && projected && (
          <>
            <ColorRow
              label={t('壳体色', 'Cube Color')}
              value={s.cubeColor}
              onChange={(v) => set('cubeColor', v)}
              onReset={() => set('cubeColor', DEFAULTS.cubeColor)}
            />
            <NumberRow
              label={t('壳体不透明度', 'Cube Opacity')}
              value={s.cubeOpacity} min={0} max={100}
              onChange={(v) => set('cubeOpacity', v)}
              onReset={() => set('cubeOpacity', DEFAULTS.cubeOpacity)}
            />
            <NumberRow
              label={t('贴纸不透明度', 'Sticker Opacity')}
              value={s.stickerOpacity} min={0} max={100}
              onChange={(v) => set('stickerOpacity', v)}
              onReset={() => set('stickerOpacity', DEFAULTS.stickerOpacity)}
            />
            <NumberRow
              label={t('投影距离', 'Projection Distance')}
              value={s.dist} min={1} max={100}
              onChange={(v) => set('dist', v)}
              onReset={() => set('dist', DEFAULTS.dist)}
            />
          </>
        )}
      </section>

      <details className="vc-api-doc">
        <summary>{t('API 用法（外部嵌入）', 'API usage (embed elsewhere)')}</summary>
        <p>
          {t(
            '直接通过 GET /v1/visualcube.svg 拿到 SVG 字节流，可放进 <img>、curl、博客 Markdown 等。这是简化端点（7 个参数），完整参数请用本页生成后复制分享链接。',
            'GET /v1/visualcube.svg returns image/svg+xml directly. Use it in an <img>, curl, blog Markdown, etc. This is a simplified endpoint (7 params); for the full set, use this page and copy the share URL.',
          )}
        </p>
        <pre className="vc-api-example">{`https://api.cuberoot.me/v1/visualcube.svg?alg=R+U+R'+U'+R+U2+R'&view=oll&size=128`}</pre>
        <table className="vc-api-table">
          <thead>
            <tr>
              <th>{t('参数', 'Param')}</th>
              <th>{t('取值', 'Values')}</th>
              <th>{t('默认', 'Default')}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>alg</code></td><td>{t('WCA notation；alg 直接作用到 solved（forward）。和 case 互斥，case 优先', 'WCA notation; applied DIRECTLY to solved (forward). Mutually exclusive with case (case wins)')}</td><td>Sune</td></tr>
            <tr><td><code>case</code></td><td>{t('WCA notation；alg 的逆作用到 solved，即"该 alg 能还原的 case"。覆盖 alg', 'WCA notation; alg INVERTED on solved — "the case this alg solves". Overrides alg')}</td><td>—</td></tr>
            <tr><td><code>setup</code></td><td>{t('alg 的别名（forward）；语义上是 case 的预置打乱', 'Alias of alg (forward); semantic hint that the string is a case-setup scramble')}</td><td>—</td></tr>
            <tr><td><code>view</code></td><td><code>iso / plan / f2l / oll / pll / pll-iso / trans</code></td><td><code>iso</code></td></tr>
            <tr><td><code>mask</code></td><td>{t('显式 Masking 枚举值（覆盖 view 推断）', 'Explicit Masking enum, overrides view-derived')}</td><td>—</td></tr>
            <tr><td><code>size</code></td><td>{t('像素，clamped [32, 1000]', 'Pixels, clamped [32, 1000]')}</td><td>256</td></tr>
            <tr><td><code>bg</code></td><td>{t('hex（带不带 #）或 CSS 颜色名', 'Hex (with/without #) or CSS colour name')}</td><td>{t('透明', 'transparent')}</td></tr>
            <tr><td><code>cc</code></td><td>{t('壳体色（PHP cc）', 'Cube shell colour (PHP cc)')}</td><td>{t('黑（trans 时银）', 'black (silver when trans)')}</td></tr>
            <tr><td><code>co</code></td><td>{t('壳体不透明度 0-100（PHP co）', 'Cube opacity 0-100 (PHP co)')}</td><td>{t('100（trans 时 50）', '100 (50 when trans)')}</td></tr>
          </tbody>
        </table>
        <p className="vc-api-note">
          {t(
            '该端点不支持完整 PHP query API（无 arw / ac / sch / fc / fd 等）。需要这些参数请用本页生成 SVG 后下载或复制 <img> 标签。',
            'Endpoint does not accept the full PHP query API (no arw / ac / sch / fc / fd). For those, generate via this page and download/copy.',
          )}
        </p>
      </details>
    </div>
  );
}
