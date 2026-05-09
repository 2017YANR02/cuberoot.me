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
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Download, RotateCcw, Plus, Trash2 } from 'lucide-react';
import {
  renderCubeSVG,
  Masking,
  Axis,
  type ICubeOptions,
} from '@cuberoot/visualcube';
import LangToggle from '../../components/LangToggle';
import CubeVirtualKeyboard from '../../components/CubeVirtualKeyboard';
import { PuzzleSVG, type PuzzleKind } from '../../components/PuzzleSVG';
import CubingPreview from '../timer/cube/CubingPreview';
import { invertAlg } from '../notation/alg_ops';

// ── Constants ────────────────────────────────────────────────────────────────

const FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
type FaceKey = (typeof FACE_LIST)[number];

// sch=ygrwbo — 黄顶红前
const FACE_DEFAULTS: Record<FaceKey, string> = {
  U: '#fefe00',
  R: '#00d800',
  F: '#ee0000',
  D: '#ffffff',
  L: '#0000f2',
  B: '#ffa100',
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
// 'net' is delegated to puzzle-gen (sr-puzzlegen) — our @cuberoot/visualcube does not render unfolded NxN.
type SpecialView = 'normal' | 'plan' | 'trans' | 'net';
type PuzzleType = 'cube' | 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';
type PuzzleVariant = 'iso' | 'net' | 'top';

/** Map (puzzleType, variant) → sr-puzzlegen kind. Cube uses our own renderer instead.
 *  Net variants are NOT routed here — they go through <CubingPreview> (cubing.js scramble-display)
 *  for visual parity with /battle and /timer. */
function srKindOf(type: PuzzleType, variant: PuzzleVariant): PuzzleKind | null {
  if (type === 'cube') return null;
  if (type === 'sq1') return 'sq1';
  if (type === 'megaminx') return variant === 'top' ? 'megaminx-top' : 'megaminx';
  if (type === 'pyraminx') return 'pyraminx';
  if (type === 'skewb') return 'skewb';
  return null;
}

/** Map a non-cube puzzle type to a scramble-display event id (for unfolded-net rendering). */
function cubingNetEventOf(type: PuzzleType): string | null {
  if (type === 'sq1') return 'sq1';
  if (type === 'megaminx') return 'minx';
  if (type === 'pyraminx') return 'pyram';
  if (type === 'skewb') return 'skewb';
  return null;
}

interface EditorState {
  /** Top-level puzzle. 'cube' uses NxN ICubeOptions path; other 4 use sr-puzzlegen. */
  puzzleType: PuzzleType;
  /** View variant for non-cube puzzles. 'iso' = 3D iso, 'net' = unfolded, 'top' = top view (megaminx only). */
  puzzleVariant: PuzzleVariant;
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
  rotateAxis3: 'z',
  rotateAngle1: 30,
  rotateAngle2: -30,
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
  const pt = get('puzzle');
  if (pt === 'sq1' || pt === 'megaminx' || pt === 'pyraminx' || pt === 'skewb' || pt === 'cube') s.puzzleType = pt;
  const pv = get('variant');
  if (pv === 'iso' || pv === 'net' || pv === 'top') s.puzzleVariant = pv;
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

  // view: 'plan' / 'trans' / 'net' / (anything else → 'normal')
  const view = get('view');
  if (view === 'plan' || view === 'trans' || view === 'net') s.cubeView = view;

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

  // r=y30x-30z0  (axis-letter then signed degrees, repeating)
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
  if (s.puzzleType !== DEFAULTS.puzzleType) p.set('puzzle', s.puzzleType);
  if (s.puzzleVariant !== DEFAULTS.puzzleVariant) p.set('variant', s.puzzleVariant);
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

  // Special view: trans is a preset (cc=silver + co=50, explicit overrides win).
  // Also drop the mask fill so masked-out stickers show the silver shell through —
  // matches PHP `view=trans` behavior (default sticker = Transparent, not Black).
  if (s.cubeView === 'plan') opts.view = 'plan';
  if (s.cubeView === 'trans') {
    if (s.cubeColor === DEFAULTS.cubeColor) opts.cubeColor = 'silver';
    if (s.cubeOpacity === DEFAULTS.cubeOpacity) opts.cubeOpacity = 50;
    opts.maskColor = 'transparent';
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

  // For non-cube puzzles the SVG is rendered into the live DOM by sr-puzzlegen
  // (we don't have a string), so download/copy serializes that node.
  const previewRef = useRef<HTMLElement | null>(null);
  const getCurrentSvg = (): string => {
    // Any net path renders via <scramble-display>, which mounts its <svg> inside a Shadow Root —
    // a plain querySelector('svg') misses it.
    const isCubeNet = state.puzzleType === 'cube' && state.cubeView === 'net';
    const isOtherNet = state.puzzleType !== 'cube' && state.puzzleVariant === 'net';
    if (isCubeNet || isOtherNet) {
      const sd = previewRef.current?.querySelector('scramble-display');
      const inShadow = sd?.shadowRoot?.querySelector('svg');
      return inShadow ? new XMLSerializer().serializeToString(inShadow) : '';
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
    // Rasterise the in-memory SVG via canvas. Encode as Blob URL (data: URLs
    // crash Safari for non-trivial SVGs); decode through HTMLImageElement;
    // draw to canvas at imageSize × imageSize; export as PNG blob.
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
    // /v1/visualcube.svg only supports a subset (alg/case/view/mask/size/bg/cc/co)
    const p = new URLSearchParams();
    if (state.algorithm) p.set(state.algType, state.algorithm);
    if (state.cubeView !== 'normal') p.set('view', state.cubeView);
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
      // Strip leading # for compactness when valid hex (the visualcube parser accepts both)
      const c = state.arrowColor.startsWith('#') ? state.arrowColor.slice(1) : state.arrowColor;
      entry += `-${c}`;
    }
    set('arrows', state.arrows ? state.arrows + ',' + entry : entry);
  };

  const arrowMaxIdx = state.cubeSize * state.cubeSize - 1;

  // ── Algorithm textarea (uncontrolled, ref-based — keyboard writes via DOM) ──
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
          <Link className="vc-header-link" to="/visualcube/stages">
            {t('Stage 速查', 'Stages')}
          </Link>
          <LangToggle variant="inline" />
        </div>
      </header>

      {/* Preview — sticky so it stays on screen while scrolling controls.
          imageSize controls the SVG file size (for download / share URL); the
          preview is visually capped via CSS max-height to keep sticky usable.
          For non-cube puzzles, render via sr-puzzlegen (PuzzleSVG) instead. */}
      <section className="vc-preview-wrap" ref={previewRef as React.RefObject<HTMLElement>}>
        {(() => {
          // Unfolded-net path (every puzzle: NxN cube + sq1 + megaminx + pyraminx + skewb)
          // delegates to <CubingPreview> (scramble-display / cubing.js) so we share one
          // renderer with /battle and /timer. scramble-display takes a FORWARD scramble,
          // so 'case' mode passes the inverse alg.
          const isCubeNet = state.puzzleType === 'cube' && state.cubeView === 'net';
          const isOtherNet = state.puzzleType !== 'cube' && state.puzzleVariant === 'net';
          if (isCubeNet || isOtherNet) {
            const event = isCubeNet
              ? (() => { const n = Math.max(2, Math.min(7, state.cubeSize)); return `${n}${n}${n}`; })()
              : cubingNetEventOf(state.puzzleType)!;
            return (
              <div className="vc-preview vc-preview-cubing">
                <CubingPreview
                  event={event}
                  scramble={state.algType === 'case' ? invertAlg(state.algorithm) : state.algorithm}
                  visualization="2D"
                  size={Math.max(8, Math.round(state.imageSize / 12))}
                  className="scramble-svg-img"
                />
              </div>
            );
          }
          if (state.puzzleType === 'cube') {
            return (
              <div
                className="vc-preview"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            );
          }
          return (
            <div className="vc-preview">
              <PuzzleSVG
                kind={srKindOf(state.puzzleType, state.puzzleVariant)!}
                alg={state.algType === 'alg' ? state.algorithm : undefined}
                case={state.algType === 'case' ? state.algorithm : undefined}
                size={state.imageSize}
              />
            </div>
          );
        })()}
      </section>

      {/* Export buttons. The simplified /v1/visualcube.svg endpoint does not yet render
          unfolded-net or non-cube puzzles server-side — for those the URL falls back to
          our 3D renderer. Buttons are shown anyway so users get shareable embeds today
          (and the same URLs Just Work once the server gains net support). */}
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

      {/* Controls */}
      <section className="vc-controls">
        {/* Puzzle picker — top-level switch between NxN cube and the 4 non-cube WCA puzzles */}
        <div className="vc-row">
          <label className="vc-label">{t('魔方', 'Puzzle')}</label>
          <div className="vc-row-controls">
            {(['cube', 'sq1', 'megaminx', 'pyraminx', 'skewb'] as PuzzleType[]).map((pt) => (
              <button
                key={pt}
                type="button"
                className={`vc-btn vc-btn-sm${state.puzzleType === pt ? ' vc-btn-active' : ''}`}
                onClick={() => set('puzzleType', pt)}
              >
                {pt === 'cube' ? 'NxN' : pt === 'sq1' ? 'Sq1' : pt === 'megaminx' ? 'Minx' : pt === 'pyraminx' ? 'Pyra' : 'Skewb'}
              </button>
            ))}
          </div>
        </div>

        {/* View variant — only relevant for non-cube puzzles */}
        {state.puzzleType !== 'cube' && (
          <div className="vc-row">
            <label className="vc-label">{t('视图', 'View')}</label>
            <div className="vc-row-controls">
              {(state.puzzleType === 'megaminx' ? (['iso', 'top', 'net'] as PuzzleVariant[]) : (['iso', 'net'] as PuzzleVariant[])).map((pv) => (
                <button
                  key={pv}
                  type="button"
                  className={`vc-btn vc-btn-sm${state.puzzleVariant === pv ? ' vc-btn-active' : ''}`}
                  onClick={() => set('puzzleVariant', pv)}
                >
                  {pv === 'iso' ? (isZh ? '立体' : 'Iso') : pv === 'top' ? (isZh ? '顶视' : 'Top') : (isZh ? '展开' : 'Net')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cube size + image size on one row. Cube size only matters for NxN. */}
        <div className="vc-row">
          {state.puzzleType === 'cube' && (
            <>
              <label className="vc-label">{t('阶数', 'NxN Size')}</label>
              <input
                type="number"
                className="vc-num"
                value={state.cubeSize} min={1} max={10}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) set('cubeSize', Math.max(1, Math.min(10, n)));
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
            <div className="vc-row-controls">
              <textarea
                ref={algRef}
                className="vc-text vc-textarea"
                rows={2}
                defaultValue={state.algorithm}
                placeholder="R U R' U' …"
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

        {/* Arrow editor — NxN sticker indices, only used by our @cuberoot/visualcube renderer
            (not the puzzle-gen net path). */}
        {state.puzzleType === 'cube' && state.cubeView !== 'net' && (
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

        {/* Special view + stage mask are NxN-cube specific (sr-puzzlegen has its own view variant picker above). */}
        {state.puzzleType === 'cube' && (
          <>
            <div className="vc-row">
              <label className="vc-label">{t('视角', 'Special View')}</label>
              <div className="vc-row-controls">
                <div className="vc-radio-group">
                  {(['normal', 'plan', 'trans', 'net'] as SpecialView[]).map((v) => (
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

            {/* Stage mask is implemented in our @cuberoot/visualcube renderer only — irrelevant for the
                puzzle-gen unfolded-net path. */}
            {state.cubeView !== 'net' && (
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

        {/* Color Schemes — wired into our @cuberoot/visualcube renderer (not the puzzle-gen net path). */}
        {state.puzzleType === 'cube' && state.cubeView !== 'net' && (
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
        )}

        {/* Rotation Sequence — only for NxN cube 3D (puzzle-gen net path is fixed-layout). */}
        {state.puzzleType === 'cube' && state.cubeView !== 'net' && (
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
        )}

        {/* Background applies to both rendering paths (sr-puzzlegen also accepts background via SVG container CSS). */}
        <ColorRow
          label={t('背景色', 'Background Color')}
          value={state.backgroundColor}
          onChange={(v) => set('backgroundColor', v)}
          onReset={() => set('backgroundColor', '')}
          allowEmpty
        />
        {/* Cube colour / opacity / projection distance — our @cuberoot/visualcube only. */}
        {state.puzzleType === 'cube' && state.cubeView !== 'net' && (
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

      {/* API reference — for embedding cube images on other sites */}
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
.vc-header {
  padding: 4px 0 14px; margin-bottom: 12px;
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
}
.vc-header h1 { margin: 0; font-size: 18px; font-weight: 500; color: var(--vc-text); letter-spacing: 0.3px; }
.vc-header-right { display: flex; align-items: center; gap: 12px; }
.vc-header-link {
  color: #9ec5ff; text-decoration: none; font-size: 13px;
  padding: 4px 10px; border: 1px solid var(--vc-divider); border-radius: 6px;
}
.vc-header-link:hover { background: var(--vc-row-bg, #1a1a1a); }

.vc-preview-wrap {
  position: sticky; top: 0; z-index: 5;
  display: flex; justify-content: center; align-items: center;
  padding: 24px; background: #161616; border-radius: 4px;
  /* Cap visible height so sticky stays usable when imageSize is large.
     The SVG's intrinsic dimensions still match imageSize (for download). */
  max-height: 45vh;
}
.vc-preview {
  display: inline-block;
  background: repeating-conic-gradient(rgba(255,255,255,0.025) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
  max-width: 100%; max-height: 100%;
  overflow: hidden;
}
.vc-preview svg { display: block; max-width: 100%; max-height: calc(45vh - 48px); width: auto; height: auto; }

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
/* Secondary label inside the same row (e.g. when two controls share a row) — natural width, no min */
.vc-label-secondary { min-width: 0; padding-left: 16px; }

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
.vc-textarea { resize: vertical; min-height: 36px; }
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
.vc-btn-active { background: var(--vc-accent); color: #fff; }
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

.vc-api-doc {
  margin-top: 24px; padding: 14px 16px;
  background: rgba(0,0,0,0.18); border-radius: 4px;
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
  border-bottom: 1px solid rgba(255,255,255,0.05);
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
