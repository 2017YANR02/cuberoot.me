'use client';

/**
 * /visualcube — full-feature interactive cube image generator (Next 16 port).
 *
 * Ported 1:1 from packages/client/src/pages/visualcube/VisualCubeEditorPage.tsx.
 *
 * Changes vs Vite:
 *   - react-router useSearchParams/setSearchParams → nuqs useQueryStates
 *     (history: 'replace'; wrapped in <Suspense> per Next 16 client-component rule).
 *   - react-router Link → next/link.
 *   - useDocumentTitle imported from @/hooks/useDocumentTitle.
 *   - InteractiveCubeNet reused from app/scramble/solver/_InteractiveCubeNet.tsx.
 *   - invertSq1Alg from app/scramble/gen/_svg/sq1_svg.ts.
 *   - SVG renderers from app/scramble/gen/_svg/*.
 *   - VisualCube renderer (@cuberoot/visualcube) is workspace dep, added to package.json.
 *   - Cube net path: the Vite version delegates non-3x3 cube nets to CubingPreview
 *     (cubing.js scramble-display). client-next has no scramble-display; we fall back
 *     to the tnoodle-port renderCubeUnfoldedSvg for *all* sizes (covers WCA layout for
 *     2x2..NxN), so the cube net branch always returns a deterministic SVG without
 *     needing the scramble-display web component. 3x3 still uses the InteractiveCubeNet
 *     paint editor.
 *   - Skewb 'net' uses the scramble-display npm package directly (custom-element wrapped
 *     around cubing/twisty) via a lazy import inside SkewbNetPreview — 1:1 with Vite's
 *     <CubingPreview event="skewb" /> delegation. Distinct from skewb 'wca' which is
 *     our tnoodle port (WCA color configuration).
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Download, RotateCcw, Plus, Trash2 } from 'lucide-react';
import {
  renderCubeSVG,
  Masking,
  Axis,
  type ICubeOptions,
} from '@cuberoot/visualcube';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import CubeVirtualKeyboard from '@/components/CubeVirtualKeyboard';
import { PuzzleSVG, type PuzzleKind } from '@/components/PuzzleSVG';
import { invertAlg } from '@/lib/cube3';
import InteractiveCubeNet, {
  type PaintColor,
} from '@/app/[lang]/scramble/solver/_InteractiveCubeNet';
import { SOLVED_FACELET } from '@/app/[lang]/scramble/solver/facelet';
import {
  renderSq1ScrambleSvg,
  DEFAULT_SQ1_COLORS,
  invertSq1Alg,
} from '@/app/[lang]/scramble/gen/_svg/sq1_svg';
import {
  renderMegaScrambleSvg,
  DEFAULT_MEGA_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import {
  renderPyraScrambleSvg,
  PYRA_DEFAULT_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import {
  renderSkewbScrambleSvg,
  SKEWB_DEFAULT_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { renderUnfoldedSvg } from '@/app/[lang]/scramble/gen/_svg/cube_unfolded_svg';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

// ── Constants ────────────────────────────────────────────────────────────────

const FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
type FaceKey = (typeof FACE_LIST)[number];

const FACE_DEFAULTS: Record<FaceKey, string> = {
  U: '#fefe00',
  R: '#00d800',
  F: '#ee0000',
  D: '#ffffff',
  L: '#0000f2',
  B: '#ffa100',
};

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
  { value: Masking.TEC_FR, label: 'TEC FR' },
  { value: Masking.TEC_FL, label: 'TEC FL' },
  { value: Masking.TEC_BL, label: 'TEC BL' },
  { value: Masking.TEC_BR, label: 'TEC BR' },
  { value: Masking.PAIR, label: 'Pair' },
  { value: Masking.EO_ORBIT, label: 'EO orbit' },
  { value: Masking.EO_OUTER_ORBIT, label: 'EO outer orbit' },
  { value: Masking.EOLRB_R, label: 'EOLRb R' },
  { value: Masking.EOLRB_L, label: 'EOLRb L' },
  { value: Masking.EOLRB_F, label: 'EOLRb F' },
  { value: Masking.EOLRB_B, label: 'EOLRb B' },
  { value: Masking.FB, label: 'Roux FB' },
  { value: Masking.SB, label: 'Roux SB' },
  { value: Masking.FB1, label: 'Roux FB1' },
  { value: Masking.FB2, label: 'Roux FB2' },
  { value: Masking.SB1, label: 'Roux SB1' },
  { value: Masking.SB2, label: 'Roux SB2' },
  { value: Masking.ROUX_CO, label: 'Roux CO' },
  { value: Masking.ROUX_DR, label: 'Roux DR' },
  { value: Masking.ROUX_DR_ONLY, label: 'Roux DR-only' },
  { value: Masking.TWO_TWO_TWO_FL, label: '2x2x2 FL' },
  { value: Masking.TWO_TWO_TWO_BL, label: '2x2x2 BL' },
  { value: Masking.TWO_TWO_TWO_BR, label: '2x2x2 BR' },
  { value: Masking.SQ_RDF, label: 'SQ RDF' },
  { value: Masking.SQ_FDR, label: 'SQ FDR' },
  { value: Masking.SQ_DFR, label: 'SQ DFR' },
  { value: Masking.DR, label: 'DR' },
  { value: Masking.DR_R, label: 'DR R' },
  { value: Masking.DR_R_U2_RP, label: "DR R U2 R'" },
  { value: Masking.DR_R_U_RP, label: "DR R U R'" },
  { value: Masking.DR_R_UP_RP, label: "DR R U' R'" },
  { value: Masking.DR_U, label: 'DR U' },
  { value: Masking.MEHTA_SQ, label: 'Mehta Sq' },
  { value: Masking.MEHTA_BELT2, label: 'Mehta Belt2' },
  { value: Masking.MEHTA_EOLE2, label: 'Mehta EOLE2' },
  { value: Masking.MEHTA_TDR, label: 'Mehta TDR' },
  { value: Masking.EOLS, label: 'EOLS' },
  { value: Masking.L5EF, label: 'L5EF' },
  { value: Masking.OLLCP, label: 'OLLCP' },
  { value: Masking.CLL_FULL, label: 'CLL (full)' },
];

const SIZE2_MASKS: { value: string; label: string }[] = [
  { value: Masking.FF, label: 'FF (First Face)' },
];

const SIZE4_MASKS: { value: string; label: string }[] = [
  { value: Masking.F1C, label: 'F1C' },
  { value: Masking.F2C, label: 'F2C' },
  { value: Masking.L2C, label: 'L2C' },
  { value: Masking.CENTER, label: 'Center' },
  { value: Masking.F1E, label: 'F1E' },
  { value: Masking.LCE, label: 'LCE' },
  { value: Masking.NO_CORNER, label: 'No Corner' },
  { value: Masking.HOYA, label: 'Hoya' },
  { value: Masking.YAU, label: 'Yau' },
  { value: Masking.MEYER, label: 'Meyer' },
  { value: Masking.HALF_CENTER, label: 'Half Center' },
];

const SIZE5_MASKS: { value: string; label: string }[] = [
  { value: Masking.ONE_BY_THREE, label: '1x3' },
  { value: Masking.TWO_BY_THREE, label: '2x3' },
  { value: Masking.THREE_BY_THREE, label: '3x3' },
  { value: Masking.TWO_BY_TWO, label: '2x2' },
  { value: Masking.T, label: 'T' },
  { value: Masking.L2C, label: 'L2C' },
  { value: Masking.L2E, label: 'L2E' },
  { value: Masking.L1E, label: 'L1E' },
  { value: Masking.CENTER, label: 'Center' },
  { value: Masking.MIDGE, label: 'Midge' },
  { value: Masking.T_CENTER, label: 'T Center' },
  { value: Masking.X_CENTER, label: 'X Center' },
  { value: Masking.WING, label: 'Wing' },
];

const SIZE6_MASKS: { value: string; label: string }[] = [
  { value: Masking.ONE_BY_FOUR, label: '1x4' },
  { value: Masking.TWO_BY_FOUR, label: '2x4' },
  { value: Masking.THREE_BY_FOUR, label: '3x4' },
  { value: Masking.FOUR_BY_FOUR, label: '4x4' },
  { value: Masking.TWO_BY_TWO, label: '2x2' },
  { value: Masking.THREE_BY_THREE, label: '3x3' },
  { value: Masking.T, label: 'T' },
  { value: Masking.THREE_ONE_BY_FOUR, label: '3+1x4' },
  { value: Masking.L2C, label: 'L2C' },
  { value: Masking.L2E, label: 'L2E' },
  { value: Masking.L1E, label: 'L1E' },
  { value: Masking.OBLIQUE, label: 'Oblique' },
  { value: Masking.CENTER, label: 'Center' },
];

const SIZE7_MASKS: { value: string; label: string }[] = [
  { value: Masking.ONE_BY_FIVE, label: '1x5' },
  { value: Masking.TWO_BY_FIVE, label: '2x5' },
  { value: Masking.THREE_BY_FIVE, label: '3x5' },
  { value: Masking.FOUR_BY_FIVE, label: '4x5' },
  { value: Masking.FIVE_BY_FIVE, label: '5x5' },
  { value: Masking.TWO_BY_TWO, label: '2x2' },
  { value: Masking.THREE_BY_THREE, label: '3x3' },
  { value: Masking.FOUR_BY_FOUR, label: '4x4' },
  { value: Masking.L2C, label: 'L2C' },
  { value: Masking.L2E, label: 'L2E' },
  { value: Masking.L1E, label: 'L1E' },
  { value: Masking.CENTER, label: 'Center' },
];

const SIZE9_MASKS: { value: string; label: string }[] = [
  { value: Masking.UB, label: 'UB' },
];

const MASK_ROTATIONS = ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];

// ── State ────────────────────────────────────────────────────────────────────

type AlgType = 'alg' | 'case';
type SpecialView = 'normal' | 'plan' | 'trans' | 'net' | 'wca';
type PuzzleType = 'cube' | 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';
type PuzzleVariant = 'iso' | 'net' | 'top' | 'wca';

function srKindOf(type: PuzzleType, variant: PuzzleVariant): PuzzleKind | null {
  if (type === 'cube') return null;
  if (variant === 'net' || variant === 'wca') return null;
  if (type === 'sq1') return 'sq1';
  if (type === 'megaminx') return variant === 'top' ? 'megaminx-top' : 'megaminx';
  if (type === 'pyraminx') return 'pyraminx';
  if (type === 'skewb') return variant === 'top' ? 'skewb-top' : 'skewb';
  return null;
}

/**
 * Skewb 'net' uses cubing.js scramble-display unfolded view (NOT WCA color
 * scheme — that's what 'wca' is for). 1:1 with Vite's <CubingPreview event="skewb" />
 * branch. scramble-display is a thin <scramble-display> custom-element wrapper
 * around cubing/twisty; importing it side-effect registers the element via
 * customElements.define, so we lazy-import inside useEffect (client-only,
 * avoids SSR + duplicate-define on Fast Refresh).
 */
function SkewbNetPreview({ scramble, pixelSize }: { scramble: string; pixelSize: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    let el: HTMLElement | null = null;
    import('scramble-display').then(() => {
      if (cancelled || !hostRef.current) return;
      el = document.createElement('scramble-display');
      el.setAttribute('event', 'skewb');
      el.setAttribute('scramble', scramble ?? '');
      el.setAttribute('visualization', '2D');
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.display = 'block';
      hostRef.current.appendChild(el);
    }).catch((err) => console.warn('[VisualCube] scramble-display load failed', err));
    return () => {
      cancelled = true;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, [scramble]);
  // Match scramble-display skewb facelet aspect (12 wide × 9 tall units). Mirror
  // the dimensions used in client/src/components/CubingPreview.tsx.
  const size = Math.max(8, Math.round(pixelSize / 12));
  return (
    <div
      ref={hostRef}
      style={{ width: size * 12, height: size * 9, display: 'block' }}
      role="img"
      aria-label="skewb net"
    />
  );
}

interface EditorState {
  puzzleType: PuzzleType;
  puzzleVariant: PuzzleVariant;
  cubeSize: number;
  imageSize: number;
  algType: AlgType;
  algorithm: string;
  arrows: string;
  defaultArrowColor: string;
  cubeView: SpecialView;
  stageMask: string;
  maskAlg: string;
  faceU: string;
  faceR: string;
  faceF: string;
  faceD: string;
  faceL: string;
  faceB: string;
  rotateAxis1: string;
  rotateAxis2: string;
  rotateAngle1: number;
  rotateAngle2: number;
  backgroundColor: string;
  cubeColor: string;
  cubeOpacity: number;
  stickerOpacity: number;
  dist: number;
  arrowFace: FaceKey;
  arrowFrom: number;
  arrowTo: number;
  arrowPass: number | null;
  arrowScale: number | null;
  arrowInfluence: number | null;
  arrowColor: string;
  paintedFacelet: string;
  netActiveColor: PaintColor;
}

const DEFAULTS: EditorState = {
  puzzleType: 'cube',
  puzzleVariant: 'iso',
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
  rotateAngle1: 30,
  rotateAngle2: -30,
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
  paintedFacelet: SOLVED_FACELET,
  netActiveColor: 'U',
};

function rotationDefaultsFor(args: { puzzleType: PuzzleType; puzzleVariant: PuzzleVariant }) {
  const { puzzleType: t, puzzleVariant: v } = args;
  if (t === 'skewb' && v === 'top') {
    return { axis1: 'y', angle1: 0, axis2: 'x', angle2: 0 };
  }
  if (t === 'sq1') {
    return { axis1: 'y', angle1: -34, axis2: 'x', angle2: -56 };
  }
  if (t === 'pyraminx') {
    return { axis1: 'y', angle1: 60, axis2: 'x', angle2: -60 };
  }
  if (t === 'skewb') {
    return { axis1: 'y', angle1: 45, axis2: 'x', angle2: 34 };
  }
  if (t === 'megaminx') {
    return { axis1: 'y', angle1: 0, axis2: 'x', angle2: 0 };
  }
  return {
    axis1: DEFAULTS.rotateAxis1, angle1: DEFAULTS.rotateAngle1,
    axis2: DEFAULTS.rotateAxis2, angle2: DEFAULTS.rotateAngle2,
  };
}

function rotationsMatchDefault(s: EditorState): boolean {
  const d = rotationDefaultsFor(s);
  return s.rotateAxis1 === d.axis1 && s.rotateAngle1 === d.angle1 &&
         s.rotateAxis2 === d.axis2 && s.rotateAngle2 === d.angle2;
}

function snapRotationOnVariantBoundary(s: EditorState, partial: Partial<EditorState>): EditorState {
  const next = { ...s, ...partial };
  if (rotationsMatchDefault(s)) {
    const d = rotationDefaultsFor(next);
    next.rotateAxis1 = d.axis1; next.rotateAngle1 = d.angle1;
    next.rotateAxis2 = d.axis2; next.rotateAngle2 = d.angle2;
  }
  return next;
}

// All query keys this page owns. `puzzle` is a read-only legacy alias for `pzl`
// (handled in readInitialFromUrl); the rest are produced by stateToParams. Every
// key is registered with nuqs so it can be both seeded and cleared on write.
const URL_KEYS = {
  pzl: parseAsString,
  puzzle: parseAsString,
  size: parseAsString,
  alg: parseAsString,
  case: parseAsString,
  arw: parseAsString,
  ac: parseAsString,
  view: parseAsString,
  stage: parseAsString,
  sch: parseAsString,
  r: parseAsString,
  bg: parseAsString,
  cc: parseAsString,
  co: parseAsString,
  fo: parseAsString,
  dist: parseAsString,
} as const;
// Keys that stateToParams can emit (excludes the read-only `puzzle` alias).
const URL_WRITE_KEYS = [
  'pzl', 'size', 'alg', 'case', 'arw', 'ac', 'view', 'stage',
  'sch', 'r', 'bg', 'cc', 'co', 'fo', 'dist',
] as const;

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
  const pzl = get('pzl') ?? get('puzzle');
  if (pzl != null) {
    const n = parseInt(pzl, 10);
    if (!isNaN(n) && String(n) === pzl.trim()) {
      s.puzzleType = 'cube';
      s.cubeSize = Math.max(1, Math.min(50, n));
    } else {
      const v = pzl.toLowerCase();
      if (v === 'cube') s.puzzleType = 'cube';
      else if (v === 'sq1') s.puzzleType = 'sq1';
      else if (v === 'mega' || v === 'megaminx') s.puzzleType = 'megaminx';
      else if (v === 'pyra' || v === 'pyraminx') s.puzzleType = 'pyraminx';
      else if (v === 'skewb') s.puzzleType = 'skewb';
    }
  }
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

  const view = get('view');
  if (view) {
    if (s.puzzleType === 'cube') {
      if (view === 'plan' || view === 'trans' || view === 'net' || view === 'wca') s.cubeView = view;
    } else if (view === 'iso' || view === 'top' || view === 'wca' || view === 'net') {
      s.puzzleVariant = view;
    }
  }

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

  const rotDef = rotationDefaultsFor(s);
  s.rotateAxis1 = rotDef.axis1; s.rotateAngle1 = rotDef.angle1;
  s.rotateAxis2 = rotDef.axis2; s.rotateAngle2 = rotDef.angle2;

  const r = get('r');
  if (r) {
    const matches = [...r.matchAll(/([xy])(-?\d{1,3})/g)];
    if (matches[0]) { s.rotateAxis1 = matches[0][1]; s.rotateAngle1 = parseInt(matches[0][2], 10); }
    if (matches[1]) { s.rotateAxis2 = matches[1][1]; s.rotateAngle2 = parseInt(matches[1][2], 10); }
  }

  if (get('bg') != null) s.backgroundColor = get('bg') ?? '';
  if (get('cc') != null) s.cubeColor = get('cc') ?? DEFAULTS.cubeColor;
  s.cubeOpacity = num('co', DEFAULTS.cubeOpacity, 0, 100);
  s.stickerOpacity = num('fo', DEFAULTS.stickerOpacity, 0, 100);
  s.dist = num('dist', DEFAULTS.dist, 1, 100);
  return s;
}

function pzlShort(t: EditorState['puzzleType']): string {
  if (t === 'megaminx') return 'mega';
  if (t === 'pyraminx') return 'pyra';
  return t;
}

function stateToParams(s: EditorState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.puzzleType !== 'cube') p.set('pzl', pzlShort(s.puzzleType));
  else p.set('pzl', String(s.cubeSize));
  if (s.imageSize !== DEFAULTS.imageSize) p.set('size', String(s.imageSize));
  if (s.algorithm) p.set(s.algType, s.algorithm);
  if (s.arrows) p.set('arw', s.arrows);
  if (s.defaultArrowColor) p.set('ac', s.defaultArrowColor);
  if (s.puzzleType === 'cube') {
    if (s.cubeView !== 'normal') p.set('view', s.cubeView);
  } else if (s.puzzleVariant !== DEFAULTS.puzzleVariant) {
    p.set('view', s.puzzleVariant);
  }
  if (s.stageMask) {
    p.set('stage', s.maskAlg ? `${s.stageMask}-${s.maskAlg}` : s.stageMask);
  }
  const schDifferent =
    s.faceU !== FACE_DEFAULTS.U || s.faceR !== FACE_DEFAULTS.R ||
    s.faceF !== FACE_DEFAULTS.F || s.faceD !== FACE_DEFAULTS.D ||
    s.faceL !== FACE_DEFAULTS.L || s.faceB !== FACE_DEFAULTS.B;
  if (schDifferent) {
    p.set('sch', [s.faceU, s.faceR, s.faceF, s.faceD, s.faceL, s.faceB].join(','));
  }
  if (!rotationsMatchDefault(s)) {
    p.set('r', `${s.rotateAxis1}${s.rotateAngle1}${s.rotateAxis2}${s.rotateAngle2}`);
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

  if (s.cubeView === 'plan') opts.view = 'plan';
  if (s.cubeView === 'trans') {
    if (s.cubeColor === DEFAULTS.cubeColor) opts.cubeColor = 'silver';
    if (s.cubeOpacity === DEFAULTS.cubeOpacity) opts.cubeOpacity = 50;
    opts.maskColor = 'transparent';
  }

  if (s.stageMask) opts.mask = s.stageMask as Masking;
  if (s.maskAlg) opts.maskAlg = s.maskAlg;

  const schDiff =
    s.faceU !== FACE_DEFAULTS.U || s.faceR !== FACE_DEFAULTS.R ||
    s.faceF !== FACE_DEFAULTS.F || s.faceD !== FACE_DEFAULTS.D ||
    s.faceL !== FACE_DEFAULTS.L || s.faceB !== FACE_DEFAULTS.B;
  if (schDiff) {
    opts.colorScheme = {
      0: s.faceU, 1: s.faceR, 2: s.faceF, 3: s.faceD, 4: s.faceL, 5: s.faceB,
    };
  }

  const axisEnum = (a: string): Axis => (a === 'x' ? Axis.X : a === 'y' ? Axis.Y : Axis.Z);
  if (!rotationsMatchDefault(s)) {
    opts.viewportRotations = [
      [axisEnum(s.rotateAxis1), s.rotateAngle1],
      [axisEnum(s.rotateAxis2), s.rotateAngle2],
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

function VisualCubeEditorPageInner() {
  const { i18n } = useTranslation();
  useDocumentTitle('魔方可视化', 'VisualCube');
  const t = useT();

  // nuqs owns every URL key this page reads/writes (history: 'replace').
  const [urlParams, setUrlParams] = useQueryStates(URL_KEYS, { history: 'replace', scroll: false });

  // Rebuild a URLSearchParams from the current nuqs values — feeds the unchanged
  // readInitialFromUrl / stateToParams comparison logic below.
  const paramsToSearch = useCallback((p: typeof urlParams): URLSearchParams => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v != null) sp.set(k, v);
    return sp;
  }, []);

  // Seed once from URL — afterwards URL is a derived view of state.
  const initialRef = useRef<EditorState | null>(null);
  if (initialRef.current === null) {
    initialRef.current = readInitialFromUrl(paramsToSearch(urlParams));
  }
  const [state, setState] = useState<EditorState>(initialRef.current);

  const set = useCallback(<K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Drag-to-rotate
  const dragRef = useRef<{
    startX: number; startY: number;
    startYAngle: number; startXAngle: number;
    yslot: 1 | 2 | null; xslot: 1 | 2 | null;
    rafId: number | null; pendingDx: number; pendingDy: number;
    dxSign: 1 | -1; dySign: 1 | -1; xMin: number; xMax: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wrapAngle = (n: number) => {
    const r = ((Math.round(n) + 180) % 360 + 360) % 360 - 180;
    return r === -180 ? 180 : r;
  };
  const onPreviewPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const findSlot = (axis: 'x' | 'y'): 1 | 2 | null => {
      if (state.rotateAxis1 === axis) return 1;
      if (state.rotateAxis2 === axis) return 2;
      return null;
    };
    const yslot = findSlot('y');
    const xslot = findSlot('x');
    if (yslot === null && xslot === null) return;
    const angleAt = (slot: 1 | 2) =>
      slot === 1 ? state.rotateAngle1 : state.rotateAngle2;
    const isSrPuzzlegen = state.puzzleType !== 'cube'
      && !(state.puzzleType === 'skewb' && state.puzzleVariant === 'top');
    const defs = rotationDefaultsFor(state);
    const defaultAt = (slot: 1 | 2) =>
      slot === 1 ? defs.angle1 : defs.angle2;
    const xDefault = xslot ? defaultAt(xslot) : 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startYAngle: yslot ? angleAt(yslot) : 0,
      startXAngle: xslot ? angleAt(xslot) : 0,
      yslot, xslot, rafId: null, pendingDx: 0, pendingDy: 0,
      dxSign: isSrPuzzlegen ? 1 : -1,
      dySign: isSrPuzzlegen ? 1 : -1,
      xMin: xDefault - 45, xMax: xDefault + 45,
    };
    setIsDragging(true);
  }, [state]);
  const onPreviewPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    d.pendingDx = e.clientX - d.startX;
    d.pendingDy = e.clientY - d.startY;
    if (d.rafId !== null) return;
    d.rafId = requestAnimationFrame(() => {
      const cur = dragRef.current;
      if (!cur) return;
      cur.rafId = null;
      setState((prev) => {
        const next = { ...prev };
        if (cur.yslot) {
          const v = wrapAngle(cur.startYAngle + cur.dxSign * cur.pendingDx * 0.5);
          if (cur.yslot === 1) next.rotateAngle1 = v;
          else next.rotateAngle2 = v;
        }
        if (cur.xslot) {
          const raw = cur.startXAngle + cur.dySign * cur.pendingDy * 0.5;
          const v = Math.max(cur.xMin, Math.min(cur.xMax, Math.round(raw)));
          if (cur.xslot === 1) next.rotateAngle1 = v;
          else next.rotateAngle2 = v;
        }
        return next;
      });
    });
  }, []);
  const onPreviewPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.rafId !== null) cancelAnimationFrame(d.rafId);
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  }, []);
  const dragHandlers = {
    onPointerDown: onPreviewPointerDown,
    onPointerMove: onPreviewPointerMove,
    onPointerUp: onPreviewPointerUp,
    onPointerCancel: onPreviewPointerUp,
  };

  // Sync state → URL (replace). Build the full owned-key patch (value or null to
  // delete) from stateToParams, then compare against the live nuqs snapshot to
  // avoid a no-op write. Note: nuqs manages keys individually and may order them
  // differently from stateToParams' custom order — share/API URLs are still built
  // from stateToParams directly, so only the address-bar key order can differ.
  useEffect(() => {
    const sp = stateToParams(state);
    const patch: Record<string, string | null> = {};
    let changed = false;
    for (const k of URL_WRITE_KEYS) {
      const nextV = sp.get(k);
      patch[k] = nextV;
      if ((urlParams[k] ?? null) !== (nextV ?? null)) changed = true;
    }
    // Normalize the read-only `puzzle` alias away once a write happens.
    if (urlParams.puzzle != null) { patch.puzzle = null; changed = true; }
    if (changed) void setUrlParams(patch);
  }, [state, urlParams, setUrlParams]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

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
    if (typeof window === 'undefined') return `/visualcube${qs ? '?' + qs : ''}`;
    return `${window.location.origin}/visualcube${qs ? '?' + qs : ''}`;
  }, [state]);

  const previewRef = useRef<HTMLElement | null>(null);
  const getCurrentSvg = (): string => {
    const isCubeNet = state.puzzleType === 'cube' && state.cubeView === 'net';
    const isCubeWca = state.puzzleType === 'cube' && state.cubeView === 'wca';
    const isOtherUnfolded = state.puzzleType !== 'cube'
      && (state.puzzleVariant === 'net' || state.puzzleVariant === 'wca');
    if (isCubeNet || isCubeWca || isOtherUnfolded) {
      const direct = previewRef.current?.querySelector('.vc-preview > svg');
      if (direct) return new XMLSerializer().serializeToString(direct);
      return '';
    }
    if (state.puzzleType === 'cube') return svg;
    const node = previewRef.current?.querySelector('svg');
    return node ? new XMLSerializer().serializeToString(node) : '';
  };

  const downloadSvg = () => {
    const out = getCurrentSvg();
    if (!out) return;
    const blob = new Blob([out], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.puzzleType}-${Date.now()}.svg`;
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
      canvas.width = state.imageSize;
      canvas.height = state.imageSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, state.imageSize, state.imageSize);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${state.puzzleType}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const apiUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (state.algorithm) p.set(state.algType, state.algorithm);
    if (state.puzzleType !== 'cube') {
      p.set('pzl', pzlShort(state.puzzleType));
      if (state.puzzleVariant !== DEFAULTS.puzzleVariant) p.set('view', state.puzzleVariant);
    } else {
      if (state.cubeView !== 'normal') p.set('view', state.cubeView);
      if (state.cubeSize !== DEFAULTS.cubeSize) p.set('pzl', String(state.cubeSize));
    }
    if (state.stageMask) p.set('mask', state.stageMask);
    if (state.imageSize !== DEFAULTS.imageSize) p.set('size', String(state.imageSize));
    if (state.backgroundColor) p.set('bg', state.backgroundColor);
    if (state.cubeColor !== DEFAULTS.cubeColor) p.set('cc', state.cubeColor);
    if (state.cubeOpacity !== DEFAULTS.cubeOpacity) p.set('co', String(state.cubeOpacity));
    return `https://api.cuberoot.me/v1/visualcube.svg${p.toString() ? '?' + p.toString() : ''}`;
  }, [state]);

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
      const c = state.arrowColor.startsWith('#') ? state.arrowColor.slice(1) : state.arrowColor;
      entry += `-${c}`;
    }
    set('arrows', state.arrows ? state.arrows + ',' + entry : entry);
  };

  const arrowMaxIdx = state.cubeSize * state.cubeSize - 1;

  // ── Algorithm textarea ──
  const algRef = useRef<HTMLTextAreaElement | null>(null);
  const syncAlgFromDom = useCallback(() => {
    if (algRef.current) set('algorithm', algRef.current.value);
  }, [set]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="vc-editor-page">
      <style>{INLINE_CSS}</style>

      <header className="vc-header">
        <h1>{t('VisualCube 编辑器', 'VisualCube Editor')}</h1>
        <div className="vc-header-right">
          <Link className="vc-header-link" href="/visualcube/stages">
            {t('Stage 速查', 'Stages')}
          </Link>
        </div>
      </header>

      <section className="vc-preview-wrap" ref={previewRef as React.RefObject<HTMLElement>}>
        {(() => {
          const isCubeNet = state.puzzleType === 'cube' && state.cubeView === 'net';
          const isCubeWca = state.puzzleType === 'cube' && state.cubeView === 'wca';
          const isOtherUnfolded = state.puzzleType !== 'cube'
            && (state.puzzleVariant === 'net' || state.puzzleVariant === 'wca');
          if (isCubeNet && state.cubeSize === 3) {
            return (
              <div className="vc-preview vc-preview-net-paint">
                <InteractiveCubeNet
                  facelet={state.paintedFacelet}
                  onChange={(next) => set('paintedFacelet', next)}
                  activeColor={state.netActiveColor}
                  onActiveColorChange={(c) => set('netActiveColor', c)}
                  pixelSize={state.imageSize}
                />
              </div>
            );
          }
          if (isCubeNet || isCubeWca || isOtherUnfolded) {
            // Cube net+wca: use tnoodle-port renderUnfoldedSvg (deterministic SVG string,
            // no scramble-display dep). Non-cube wca: dedicated tnoodle ports.
            if (state.puzzleType === 'cube') {
              const raw = state.algorithm ?? '';
              const forward = state.algType === 'case' ? invertAlg(raw) : raw;
              const N = Math.max(1, Math.min(50, state.cubeSize));
              const svgStr = renderUnfoldedSvg(N, forward);
              return (
                <div className="vc-preview" dangerouslySetInnerHTML={{ __html: svgStr }} />
              );
            }
            // Skewb 'net' = cubing.js scramble-display unfolded skewb (NOT WCA
            // configuration — that's the 'wca' variant which uses our tnoodle port).
            // 1:1 with Vite's <CubingPreview event="skewb" visualization="2D" />.
            if (state.puzzleType === 'skewb' && state.puzzleVariant === 'net') {
              const raw = state.algorithm ?? '';
              const forward = state.algType === 'case' ? invertAlg(raw) : raw;
              return (
                <div className="vc-preview vc-preview-cubing">
                  <SkewbNetPreview scramble={forward} pixelSize={state.imageSize} />
                </div>
              );
            }
            // Non-cube wca.
            const raw = state.algorithm ?? '';
            const forward = state.algType === 'case'
              ? (state.puzzleType === 'sq1' ? invertSq1Alg(raw) : invertAlg(raw))
              : raw;
            const svgStr = state.puzzleType === 'sq1'
              ? renderSq1ScrambleSvg(forward, DEFAULT_SQ1_COLORS)
              : state.puzzleType === 'megaminx'
              ? renderMegaScrambleSvg(forward, DEFAULT_MEGA_COLORS)
              : state.puzzleType === 'pyraminx'
              ? renderPyraScrambleSvg(forward, PYRA_DEFAULT_COLORS)
              : renderSkewbScrambleSvg(forward, SKEWB_DEFAULT_COLORS);
            return (
              <div className="vc-preview" dangerouslySetInnerHTML={{ __html: svgStr }} />
            );
          }
          if (state.puzzleType === 'cube') {
            return (
              <div
                className={`vc-preview vc-preview-draggable${isDragging ? ' dragging' : ''}`}
                {...dragHandlers}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            );
          }
          const srKind = srKindOf(state.puzzleType, state.puzzleVariant)!;
          const rotSupported = state.puzzleVariant !== 'net';
          const srPuzzleAxis = (axis: string): string =>
            (state.puzzleType === 'sq1' || state.puzzleType === 'pyraminx') && axis === 'y'
              ? 'z' : axis;
          const rotations = rotSupported && !rotationsMatchDefault(state) ? [
            { [srPuzzleAxis(state.rotateAxis1)]: state.rotateAngle1 },
            { [srPuzzleAxis(state.rotateAxis2)]: state.rotateAngle2 },
          ] as { x?: number; y?: number; z?: number }[] : undefined;
          return (
            <div
              className={`vc-preview${rotSupported ? ` vc-preview-draggable${isDragging ? ' dragging' : ''}` : ''}`}
              {...(rotSupported ? dragHandlers : {})}
            >
              <PuzzleSVG
                kind={srKind}
                alg={state.algType === 'alg' ? state.algorithm : undefined}
                case={state.algType === 'case' ? state.algorithm : undefined}
                size={state.imageSize}
                rotations={rotations}
              />
            </div>
          );
        })()}
      </section>

      <section className="vc-exports">
        <CopyButton label={t('分享链接', 'Share URL')} getValue={() => shareUrl} />
        <CopyButton label={t('API 链接', 'API URL')} getValue={() => apiUrl} />
        <button type="button" className="vc-btn" onClick={downloadSvg}>
          <Download size={14} /> SVG
        </button>
        <button type="button" className="vc-btn" onClick={downloadPng}>
          <Download size={14} /> PNG
        </button>
        <CopyButton
          label={t('<img> 标签', '<img> tag')}
          getValue={() => `<img src="${apiUrl}" alt="cube" width="${state.imageSize}" height="${state.imageSize}" />`}
        />
        <CopyButton
          label="Markdown"
          getValue={() => `![cube](${apiUrl})`}
        />
      </section>

      <section className="vc-controls">
        <div className="vc-row">
          <label className="vc-label">{t('魔方', 'Puzzle')}</label>
          <div className="vc-row-controls">
            {(['cube', 'sq1', 'megaminx', 'pyraminx', 'skewb'] as PuzzleType[]).map((pt) => (
              <button
                key={pt}
                type="button"
                className={`vc-btn vc-btn-sm${state.puzzleType === pt ? ' vc-btn-active' : ''}`}
                onClick={() => setState((s) => {
                  const next = { ...s, puzzleType: pt };
                  const d = rotationDefaultsFor(next);
                  next.rotateAxis1 = d.axis1; next.rotateAngle1 = d.angle1;
                  next.rotateAxis2 = d.axis2; next.rotateAngle2 = d.angle2;
                  return next;
                })}
              >
                {pt === 'cube' ? 'NxN' : pt === 'sq1' ? 'Sq1' : pt === 'megaminx' ? 'Mega' : pt === 'pyraminx' ? 'Pyra' : 'Skewb'}
              </button>
            ))}
          </div>
        </div>

        <div className="vc-row">
          <label className="vc-label">{t('视图', 'View')}</label>
          <div className="vc-row-controls">
            {state.puzzleType === 'cube' ? (
              (['normal', 'plan', 'trans', 'net', 'wca'] as SpecialView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`vc-btn vc-btn-sm${state.cubeView === v ? ' vc-btn-active' : ''}`}
                  onClick={() => set('cubeView', v)}
                >
                  {v}
                </button>
              ))
            ) : (
              ((): PuzzleVariant[] => {
                // skewb 多出独立的 cubing.js Net(不是 WCA 配色);其余几个的 Net 已 rename 为 WCA。
                if (state.puzzleType === 'skewb') return ['iso', 'top', 'net', 'wca'];
                if (state.puzzleType === 'megaminx') return ['iso', 'top', 'wca'];
                return ['iso', 'wca'];
              })().map((pv) => (
                <button
                  key={pv}
                  type="button"
                  className={`vc-btn vc-btn-sm${state.puzzleVariant === pv ? ' vc-btn-active' : ''}`}
                  onClick={() => setState((s) => snapRotationOnVariantBoundary(s, { puzzleVariant: pv }))}
                >
                  {pv === 'iso' ? tr({ zh: '立体', en: 'iso'
                                      })
                    : pv === 'top' ? tr({ zh: '顶视', en: 'top'
                                              })
                    : pv === 'wca' ? 'wca'
                    : tr({ zh: '展开', en: 'net'
                                                      })}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="vc-row">
          {state.puzzleType === 'cube' && (
            <>
              <label className="vc-label">{t('阶数', 'NxN Size')}</label>
              <input
                type="number"
                className="vc-num"
                value={state.cubeSize} min={1} max={50}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) set('cubeSize', Math.max(1, Math.min(50, n)));
                }}
              />
            </>
          )}
          <label className={`vc-label${state.puzzleType === 'cube' ? ' vc-label-secondary' : ''}`}>{t('图片尺寸 (px)', 'Image Size (px)')}</label>
          <select
            className="vc-select"
            value={state.imageSize}
            onChange={(e) => set('imageSize', parseInt(e.target.value, 10))}
          >
            {[64, 88, 128, 256, 512, 1000].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

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
            <div className="vc-row-controls">
              <textarea
                ref={algRef}
                className="vc-text vc-textarea"
                rows={2}
                defaultValue={state.algorithm}
                placeholder=""
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

        {state.puzzleType === 'cube' && state.cubeView !== 'net' && state.cubeView !== 'wca' && (
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
        )}

        {state.puzzleType === 'cube' && (
          <>
            {state.cubeView !== 'net' && state.cubeView !== 'wca' && (
            <div className="vc-row">
              <label className="vc-label">{t('Mask', 'Stage Mask')}</label>
              <div className="vc-row-controls">
                <select className="vc-select" value={state.stageMask}
                  onChange={(e) => set('stageMask', e.target.value)}>
                  <optgroup label="Core">
                    {CORE_MASKS.map((m) => <option key={m.value || 'none'} value={m.value}>{m.label}</option>)}
                  </optgroup>
                  {state.cubeSize === 2 && (
                    <optgroup label="2x2">
                      {SIZE2_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  )}
                  {state.cubeSize === 3 && (
                    <optgroup label="Extended (3x3)">
                      {EXTENDED_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  )}
                  {state.cubeSize === 4 && (
                    <optgroup label="4x4">
                      {SIZE4_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  )}
                  {state.cubeSize === 5 && (
                    <optgroup label="5x5">
                      {SIZE5_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  )}
                  {state.cubeSize === 6 && (
                    <optgroup label="6x6">
                      {SIZE6_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  )}
                  {state.cubeSize === 7 && (
                    <optgroup label="7x7">
                      {SIZE7_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  )}
                  {state.cubeSize === 9 && (
                    <optgroup label="9x9">
                      {SIZE9_MASKS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  )}
                </select>
                <select className="vc-select" value={state.maskAlg}
                  onChange={(e) => set('maskAlg', e.target.value)}>
                  {MASK_ROTATIONS.map((r) => (
                    <option key={r || 'none'} value={r}>{r || '— rot —'}</option>
                  ))}
                </select>
              </div>
            </div>
            )}
          </>
        )}

        {state.puzzleType === 'cube' && state.cubeView !== 'net' && state.cubeView !== 'wca' && (
        <div className="vc-row vc-row-block">
          <label className="vc-label">{t('六面配色', 'Color Schemes')}</label>
          <div className="vc-row-controls vc-col">
            <div className="vc-keyrow">
              <button type="button" className="vc-btn-sm" onClick={() => {
                setState((p) => ({ ...p, faceU: p.faceB, faceF: p.faceU, faceD: p.faceF, faceB: p.faceD }));
              }}>x</button>
              <button type="button" className="vc-btn-sm" onClick={() => {
                setState((p) => ({ ...p, faceF: p.faceR, faceR: p.faceB, faceB: p.faceL, faceL: p.faceF }));
              }}>y</button>
              <button type="button" className="vc-btn-sm" onClick={() => {
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
        )}

        {(
          (state.puzzleType === 'cube' && state.cubeView !== 'net' && state.cubeView !== 'wca') ||
          (state.puzzleType !== 'cube' && state.puzzleVariant !== 'net' && state.puzzleVariant !== 'wca')
        ) && (
        <div className="vc-row vc-row-block">
          <label className="vc-label">{t('视角旋转', 'Rotation Sequence')}</label>
          <div className="vc-row-controls vc-col">
            {([1, 2] as const).map((i) => {
              const axisKey = `rotateAxis${i}` as 'rotateAxis1' | 'rotateAxis2';
              const angleKey = `rotateAngle${i}` as 'rotateAngle1' | 'rotateAngle2';
              return (
                <div key={i} className="vc-row-controls">
                  <select className="vc-select-sm" value={state[axisKey]}
                    onChange={(e) => set(axisKey, e.target.value)}>
                    {['x', 'y'].map((a) => <option key={a} value={a}>{a}</option>)}
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
                      const d = rotationDefaultsFor(state);
                      const axisVal = i === 1 ? d.axis1 : d.axis2;
                      const angleVal = i === 1 ? d.angle1 : d.angle2;
                      set(axisKey, axisVal as never);
                      set(angleKey, angleVal as never);
                    }}>
                    <RotateCcw size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        )}

        <ColorRow
          label={t('背景色', 'Background Color')}
          value={state.backgroundColor}
          onChange={(v) => set('backgroundColor', v)}
          onReset={() => set('backgroundColor', '')}
          allowEmpty
        />
        {state.puzzleType === 'cube' && state.cubeView !== 'net' && state.cubeView !== 'wca' && (
          <>
            <ColorRow
              label={t('壳体色', 'Cube Color')}
              value={state.cubeColor}
              onChange={(v) => set('cubeColor', v)}
              onReset={() => set('cubeColor', DEFAULTS.cubeColor)}
            />
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
          </>
        )}
      </section>

      <details className="vc-api-doc">
        <summary>{t('API 用法（外部嵌入）', 'API usage (embed elsewhere)')}</summary>
        <p>
          {t(
            '直接通过 GET /v1/visualcube.svg 拿到 SVG 字节流，可放进 <img>、curl、博客 Markdown 等。这是简化端点（7 个参数），完整参数请用本页生成后复制分享链接。',
            'GET /v1/visualcube.svg returns image/svg+xml directly. Use it in an <img>, curl, blog Markdown, etc. This is a simplified endpoint (7 params); for the full set, use this page and copy the share URL.'
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
            'Endpoint does not accept the full PHP query API (no arw / ac / sch / fc / fd). For those, generate via this page and download/copy.'
          )}
        </p>
      </details>
    </div>
  );
}

export default function VisualCubeEditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <VisualCubeEditorPageInner />
    </Suspense>
  );
}

const FACE_DEFAULTS_STATE = {
  faceU: FACE_DEFAULTS.U, faceR: FACE_DEFAULTS.R, faceF: FACE_DEFAULTS.F,
  faceD: FACE_DEFAULTS.D, faceL: FACE_DEFAULTS.L, faceB: FACE_DEFAULTS.B,
};

const INLINE_CSS = `
.vc-editor-page {
  --vc-bg: var(--background);
  --vc-panel: var(--card);
  --vc-input: color-mix(in srgb, var(--foreground) 5%, transparent);
  --vc-hover: color-mix(in srgb, var(--foreground) 8%, transparent);
  --vc-text: var(--foreground);
  --vc-text-dim: var(--muted-foreground);
  --vc-accent: var(--accent);
  --vc-divider: var(--border-default);

  max-width: 960px; margin: 0 auto; padding: 16px;
  background: var(--vc-bg); color: var(--vc-text);
}
.vc-header {
  padding: 4px 0 14px; margin-bottom: 12px;
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
}
.vc-header h1 { margin: 0; font-size: 18px; font-weight: 500; color: var(--vc-text); letter-spacing: 0.3px; }
.vc-header-right { display: flex; align-items: center; gap: 12px; }
.vc-header-link {
  color: var(--signal-info); text-decoration: none; font-size: 13px;
  padding: 4px 10px; border: 1px solid var(--vc-divider); border-radius: 6px;
}
.vc-header-link:hover { background: var(--vc-hover); }

.vc-preview-wrap {
  position: sticky; top: 0; z-index: 5;
  display: flex; justify-content: center; align-items: center;
  padding: calc(24px + var(--sat, 0px)) max(24px, var(--sar, 0px)) 24px max(24px, var(--sal, 0px));
  background: var(--vc-input); border-radius: 4px;
  max-height: 45vh;
}
.vc-preview {
  display: inline-block;
  background: repeating-conic-gradient(color-mix(in srgb, var(--foreground) 3%, transparent) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
  max-width: 100%; max-height: 100%;
  overflow: hidden;
}
.vc-preview svg { display: block; max-width: 100%; max-height: calc(45vh - 48px); width: auto; height: auto; }
.vc-preview-draggable { cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.vc-preview-draggable.dragging { cursor: grabbing; }
.vc-preview-draggable svg { pointer-events: none; }

.vc-exports { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 18px; }

.vc-controls { display: flex; flex-direction: column; }
.vc-row {
  display: flex; gap: 14px; align-items: center; padding: 10px 0;
}
.vc-row-block { align-items: flex-start; }
.vc-row-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1 1 auto; min-width: 0; }
.vc-col { flex-direction: column; align-items: stretch; gap: 8px; }
.vc-label {
  flex: 0 0 auto; min-width: 100px;
  font-size: 12px; font-weight: 500; color: var(--vc-text-dim);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.vc-label-secondary { min-width: 0; padding-left: 16px; }

.vc-num, .vc-text, .vc-num-sm, .vc-color-text, .vc-select, .vc-select-sm {
  background: var(--vc-input); color: var(--vc-text);
  border: 1px solid transparent; border-radius: 3px;
  padding: 6px 9px; font-size: 13px; font-family: inherit;
  outline: none;
}
.vc-num { width: 72px; }
.vc-num-sm { width: 56px; padding: 4px 7px; font-size: 12px; }
.vc-text { flex: 1; min-width: 0; font-family: var(--font-mono, monospace); }
.vc-textarea { resize: vertical; min-height: 36px; }
.vc-color-text { width: 96px; font-size: 12px; font-family: var(--font-mono, monospace); }
.vc-select-sm { width: 56px; padding: 4px 7px; font-size: 12px; }
.vc-num:focus, .vc-text:focus, .vc-num-sm:focus, .vc-color-text:focus,
.vc-select:focus, .vc-select-sm:focus {
  border-color: var(--vc-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}

.vc-range { flex: 1; min-width: 120px; height: 18px; -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
.vc-range::-webkit-slider-runnable-track { height: 4px; background: var(--vc-input); border-radius: 2px; }
.vc-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--vc-accent); margin-top: -5px; cursor: pointer; }
.vc-range::-moz-range-track { height: 4px; background: var(--vc-input); border-radius: 2px; border: none; }
.vc-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--vc-accent); border: none; cursor: pointer; }

.vc-color, .vc-color-sm {
  padding: 0; border: none; border-radius: 3px; cursor: pointer; background: transparent;
}
.vc-color { width: 44px; height: 26px; }
.vc-color-sm { width: 34px; height: 22px; }
.vc-color::-webkit-color-swatch-wrapper, .vc-color-sm::-webkit-color-swatch-wrapper { padding: 0; }
.vc-color::-webkit-color-swatch, .vc-color-sm::-webkit-color-swatch { border: none; border-radius: 3px; }
.vc-color::-moz-color-swatch, .vc-color-sm::-moz-color-swatch { border: none; border-radius: 3px; }

.vc-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px;
  background: var(--vc-panel); color: var(--vc-text);
  border: none; border-radius: 3px;
  font-size: 12px; cursor: pointer; transition: background 0.12s;
  font-family: inherit;
}
.vc-btn:hover { background: var(--vc-hover); }
.vc-btn:active { background: color-mix(in srgb, var(--foreground) 12%, transparent); }
.vc-btn-sm { padding: 5px 9px; font-size: 11px; }
.vc-btn-active { background: var(--vc-accent); color: var(--accent-foreground); }
.vc-btn-active:hover { background: var(--vc-accent); filter: brightness(1.1); }
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

.vc-keyrow { display: flex; flex-wrap: wrap; gap: 3px; }

.vc-arrow-builder {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px;
  background: var(--vc-input); padding: 10px 12px; border-radius: 4px;
  color: var(--vc-text-dim);
}
.vc-arrow-builder > span { color: var(--vc-text-dim); margin-right: -2px; }

.vc-face-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.vc-face-cell {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-size: 11px; color: var(--vc-text-dim); padding: 6px; background: var(--vc-input); border-radius: 3px;
}
.vc-face-cell input[type=color] { width: 100%; height: 24px; padding: 0; border: none; border-radius: 2px; cursor: pointer; background: transparent; }
.vc-face-cell input[type=color]::-webkit-color-swatch { border: none; border-radius: 2px; }
.vc-face-cell input[type=color]::-moz-color-swatch { border: none; border-radius: 2px; }

.vc-api-doc {
  margin-top: 24px; padding: 14px 16px;
  background: var(--vc-input); border-radius: 4px;
  color: var(--vc-text-dim); font-size: 13px;
}
.vc-api-doc summary {
  cursor: pointer; font-weight: 500; color: var(--vc-text); user-select: none;
  padding: 2px 0;
}
.vc-api-doc summary::-webkit-details-marker { color: var(--vc-text-dim); }
.vc-api-doc[open] summary { margin-bottom: 10px; }
.vc-api-doc p { margin: 8px 0; line-height: 1.5; }
.vc-api-example {
  background: var(--vc-input); padding: 8px 10px; border-radius: 3px;
  font-family: var(--font-mono, monospace); font-size: 11.5px;
  color: var(--vc-text); overflow-x: auto; white-space: pre;
  margin: 8px 0; word-break: break-all;
}
.vc-api-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
.vc-api-table th, .vc-api-table td {
  padding: 6px 10px; text-align: left; vertical-align: top;
  border-bottom: 1px solid var(--vc-divider);
}
.vc-api-table th { color: var(--vc-text); font-weight: 500; }
.vc-api-table td { color: var(--vc-text-dim); }
.vc-api-table code {
  background: var(--vc-input); padding: 1px 5px; border-radius: 2px;
  font-family: var(--font-mono, monospace); font-size: 11.5px; color: var(--vc-text);
}
.vc-api-note { font-size: 12px; opacity: 0.85; margin-top: 12px; }

@media (max-width: 768px) {
  .vc-row { flex-direction: column; align-items: stretch; gap: 6px; padding: 10px 0; }
  .vc-label { min-width: 0; font-size: 11px; }
  .vc-num, .vc-text, .vc-num-sm { font-size: 12px; }
  .vc-face-grid { grid-template-columns: repeat(3, 1fr); }
  .vc-preview-wrap { padding: 16px; }
  .vc-api-table { font-size: 11px; }
  .vc-api-table th, .vc-api-table td { padding: 5px 6px; }
  .vc-api-example { white-space: pre-wrap; }
}
`;
