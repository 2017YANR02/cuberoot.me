/**
 * Simple-query renderer — turns a small map of `alg / view / mask / fc / size / cubeSize / sch / bg / cc / co`
 * params into a complete `<svg>` string. Encapsulates the `view → mask + view + scheme` preset
 * mapping so the Hono server route and every programmatic caller stay in lock-step.
 *
 * Not the full PHP query API (no `arw`/`fd`/...). For those, build `ICubeOptions` directly.
 */
import { Face, Masking } from './cube/constants.js';
import type { ICubeOptions } from './cube/options.js';
import { renderCubeSVG } from './index.js';
import { parseColorScheme } from './cube/parsing/colorScheme.js';
import { parseFaceletColors } from './cube/parsing/faceletColors.js';

const DEFAULT_ALG = "R U R' U R U2 R'"; // Sune (OLL 27)
const DEFAULT_SIZE = 256;
const SIZE_MIN = 32;
const SIZE_MAX = 1000;
const PUZZLE_SIZE_MIN = 2;
const PUZZLE_SIZE_MAX = 10;

// PHP visualcube `stage=oll` style — U yellow, everything else gray (orientation-only preview).
const OLL_STAGE_SCHEME = {
  [Face.U]: '#FFFF00',
  [Face.D]: '#404040',
  [Face.F]: '#404040',
  [Face.B]: '#404040',
  [Face.L]: '#404040',
  [Face.R]: '#404040',
};

function findMask(name: string | undefined): Masking | undefined {
  if (!name) return undefined;
  const lookup = (Object.values(Masking) as string[]).find(
    (v) => v.toLowerCase() === name.toLowerCase(),
  );
  return lookup as Masking | undefined;
}

// Whitelist: hex (with/without #) or named CSS color (alpha-only). Public unauthenticated input.
function parseColorParam(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^#?[0-9a-f]{3,8}$/i.test(raw)) return raw.startsWith('#') ? raw : '#' + raw;
  if (/^[a-z]+$/i.test(raw)) return raw;
  return undefined;
}

export interface SimpleVisualCubeQuery {
  /** WCA notation, applied DIRECTLY (forward). `?alg=R` shows the cube AFTER R from solved.
   *  Matches the visualcube editor's `alg` field semantics. */
  alg?: string;
  /** WCA notation, applied INVERTED — `?case=R` shows the cube state that `R` solves
   *  (i.e. `R'` applied from solved). Use this for OLL/PLL/F2L "case rendered as solved-by-this-alg"
   *  thumbnails. Takes precedence over `alg`/`setup`. */
  case?: string;
  /** Alias of `alg` — forward apply. Kept as a separate name for code-level clarity when the
   *  source of the string is a clean case-setup scramble (e.g. speedcubedb's `setup` field). */
  setup?: string;
  /** iso | plan | f2l | oll | pll | pll-iso | trans */
  view?: string;
  /** Explicit Masking enum value; overrides the view-implied mask. */
  mask?: string;
  /** Exact final-state facelet colours, exactly 6N² compact colour codes in U R F D L B order. */
  fc?: string;
  /** SVG width/height, capped 32..1000. */
  size?: string | number;
  /** NxN puzzle dimension, 2..7. Accepts both `cubeSize` and PHP-style `pzl`. */
  cubeSize?: string | number;
  pzl?: string | number;
  /** Face color scheme, U R F D L B order — PHP visualcube `sch=`: either the
   *  abbreviation string (`wrgyob` = WCA white-top) or a comma list of hex/names
   *  (leading `#` optional). Overrides every view-implied scheme. Lets a caller
   *  (e.g. the /visualcube studio's API links) reproduce its face colors exactly. */
  sch?: string;
  bg?: string;
  cc?: string;
  co?: string | number;
  /** "no grey sides" — in a plan view (`plan`/`oll`/`pll`), drop the side-rim stickers
   *  that came out masked-grey instead of drawing them. The U-face stickers are
   *  untouched. Bare `view=plan` enables this by default; aliases may opt in with `ngs=1`. */
  ngs?: string | number | boolean;
  /** Plan-view recognition simplification (cube/plan-simplify.ts).
   *  `psr` side rule · `pur` up rule · `psy` keep last-layer colour (default on)
   *  · `pfs` / `pfh` force-show / force-hide `side=..&up=..` index lists. */
  psr?: string;
  pur?: string;
  psy?: string | number | boolean;
  pfs?: string;
  pfh?: string;
}

const SIDE_RULES = ['all', 'bar', 'oppline', 'cece', 'light', 'oppbar', 'ecec'];
const UP_RULES = ['all', 'bar', 'baroppbar'];

function truthy(v: string | number | boolean | undefined): boolean {
  return v !== undefined && v !== '' && v !== '0' && v !== 0 && v !== false;
}

function intParam(raw: string | number | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseFinalFacelets(raw: string | undefined, faceletCount: number): string[] | undefined {
  if (!raw || raw.length !== faceletCount || !/^[dwyrobg]+$/i.test(raw)) return undefined;
  return parseFaceletColors(raw.toLowerCase());
}

/** Build the merged ICubeOptions for a simple-query request. Public for testing. */
export function buildSimpleOptions(q: SimpleVisualCubeQuery): ICubeOptions {
  const view = q.view ?? 'iso';
  const sizeN = intParam(q.size) ?? DEFAULT_SIZE;
  const size = Math.max(SIZE_MIN, Math.min(SIZE_MAX, sizeN));
  const cubeSizeN = intParam(q.cubeSize) ?? intParam(q.pzl) ?? 3;
  const cubeSize = (cubeSizeN < PUZZLE_SIZE_MIN || cubeSizeN > PUZZLE_SIZE_MAX) ? 3 : cubeSizeN;

  const opts: ICubeOptions = { width: size, height: size, cubeSize };
  const stickerColors = parseFinalFacelets(q.fc, 6 * cubeSize * cubeSize);
  if (stickerColors) opts.stickerColors = stickerColors;
  // Precedence: `case` (inverse) > `setup` (forward alias) > `alg` (forward, default).
  // `alg` and `setup` are both forward — the dual name is just to keep call sites self-documenting.
  if (q.case !== undefined) opts.case = q.case;
  else if (q.setup !== undefined) opts.algorithm = q.setup;
  else if (q.alg !== undefined) opts.algorithm = q.alg;
  else if (!stickerColors) opts.algorithm = DEFAULT_ALG;

  const bg = parseColorParam(q.bg);
  const cc = parseColorParam(q.cc);
  const coN = intParam(q.co);
  const co = coN !== undefined && coN >= 0 && coN <= 100 ? coN : undefined;
  if (bg) opts.backgroundColor = bg;
  if (cc) opts.cubeColor = cc;
  if (co !== undefined) opts.cubeOpacity = co;

  // PHP visualcube view=trans preset (silver shell, 50% opaque). Explicit cc/co win.
  // Also drop the mask fill so masked-out stickers show the silver shell through —
  // matches PHP `view=trans` behavior (default sticker = Transparent, not Black).
  if (view === 'trans') {
    if (opts.cubeColor === undefined) opts.cubeColor = 'silver';
    if (opts.cubeOpacity === undefined) opts.cubeOpacity = 50;
    opts.maskColor = 'transparent';
  }

  const explicitMask = findMask(q.mask);
  if (explicitMask) opts.mask = explicitMask;
  else if (view === 'f2l') opts.mask = Masking.F2L;
  else if (view === 'oll') opts.mask = Masking.OLL;
  else if (view === 'pll') opts.mask = Masking.LL;
  else if (view === 'pll-iso') opts.mask = Masking.LL;

  if (view === 'plan' || view === 'oll' || view === 'pll') opts.view = 'plan';

  // 纯 plan 是通用识别图入口:侧环的灰色只是「不参与识别」占位，默认不画；顶面灰格是题面，
  // renderOLLStickers 的独立 pass 不会碰它。oll/pll 别名保留各自契约，由调用方用 ngs opt in。
  if (view === 'plan' || truthy(q.ngs)) opts.hideGreySides = true;
  const simplify: NonNullable<ICubeOptions['planSimplify']> = {};
  // Unknown rule names are dropped rather than passed through — this is public,
  // unauthenticated input and the renderer would silently fall back to 'all' anyway.
  if (q.psr && SIDE_RULES.includes(q.psr)) simplify.side = q.psr as typeof simplify.side;
  if (q.pur && UP_RULES.includes(q.pur)) simplify.up = q.pur as typeof simplify.up;
  if (q.psy !== undefined) simplify.showYellow = truthy(q.psy);
  if (q.pfs) simplify.forceShow = q.pfs;
  if (q.pfh) simplify.forceHide = q.pfh;
  if (Object.keys(simplify).length > 0) opts.planSimplify = simplify;

  // OLL view defaults to the orientation-only color scheme (unless the caller supplied an explicit mask).
  if (view === 'oll' && !explicitMask) opts.colorScheme = OLL_STAGE_SCHEME;

  // Explicit scheme wins over every view preset. `#` stripped per token first —
  // parseColor's unanchored hex regex would otherwise turn `#ffffff` into `##ffffff`.
  if (q.sch) {
    const raw = q.sch.includes(',')
      ? q.sch.split(',').map((t) => t.replace(/^#/, '')).join(',')
      : q.sch;
    opts.colorScheme = parseColorScheme(raw);
  }

  return opts;
}

/** End-to-end: simple query → final SVG string. */
export function renderFromSimpleQuery(q: SimpleVisualCubeQuery): string {
  return renderCubeSVG(buildSimpleOptions(q));
}
