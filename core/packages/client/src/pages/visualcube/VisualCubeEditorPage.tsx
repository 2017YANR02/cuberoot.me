/**
 * /visualcube — full-feature interactive cube image generator.
 *
 * Inspired by visualcube.roudai.net (Vue + sr-visualizer). Renderer here is our
 * own @cuberoot/visualcube package, so all PHP visualcube parameters are wired
 * through (alg/case/arw/ac/sch/fc/fd/r/co/fo/cc/bg/dist/stage/mask-rotate/view).
 *
 * State sync:
 *   - Initial mount: read URL search params via parseOptions (PHP-style query)
 *     and seed individual state fields.
 *   - Any field change: rebuild URL (replace) so the address bar always reflects
 *     the current image, ready for share / copy.
 *
 * Render path: state → ICubeOptions → renderCubeSVG() → dangerouslySetInnerHTML.
 * No /api/visualcube.svg roundtrip here — that endpoint is intentionally a
 * 5-param simplified surface; this page needs the full ICubeOptions.
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Download, RotateCcw, Plus, Trash2 } from 'lucide-react';
import {
  renderCubeSVG,
  Masking,
  Axis,
  type ICubeOptions,
} from '@cuberoot/visualcube';

// ── Constants ────────────────────────────────────────────────────────────────

const FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
type FaceKey = (typeof FACE_LIST)[number];

const FACE_DEFAULTS: Record<FaceKey, string> = {
  U: '#fefe00',
  R: '#ee0000',
  F: '#0000f2',
  D: '#ffffff',
  L: '#ffa100',
  B: '#00d800',
};

// PHP visualcube core 22 stage masks (well-supported on NxN; some on 3x3 only)
const CORE_MASKS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: Masking.FL, label: 'FL' },
  { value: Masking.F2L, label: 'F2L' },
  { value: Masking.LL, label: 'LL' },
  { value: Masking.CLL, label: 'CLL' },
  { value: Masking.ELL, label: 'ELL' },
  { value: Masking.OLL, label: 'OLL' },
  { value: Masking.OCLL, label: 'OCLL' },
  { value: Masking.OELL, label: 'OELL' },
  { value: Masking.COLL, label: 'COLL' },
  { value: Masking.OCELL, label: 'OCELL' },
  { value: Masking.WV, label: 'WV' },
  { value: Masking.VH, label: 'VH' },
  { value: Masking.ELS, label: 'ELS' },
  { value: Masking.CLS, label: 'CLS' },
  { value: Masking.CMLL, label: 'CMLL' },
  { value: Masking.CROSS, label: 'CROSS' },
  { value: Masking.F2L1, label: 'F2L #1' },
  { value: Masking.F2L2, label: 'F2L #2' },
  { value: Masking.F2L3, label: 'F2L #3' },
  { value: Masking.F2LSM, label: 'F2L SM' },
  { value: Masking.F2B, label: 'F2B' },
  { value: Masking.LINE, label: 'LINE' },
];

// 3x3-only extended masks (Block / Cross / DR / Mehta / Roux / etc)
const EXTENDED_MASKS: { value: string; label: string }[] = [
  { value: Masking.TWO_BY_TWO_BY_TWO, label: '2x2x2' },
  { value: Masking.TWO_BY_TWO_BY_THREE, label: '2x2x3' },
  { value: Masking.ONE_ONE_TWO, label: '1x1x2' },
  { value: Masking.ONE_TWO_TWO, label: '1x2x2' },
  { value: Masking.CROSS_PARTIAL, label: 'Cross (partial)' },
  { value: Masking.CROSS_FR, label: 'Cross FR' },
  { value: Masking.CROSS_BR, label: 'Cross BR' },
  { value: Masking.CROSS_FB, label: 'Cross FB' },
  { value: Masking.CROSS_LR, label: 'Cross LR' },
  { value: Masking.XCROSS_FR, label: 'XCross FR' },
  { value: Masking.XCROSS_BR, label: 'XCross BR' },
  { value: Masking.XCROSS_FL, label: 'XCross FL' },
  { value: Masking.XCROSS_BL, label: 'XCross BL' },
  { value: Masking.XXCROSS, label: 'XXCross' },
  { value: Masking.DEC, label: 'DEC' },
  { value: Masking.PAIR, label: 'Pair' },
  { value: Masking.EO_ORBIT, label: 'EO orbit' },
  { value: Masking.FB, label: 'Roux FB' },
  { value: Masking.SB, label: 'Roux SB' },
  { value: Masking.DR, label: 'DR' },
  { value: Masking.EOLS, label: 'EOLS' },
  { value: Masking.L5EF, label: 'L5EF' },
];

const MASK_ROTATIONS = ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];

const ALG_QUICK_KEYS_UPPER = ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', "'", '(', ')'];
const ALG_QUICK_KEYS_LOWER = ['u', 'r', 'f', 'd', 'l', 'b', 'w', '2', 'x', 'y', 'z'];

// ── State ────────────────────────────────────────────────────────────────────

type AlgType = 'alg' | 'case';
type SpecialView = 'normal' | 'plan' | 'trans';

interface EditorState {
  cubeSize: number;
  imageSize: number;
  algType: AlgType;
  algorithm: string;
  arrows: string;
  defaultArrowColor: string;  // '' = unset
  cubeView: SpecialView;
  stageMask: string;          // '' = none
  maskAlg: string;            // '' = none
  faceU: string;
  faceR: string;
  faceF: string;
  faceD: string;
  faceL: string;
  faceB: string;
  rotateAxis1: string;
  rotateAxis2: string;
  rotateAxis3: string;
  rotateAngle1: number;
  rotateAngle2: number;
  rotateAngle3: number;
  backgroundColor: string;    // '' = transparent
  cubeColor: string;          // default '#000000'
  cubeOpacity: number;        // 0-100
  stickerOpacity: number;     // 0-100
  dist: number;               // 1-100
  // Arrow builder UI (not in URL)
  arrowFace: FaceKey;
  arrowFrom: number;
  arrowTo: number;
  arrowPass: number | null;
  arrowScale: number | null;
  arrowInfluence: number | null;
  arrowColor: string;
}

const DEFAULTS: EditorState = {
  cubeSize: 3,
  imageSize: 256,
  algType: 'alg',
  algorithm: '',
  arrows: '',
  defaultArrowColor: '',
  cubeView: 'normal',
  stageMask: '',
  maskAlg: '',
  faceU: FACE_DEFAULTS.U,
  faceR: FACE_DEFAULTS.R,
  faceF: FACE_DEFAULTS.F,
  faceD: FACE_DEFAULTS.D,
  faceL: FACE_DEFAULTS.L,
  faceB: FACE_DEFAULTS.B,
  rotateAxis1: 'y',
  rotateAxis2: 'x',
  rotateAxis3: 'z',
  rotateAngle1: 45,
  rotateAngle2: -34,
  rotateAngle3: 0,
  backgroundColor: '',
  cubeColor: '#000000',
  cubeOpacity: 100,
  stickerOpacity: 100,
  dist: 5,
  arrowFace: 'U',
  arrowFrom: 0,
  arrowTo: 2,
  arrowPass: null,
  arrowScale: null,
  arrowInfluence: null,
  arrowColor: '#808080',
};

function readInitialFromUrl(params: URLSearchParams): EditorState {
  const get = (k: string) => params.get(k);
  const num = (k: string, fallback: number, min?: number, max?: number) => {
    const raw = get(k);
    if (raw == null) return fallback;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return fallback;
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };
  const s = { ...DEFAULTS };
  s.cubeSize = num('pzl', DEFAULTS.cubeSize, 1, 10);
  s.imageSize = num('size', DEFAULTS.imageSize, 1, 1000);

  if (get('case') != null) {
    s.algType = 'case';
    s.algorithm = get('case') ?? '';
  } else if (get('alg') != null) {
    s.algType = 'alg';
    s.algorithm = get('alg') ?? '';
  }

  if (get('arw') != null) s.arrows = get('arw') ?? '';
  if (get('ac') != null) s.defaultArrowColor = get('ac') ?? '';

  // view: 'plan' / 'trans' / (anything else → 'normal')
  const view = get('view');
  if (view === 'plan' || view === 'trans') s.cubeView = view;

  // stage=mask-rotation
  const stage = get('stage');
  if (stage) {
    const dashIdx = stage.lastIndexOf('-');
    if (dashIdx > 0 && MASK_ROTATIONS.includes(stage.slice(dashIdx + 1))) {
      s.stageMask = stage.slice(0, dashIdx);
      s.maskAlg = stage.slice(dashIdx + 1);
    } else {
      s.stageMask = stage;
    }
  }

  // sch — comma-separated 6 colours U R F D L B (or blank)
  const sch = get('sch');
  if (sch && sch.includes(',')) {
    const parts = sch.split(',');
    if (parts[0]) s.faceU = parts[0];
    if (parts[1]) s.faceR = parts[1];
    if (parts[2]) s.faceF = parts[2];
    if (parts[3]) s.faceD = parts[3];
    if (parts[4]) s.faceL = parts[4];
    if (parts[5]) s.faceB = parts[5];
  }

  // r=y45x-34z0  (axis-letter then signed degrees, repeating)
  const r = get('r');
  if (r) {
    const matches = [...r.matchAll(/([xyz])(-?\d{1,3})/g)];
    if (matches[0]) { s.rotateAxis1 = matches[0][1]; s.rotateAngle1 = parseInt(matches[0][2], 10); }
    if (matches[1]) { s.rotateAxis2 = matches[1][1]; s.rotateAngle2 = parseInt(matches[1][2], 10); }
    if (matches[2]) { s.rotateAxis3 = matches[2][1]; s.rotateAngle3 = parseInt(matches[2][2], 10); }
  }

  if (get('bg') != null) s.backgroundColor = get('bg') ?? '';
  if (get('cc') != null) s.cubeColor = get('cc') ?? DEFAULTS.cubeColor;
  s.cubeOpacity = num('co', DEFAULTS.cubeOpacity, 0, 100);
  s.stickerOpacity = num('fo', DEFAULTS.stickerOpacity, 0, 100);
  s.dist = num('dist', DEFAULTS.dist, 1, 100);
  return s;
}

function stateToParams(s: EditorState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.cubeSize !== DEFAULTS.cubeSize) p.set('pzl', String(s.cubeSize));
  if (s.imageSize !== DEFAULTS.imageSize) p.set('size', String(s.imageSize));
  if (s.algorithm) p.set(s.algType, s.algorithm);
  if (s.arrows) p.set('arw', s.arrows);
  if (s.defaultArrowColor) p.set('ac', s.defaultArrowColor);
  if (s.cubeView !== 'normal') p.set('view', s.cubeView);
  if (s.stageMask) {
    p.set('stage', s.maskAlg ? `${s.stageMask}-${s.maskAlg}` : s.stageMask);
  }
  // sch: emit only when any face differs from default
  const schDifferent =
    s.faceU !== FACE_DEFAULTS.U || s.faceR !== FACE_DEFAULTS.R ||
    s.faceF !== FACE_DEFAULTS.F || s.faceD !== FACE_DEFAULTS.D ||
    s.faceL !== FACE_DEFAULTS.L || s.faceB !== FACE_DEFAULTS.B;
  if (schDifferent) {
    p.set('sch', [s.faceU, s.faceR, s.faceF, s.faceD, s.faceL, s.faceB].join(','));
  }
  // r: emit when not default
  if (s.rotateAxis1 !== DEFAULTS.rotateAxis1 || s.rotateAngle1 !== DEFAULTS.rotateAngle1 ||
      s.rotateAxis2 !== DEFAULTS.rotateAxis2 || s.rotateAngle2 !== DEFAULTS.rotateAngle2 ||
      s.rotateAxis3 !== DEFAULTS.rotateAxis3 || s.rotateAngle3 !== DEFAULTS.rotateAngle3) {
    p.set('r', `${s.rotateAxis1}${s.rotateAngle1}${s.rotateAxis2}${s.rotateAngle2}${s.rotateAxis3}${s.rotateAngle3}`);
  }
  if (s.backgroundColor) p.set('bg', s.backgroundColor);
  if (s.cubeColor !== DEFAULTS.cubeColor) p.set('cc', s.cubeColor);
  if (s.cubeOpacity !== DEFAULTS.cubeOpacity) p.set('co', String(s.cubeOpacity));
  if (s.stickerOpacity !== DEFAULTS.stickerOpacity) p.set('fo', String(s.stickerOpacity));
  if (s.dist !== DEFAULTS.dist) p.set('dist', String(s.dist));
  return p;
}

function stateToOpts(s: EditorState): ICubeOptions {
  const opts: ICubeOptions = {
    cubeSize: s.cubeSize,
    width: s.imageSize,
    height: s.imageSize,
  };
  if (s.algorithm) {
    if (s.algType === 'alg') opts.algorithm = s.algorithm;
    else opts.case = s.algorithm;
  }
  if (s.arrows) opts.arrows = s.arrows;
  if (s.defaultArrowColor) opts.defaultArrowColor = s.defaultArrowColor;

  // Special view: trans is a preset (cc=silver + co=50, explicit overrides win)
  if (s.cubeView === 'plan') opts.view = 'plan';
  if (s.cubeView === 'trans') {
    if (s.cubeColor === DEFAULTS.cubeColor) opts.cubeColor = 'silver';
    if (s.cubeOpacity === DEFAULTS.cubeOpacity) opts.cubeOpacity = 50;
  }

  if (s.stageMask) opts.mask = s.stageMask as Masking;
  if (s.maskAlg) opts.maskAlg = s.maskAlg;

  // Color scheme — only set when any face differs from default
  const schDiff =
    s.faceU !== FACE_DEFAULTS.U || s.faceR !== FACE_DEFAULTS.R ||
    s.faceF !== FACE_DEFAULTS.F || s.faceD !== FACE_DEFAULTS.D ||
    s.faceL !== FACE_DEFAULTS.L || s.faceB !== FACE_DEFAULTS.B;
  if (schDiff) {
    opts.colorScheme = {
      0: s.faceU, 1: s.faceR, 2: s.faceF, 3: s.faceD, 4: s.faceL, 5: s.faceB,
    };
  }

  // Rotation sequence
  const axisEnum = (a: string): Axis => (a === 'x' ? Axis.X : a === 'y' ? Axis.Y : Axis.Z);
  if (s.rotateAxis1 !== DEFAULTS.rotateAxis1 || s.rotateAngle1 !== DEFAULTS.rotateAngle1 ||
      s.rotateAxis2 !== DEFAULTS.rotateAxis2 || s.rotateAngle2 !== DEFAULTS.rotateAngle2 ||
      s.rotateAxis3 !== DEFAULTS.rotateAxis3 || s.rotateAngle3 !== DEFAULTS.rotateAngle3) {
    opts.viewportRotations = [
      [axisEnum(s.rotateAxis1), s.rotateAngle1],
      [axisEnum(s.rotateAxis2), s.rotateAngle2],
      [axisEnum(s.rotateAxis3), s.rotateAngle3],
    ];
  }

  if (s.backgroundColor) opts.backgroundColor = s.backgroundColor;
  if (s.cubeColor !== DEFAULTS.cubeColor && opts.cubeColor === undefined) opts.cubeColor = s.cubeColor;
  if (s.cubeOpacity !== DEFAULTS.cubeOpacity && opts.cubeOpacity === undefined) opts.cubeOpacity = s.cubeOpacity;
  if (s.stickerOpacity !== DEFAULTS.stickerOpacity) opts.stickerOpacity = s.stickerOpacity;
  if (s.dist !== DEFAULTS.dist) opts.dist = s.dist;

  return opts;
}

// ── Small UI primitives ─────────────────────────────────────────────────────

function NumberRow({
  label, value, min, max, step = 1, onChange, onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  onReset?: () => void;
}) {
  return (
    <div className="vc-row">
      <label className="vc-label">{label}</label>
      <div className="vc-row-controls">
        <input
          type="number"
          className="vc-num"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
        />
        <input
          type="range"
          className="vc-range"
          value={value}
          min={min}
          max={max}
          step={step}
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
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  allowEmpty?: boolean;
}) {
  return (
    <div className="vc-row">
      <label className="vc-label">{label}</label>
      <div className="vc-row-controls">
        <input
          type="color"
          className="vc-color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="vc-color-text"
          value={value}
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

// ── Main page ────────────────────────────────────────────────────────────────

export default function VisualCubeEditorPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [searchParams, setSearchParams] = useSearchParams();
  // Seed once from URL — afterwards URL is a derived view of state.
  const initialRef = useRef<EditorState | null>(null);
  if (initialRef.current === null) initialRef.current = readInitialFromUrl(searchParams);
  const [state, setState] = useState<EditorState>(initialRef.current);

  const set = useCallback(<K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Sync state → URL (replace, debounced via microtask)
  useEffect(() => {
    const next = stateToParams(state);
    // Avoid no-op writes (also avoids restarting the URL history entry).
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [state, searchParams, setSearchParams]);

  const opts = useMemo(() => stateToOpts(state), [state]);
  const svg = useMemo(() => {
    try {
      return renderCubeSVG(opts);
    } catch (e) {
      return `<div style="color:red">${(e as Error).message}</div>`;
    }
  }, [opts]);

  const shareUrl = useMemo(() => {
    const qs = stateToParams(state).toString();
    return `${window.location.origin}/visualcube${qs ? '?' + qs : ''}`;
  }, [state]);

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cube-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const apiUrl = useMemo(() => {
    // /api/visualcube.svg only supports a subset (alg/view/mask/size/bg/cc/co)
    const p = new URLSearchParams();
    if (state.algorithm) p.set('alg', state.algorithm);  // endpoint always treats as case
    if (state.cubeView !== 'normal') p.set('view', state.cubeView);
    if (state.stageMask) p.set('mask', state.stageMask);
    if (state.imageSize !== DEFAULTS.imageSize) p.set('size', String(state.imageSize));
    if (state.backgroundColor) p.set('bg', state.backgroundColor);
    if (state.cubeColor !== DEFAULTS.cubeColor) p.set('cc', state.cubeColor);
    if (state.cubeOpacity !== DEFAULTS.cubeOpacity) p.set('co', String(state.cubeOpacity));
    return `${window.location.origin}/api/visualcube.svg${p.toString() ? '?' + p.toString() : ''}`;
  }, [state]);

  // ── Algorithm helpers ─────────────────────────────────────────────────────
  const appendAlg = (key: string) => {
    set('algorithm', state.algorithm ? state.algorithm + ' ' + key : key);
  };

  // ── Arrow builder ─────────────────────────────────────────────────────────
  const addArrow = () => {
    const numStickers = state.cubeSize * state.cubeSize;
    if (state.arrowFrom < 0 || state.arrowFrom >= numStickers) return;
    if (state.arrowTo < 0 || state.arrowTo >= numStickers) return;
    let entry = `${state.arrowFace}${state.arrowFrom}${state.arrowFace}${state.arrowTo}`;
    if (state.arrowPass !== null && state.arrowPass >= 0 && state.arrowPass < numStickers) {
      entry += `${state.arrowFace}${state.arrowPass}`;
    }
    if (state.arrowScale !== null) entry += `-s${state.arrowScale}`;
    if (state.arrowInfluence !== null) entry += `-i${state.arrowInfluence}`;
    if (state.arrowColor) {
      // Strip leading # for compactness when valid hex (the visualcube parser accepts both)
      const c = state.arrowColor.startsWith('#') ? state.arrowColor.slice(1) : state.arrowColor;
      entry += `-${c}`;
    }
    set('arrows', state.arrows ? state.arrows + ',' + entry : entry);
  };

  const arrowMaxIdx = state.cubeSize * state.cubeSize - 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="vc-editor-page">
      <style>{INLINE_CSS}</style>

      <header className="vc-header">
        <h1>{t('VisualCube 编辑器', 'VisualCube Editor')}</h1>
      </header>

      {/* Preview */}
      <section className="vc-preview-wrap">
        <div
          className="vc-preview"
          style={{ width: state.imageSize, height: state.imageSize }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </section>

      {/* Export buttons */}
      <section className="vc-exports">
        <CopyButton label={t('复制分享链接', 'Copy share URL')} getValue={() => shareUrl} />
        <CopyButton label={t('复制 API 链接', 'Copy API URL')} getValue={() => apiUrl} />
        <button type="button" className="vc-btn" onClick={downloadSvg}>
          <Download size={14} /> {t('下载 SVG', 'Download SVG')}
        </button>
        <CopyButton
          label={t('复制 <img> 标签', 'Copy <img> tag')}
          getValue={() => `<img src="${apiUrl}" alt="cube" width="${state.imageSize}" height="${state.imageSize}" />`}
        />
        <CopyButton
          label={t('复制 Markdown', 'Copy Markdown')}
          getValue={() => `![cube](${apiUrl})`}
        />
      </section>

      {/* Controls */}
      <section className="vc-controls">
        <NumberRow
          label={t('魔方阶数', 'Puzzle Type')}
          value={state.cubeSize} min={1} max={10}
          onChange={(v) => set('cubeSize', v)}
          onReset={() => set('cubeSize', DEFAULTS.cubeSize)}
        />
        <NumberRow
          label={t('图片尺寸 (px)', 'Image Size (px)')}
          value={state.imageSize} min={32} max={1000} step={8}
          onChange={(v) => set('imageSize', v)}
          onReset={() => set('imageSize', DEFAULTS.imageSize)}
        />

        {/* Algorithm */}
        <div className="vc-row vc-row-block">
          <label className="vc-label">{t('公式', 'Algorithm')}</label>
          <div className="vc-row-controls vc-col">
            <div className="vc-radio-group">
              <label>
                <input type="radio" checked={state.algType === 'alg'} onChange={() => set('algType', 'alg')} />
                {t('应用公式', 'Apply alg')}
              </label>
              <label>
                <input type="radio" checked={state.algType === 'case'} onChange={() => set('algType', 'case')} />
                {t('Case (反向)', 'Case (inverse)')}
              </label>
            </div>
            <div className="vc-keyrow">
              {ALG_QUICK_KEYS_UPPER.map((k) => (
                <button key={k} type="button" className="vc-keybtn" onClick={() => appendAlg(k)}>{k}</button>
              ))}
            </div>
            <div className="vc-keyrow">
              {ALG_QUICK_KEYS_LOWER.map((k) => (
                <button key={k} type="button" className="vc-keybtn" onClick={() => appendAlg(k)}>{k}</button>
              ))}
            </div>
            <div className="vc-row-controls">
              <input
                type="text"
                className="vc-text"
                value={state.algorithm}
                placeholder="R U R' U' …"
                onChange={(e) => set('algorithm', e.target.value)}
              />
              <button type="button" className="vc-btn-icon" onClick={() => set('algorithm', '')} title="Clear">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Arrow editor */}
        <div className="vc-row vc-row-block">
          <label className="vc-label">{t('箭头', 'Arrow Definition')}</label>
          <div className="vc-row-controls vc-col">
            <div className="vc-arrow-builder">
              <span>{t('面', 'Face')}</span>
              <select value={state.arrowFace} onChange={(e) => set('arrowFace', e.target.value as FaceKey)}>
                {FACE_LIST.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <span>{t('从', 'From')}</span>
              <input type="number" className="vc-num-sm" value={state.arrowFrom} min={0} max={arrowMaxIdx}
                onChange={(e) => set('arrowFrom', parseInt(e.target.value, 10) || 0)} />
              <span>{t('到', 'To')}</span>
              <input type="number" className="vc-num-sm" value={state.arrowTo} min={0} max={arrowMaxIdx}
                onChange={(e) => set('arrowTo', parseInt(e.target.value, 10) || 0)} />
              <span>{t('过', 'Pass')}</span>
              <input
                type="number" className="vc-num-sm"
                value={state.arrowPass ?? ''}
                min={0} max={arrowMaxIdx}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  set('arrowPass', isNaN(v as number) ? null : v);
                }}
              />
              <span>{t('缩放', 'Scale')}</span>
              <input
                type="number" className="vc-num-sm"
                value={state.arrowScale ?? ''}
                min={0} max={20}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  set('arrowScale', isNaN(v as number) ? null : v);
                }}
              />
              <span>{t('影响', 'Influence')}</span>
              <input
                type="number" className="vc-num-sm"
                value={state.arrowInfluence ?? ''}
                min={0} max={50}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  set('arrowInfluence', isNaN(v as number) ? null : v);
                }}
              />
              <span>{t('颜色', 'Color')}</span>
              <input type="color" className="vc-color-sm" value={state.arrowColor}
                onChange={(e) => set('arrowColor', e.target.value)} />
              <button type="button" className="vc-btn vc-btn-sm" onClick={addArrow}>
                <Plus size={14} /> {t('添加', 'Add')}
              </button>
            </div>
            <div className="vc-row-controls">
              <input
                type="text"
                className="vc-text"
                value={state.arrows}
                placeholder="U0U2-red,U6U8"
                onChange={(e) => set('arrows', e.target.value)}
              />
              <button type="button" className="vc-btn-icon" onClick={() => set('arrows', '')} title="Clear">
                <Trash2 size={14} />
              </button>
            </div>
            <ColorRow
              label={t('默认箭头色', 'Default Arrow Color')}
              value={state.defaultArrowColor}
              onChange={(v) => set('defaultArrowColor', v)}
              onReset={() => set('defaultArrowColor', '')}
              allowEmpty
            />
          </div>
        </div>

        {/* Special view */}
        <div className="vc-row">
          <label className="vc-label">{t('视角', 'Special View')}</label>
          <div className="vc-row-controls">
            <div className="vc-radio-group">
              {(['normal', 'plan', 'trans'] as SpecialView[]).map((v) => (
                <label key={v}>
                  <input
                    type="radio"
                    checked={state.cubeView === v}
                    onChange={() => set('cubeView', v)}
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Stage Mask + Mask Alg */}
        <div className="vc-row">
          <label className="vc-label">{t('Mask', 'Stage Mask')}</label>
          <div className="vc-row-controls">
            <select className="vc-select" value={state.stageMask}
              onChange={(e) => set('stageMask', e.target.value)}>
              <optgroup label="Core">
                {CORE_MASKS.map((m) => <option key={m.value || 'none'} value={m.value}>{m.label}</option>)}
              </optgroup>
              <optgroup label="Extended (3x3 only)">
                {EXTENDED_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </optgroup>
            </select>
            <select className="vc-select" value={state.maskAlg}
              onChange={(e) => set('maskAlg', e.target.value)}>
              {MASK_ROTATIONS.map((r) => (
                <option key={r || 'none'} value={r}>{r || '— rot —'}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Color Schemes */}
        <div className="vc-row vc-row-block">
          <label className="vc-label">{t('六面配色', 'Color Schemes')}</label>
          <div className="vc-row-controls vc-col">
            <div className="vc-keyrow">
              <button type="button" className="vc-btn-sm" onClick={() => {
                // x-rotation: U F D B + L stays + R stays (mock: faces rotate around x)
                setState((p) => ({ ...p, faceU: p.faceB, faceF: p.faceU, faceD: p.faceF, faceB: p.faceD }));
              }}>x</button>
              <button type="button" className="vc-btn-sm" onClick={() => {
                // y-rotation: F R B L
                setState((p) => ({ ...p, faceF: p.faceR, faceR: p.faceB, faceB: p.faceL, faceL: p.faceF }));
              }}>y</button>
              <button type="button" className="vc-btn-sm" onClick={() => {
                // z-rotation: U L D R
                setState((p) => ({ ...p, faceU: p.faceR, faceR: p.faceD, faceD: p.faceL, faceL: p.faceU }));
              }}>z</button>
              <button type="button" className="vc-btn-sm" onClick={() => {
                setState((p) => ({ ...p, ...FACE_DEFAULTS_STATE }));
              }}>{t('重置', 'Reset')}</button>
            </div>
            <div className="vc-face-grid">
              {(['U', 'R', 'F', 'D', 'L', 'B'] as FaceKey[]).map((f) => {
                const stateKey = `face${f}` as keyof EditorState;
                return (
                  <div key={f} className="vc-face-cell">
                    <span>{f}</span>
                    <input
                      type="color"
                      value={state[stateKey] as string}
                      onChange={(e) => set(stateKey, e.target.value as never)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rotation Sequence */}
        <div className="vc-row vc-row-block">
          <label className="vc-label">{t('视角旋转', 'Rotation Sequence')}</label>
          <div className="vc-row-controls vc-col">
            {[1, 2, 3].map((i) => {
              const axisKey = `rotateAxis${i}` as 'rotateAxis1' | 'rotateAxis2' | 'rotateAxis3';
              const angleKey = `rotateAngle${i}` as 'rotateAngle1' | 'rotateAngle2' | 'rotateAngle3';
              return (
                <div key={i} className="vc-row-controls">
                  <select className="vc-select-sm" value={state[axisKey]}
                    onChange={(e) => set(axisKey, e.target.value)}>
                    {['x', 'y', 'z'].map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input
                    type="number"
                    className="vc-num"
                    value={state[angleKey]}
                    min={-180} max={180}
                    onChange={(e) => set(angleKey, parseInt(e.target.value, 10) || 0)}
                  />
                  <input
                    type="range"
                    className="vc-range"
                    value={state[angleKey]}
                    min={-180} max={180}
                    onChange={(e) => set(angleKey, parseInt(e.target.value, 10))}
                  />
                  <button type="button" className="vc-btn-icon" title="Reset"
                    onClick={() => {
                      set(axisKey, DEFAULTS[axisKey] as never);
                      set(angleKey, DEFAULTS[angleKey] as never);
                    }}>
                    <RotateCcw size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Background / Cube colour */}
        <ColorRow
          label={t('背景色', 'Background Color')}
          value={state.backgroundColor}
          onChange={(v) => set('backgroundColor', v)}
          onReset={() => set('backgroundColor', '')}
          allowEmpty
        />
        <ColorRow
          label={t('壳体色', 'Cube Color')}
          value={state.cubeColor}
          onChange={(v) => set('cubeColor', v)}
          onReset={() => set('cubeColor', DEFAULTS.cubeColor)}
        />

        {/* Opacity / Distance */}
        <NumberRow
          label={t('壳体不透明度', 'Cube Opacity')}
          value={state.cubeOpacity} min={0} max={100}
          onChange={(v) => set('cubeOpacity', v)}
          onReset={() => set('cubeOpacity', DEFAULTS.cubeOpacity)}
        />
        <NumberRow
          label={t('贴纸不透明度', 'Sticker Opacity')}
          value={state.stickerOpacity} min={0} max={100}
          onChange={(v) => set('stickerOpacity', v)}
          onReset={() => set('stickerOpacity', DEFAULTS.stickerOpacity)}
        />
        <NumberRow
          label={t('投影距离', 'Projection Distance')}
          value={state.dist} min={1} max={100}
          onChange={(v) => set('dist', v)}
          onReset={() => set('dist', DEFAULTS.dist)}
        />
      </section>
    </div>
  );
}

const FACE_DEFAULTS_STATE = {
  faceU: FACE_DEFAULTS.U, faceR: FACE_DEFAULTS.R, faceF: FACE_DEFAULTS.F,
  faceD: FACE_DEFAULTS.D, faceL: FACE_DEFAULTS.L, faceB: FACE_DEFAULTS.B,
};

// ── Inline CSS ───────────────────────────────────────────────────────────────
// Page-scoped neutral grays inspired by Photoshop / DaVinci / Final Cut:
// borderless flat panels, layered backgrounds (page < panel < sunken-input),
// no separator lines — spacing carries the rhythm. Override the global warm-
// brown tokens so this editor reads as a tool, not a content page.
const INLINE_CSS = `
.vc-editor-page {
  --vc-bg: #1e1e1e;
  --vc-panel: #2a2a2a;
  --vc-input: #161616;
  --vc-hover: #353535;
  --vc-text: #e0e0e0;
  --vc-text-dim: #888;
  --vc-accent: #d97757;
  --vc-divider: #3a3a3a;

  max-width: 960px; margin: 0 auto; padding: 16px;
  background: var(--vc-bg); color: var(--vc-text);
}
.vc-header { padding: 4px 0 14px; margin-bottom: 12px; }
.vc-header h1 { margin: 0; font-size: 18px; font-weight: 500; color: var(--vc-text); letter-spacing: 0.3px; }

.vc-preview-wrap {
  display: flex; justify-content: center; align-items: center;
  padding: 32px; background: #161616; border-radius: 4px; min-height: 280px;
}
.vc-preview {
  display: inline-block;
  background: repeating-conic-gradient(rgba(255,255,255,0.025) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}
.vc-preview svg { display: block; }

.vc-exports { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 18px; }

.vc-controls { display: flex; flex-direction: column; }
.vc-row {
  display: grid; grid-template-columns: 140px 1fr;
  gap: 16px; align-items: center; padding: 10px 0;
}
.vc-row-block { align-items: start; }
.vc-row-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.vc-col { flex-direction: column; align-items: stretch; gap: 8px; }
.vc-label { font-size: 12px; font-weight: 500; color: var(--vc-text-dim); text-transform: uppercase; letter-spacing: 0.5px; }

/* sunken inputs: darker than panel, no border, focus shows a soft inset ring */
.vc-num, .vc-text, .vc-num-sm, .vc-color-text, .vc-select, .vc-select-sm {
  background: var(--vc-input); color: var(--vc-text);
  border: 1px solid transparent; border-radius: 3px;
  padding: 6px 9px; font-size: 13px; font-family: inherit;
  outline: none;
}
.vc-num { width: 72px; }
.vc-num-sm { width: 56px; padding: 4px 7px; font-size: 12px; }
.vc-text { flex: 1; min-width: 0; font-family: var(--font-mono, monospace); }
.vc-color-text { width: 96px; font-size: 12px; font-family: var(--font-mono, monospace); }
.vc-select-sm { width: 56px; padding: 4px 7px; font-size: 12px; }
.vc-num:focus, .vc-text:focus, .vc-num-sm:focus, .vc-color-text:focus,
.vc-select:focus, .vc-select-sm:focus {
  border-color: var(--vc-accent);
  box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.18);
}

/* range slider — flat track, prominent thumb */
.vc-range { flex: 1; min-width: 120px; height: 18px; -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
.vc-range::-webkit-slider-runnable-track { height: 4px; background: var(--vc-input); border-radius: 2px; }
.vc-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--vc-accent); margin-top: -5px; cursor: pointer; }
.vc-range::-moz-range-track { height: 4px; background: var(--vc-input); border-radius: 2px; border: none; }
.vc-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--vc-accent); border: none; cursor: pointer; }

/* color swatches — borderless, integrated with panel bg */
.vc-color, .vc-color-sm {
  padding: 0; border: none; border-radius: 3px; cursor: pointer; background: transparent;
}
.vc-color { width: 44px; height: 26px; }
.vc-color-sm { width: 34px; height: 22px; }
.vc-color::-webkit-color-swatch-wrapper, .vc-color-sm::-webkit-color-swatch-wrapper { padding: 0; }
.vc-color::-webkit-color-swatch, .vc-color-sm::-webkit-color-swatch { border: none; border-radius: 3px; }
.vc-color::-moz-color-swatch, .vc-color-sm::-moz-color-swatch { border: none; border-radius: 3px; }

/* buttons — flat, no border, hover shifts background only */
.vc-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px;
  background: var(--vc-panel); color: var(--vc-text);
  border: none; border-radius: 3px;
  font-size: 12px; cursor: pointer; transition: background 0.12s;
  font-family: inherit;
}
.vc-btn:hover { background: var(--vc-hover); }
.vc-btn:active { background: #404040; }
.vc-btn-sm { padding: 5px 9px; font-size: 11px; }
.vc-btn-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0;
  background: var(--vc-panel); color: var(--vc-text-dim);
  border: none; border-radius: 3px; cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.vc-btn-icon:hover { background: var(--vc-hover); color: var(--vc-text); }

.vc-radio-group { display: flex; gap: 16px; font-size: 13px; color: var(--vc-text); }
.vc-radio-group label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.vc-radio-group input[type=radio] { accent-color: var(--vc-accent); }

/* alg quick keys — keyboard-tile look, flat */
.vc-keyrow { display: flex; flex-wrap: wrap; gap: 3px; }
.vc-keybtn {
  width: 30px; height: 28px; padding: 0;
  background: var(--vc-panel); color: var(--vc-text);
  border: none; border-radius: 3px;
  font-family: var(--font-mono, monospace); font-size: 12px; cursor: pointer;
  transition: background 0.12s;
}
.vc-keybtn:hover { background: var(--vc-hover); }

.vc-arrow-builder {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px;
  background: rgba(0,0,0,0.18); padding: 10px 12px; border-radius: 4px;
  color: var(--vc-text-dim);
}
.vc-arrow-builder > span { color: var(--vc-text-dim); margin-right: -2px; }

.vc-face-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.vc-face-cell {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-size: 11px; color: var(--vc-text-dim); padding: 6px; background: rgba(0,0,0,0.18); border-radius: 3px;
}
.vc-face-cell input[type=color] { width: 100%; height: 24px; padding: 0; border: none; border-radius: 2px; cursor: pointer; background: transparent; }
.vc-face-cell input[type=color]::-webkit-color-swatch { border: none; border-radius: 2px; }
.vc-face-cell input[type=color]::-moz-color-swatch { border: none; border-radius: 2px; }

@media (max-width: 768px) {
  .vc-row { grid-template-columns: 1fr; gap: 6px; padding: 10px 0; }
  .vc-label { font-size: 11px; }
  .vc-num, .vc-text, .vc-num-sm { font-size: 12px; }
  .vc-face-grid { grid-template-columns: repeat(3, 1fr); }
  .vc-preview-wrap { padding: 16px; }
}
`;
