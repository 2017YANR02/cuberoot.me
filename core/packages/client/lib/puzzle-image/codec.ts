/**
 * URL codec for ImageSpec. Every key is namespaced by `prefix` so a host page
 * that already owns `puzzle` / `alg` / `setup` / `cuts` / `renderer` (e.g. /sim)
 * can mount the image state under `img_*` without collision.
 *
 * prefix '' reproduces /visualcube's historical query byte-for-byte (same keys,
 * same emission order, same "only when != default" discipline).
 */

import { DEFAULTS, FACE_DEFAULTS, rotationDefaultsFor, rotationsMatchDefault } from './defaults';
import { MASK_ROTATIONS } from './masks';
import type { ImageSpec, PuzzleType, SpecialView, PuzzleVariant } from './types';

/** Keys specToParams can emit, in emission order. */
const WRITE_KEYS = [
  'pzl', 'size', 'alg', 'case', 'arw', 'ac', 'view', 'stage',
  'sch', 'r', 'bg', 'cc', 'co', 'fo', 'dist',
] as const;

/**
 * Read-only legacy alias for `pzl`. Honored ONLY at prefix '' — with a prefix,
 * a bare `puzzle=` belongs to the host page, not to us.
 */
const LEGACY_PZL_ALIAS = 'puzzle';

/** All keys this codec owns at `prefix` (write keys + the legacy alias at ''). */
export function imageQueryKeys(prefix: string): string[] {
  const keys = WRITE_KEYS.map((k) => prefix + k);
  if (prefix === '') keys.push(LEGACY_PZL_ALIAS);
  return keys;
}

/** Keys specToParams can emit at `prefix` (excludes the read-only alias). */
export function imageWriteKeys(prefix: string): string[] {
  return WRITE_KEYS.map((k) => prefix + k);
}

export function pzlShort(t: PuzzleType): string {
  if (t === 'megaminx') return 'mega';
  if (t === 'pyraminx') return 'pyra';
  return t;
}

export type ParamsInput =
  | URLSearchParams
  | Record<string, string | null | undefined>
  | string;

function toGetter(params: ParamsInput): (k: string) => string | null {
  if (typeof params === 'string') {
    const sp = new URLSearchParams(params);
    return (k) => sp.get(k);
  }
  if (params instanceof URLSearchParams) return (k) => params.get(k);
  return (k) => params[k] ?? null;
}

export function readSpecFromParams(params: ParamsInput, prefix: string): ImageSpec {
  const raw = toGetter(params);
  const get = (k: string) => raw(prefix + k);
  const num = (k: string, fallback: number, min?: number, max?: number) => {
    const v = get(k);
    if (v == null) return fallback;
    const n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };
  const s: ImageSpec = { ...DEFAULTS };

  const pzl = get('pzl') ?? (prefix === '' ? raw(LEGACY_PZL_ALIAS) : null);
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
      if (view === 'plan' || view === 'trans' || view === 'net' || view === 'wca') {
        s.cubeView = view as SpecialView;
      }
    } else if (view === 'iso' || view === 'top' || view === 'wca' || view === 'net') {
      s.puzzleVariant = view as PuzzleVariant;
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

export function specToParams(s: ImageSpec, prefix: string): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string) => p.set(prefix + k, v);
  if (s.puzzleType !== 'cube') set('pzl', pzlShort(s.puzzleType));
  else set('pzl', String(s.cubeSize));
  if (s.imageSize !== DEFAULTS.imageSize) set('size', String(s.imageSize));
  if (s.algorithm) set(s.algType, s.algorithm);
  if (s.arrows) set('arw', s.arrows);
  if (s.defaultArrowColor) set('ac', s.defaultArrowColor);
  if (s.puzzleType === 'cube') {
    if (s.cubeView !== 'normal') set('view', s.cubeView);
  } else if (s.puzzleVariant !== DEFAULTS.puzzleVariant) {
    set('view', s.puzzleVariant);
  }
  if (s.stageMask) {
    set('stage', s.maskAlg ? `${s.stageMask}-${s.maskAlg}` : s.stageMask);
  }
  const schDifferent =
    s.faceU !== FACE_DEFAULTS.U || s.faceR !== FACE_DEFAULTS.R ||
    s.faceF !== FACE_DEFAULTS.F || s.faceD !== FACE_DEFAULTS.D ||
    s.faceL !== FACE_DEFAULTS.L || s.faceB !== FACE_DEFAULTS.B;
  if (schDifferent) {
    set('sch', [s.faceU, s.faceR, s.faceF, s.faceD, s.faceL, s.faceB].join(','));
  }
  if (!rotationsMatchDefault(s)) {
    set('r', `${s.rotateAxis1}${s.rotateAngle1}${s.rotateAxis2}${s.rotateAngle2}`);
  }
  if (s.backgroundColor) set('bg', s.backgroundColor);
  if (s.cubeColor !== DEFAULTS.cubeColor) set('cc', s.cubeColor);
  if (s.cubeOpacity !== DEFAULTS.cubeOpacity) set('co', String(s.cubeOpacity));
  if (s.stickerOpacity !== DEFAULTS.stickerOpacity) set('fo', String(s.stickerOpacity));
  if (s.dist !== DEFAULTS.dist) set('dist', String(s.dist));
  return p;
}
