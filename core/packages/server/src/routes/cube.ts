/**
 * GET /v1/visualcube.svg — server-rendered cube SVG.
 *
 * Dispatch (post pzl unification — numeric pzl OR keyword pzl):
 *   - cube + view in {iso,plan,trans,oll,pll,...}  → @cuberoot/visualcube
 *   - cube + view=net|wca                          → cubing.js 2D net
 *   - sq1 / mega / pyra / skewb + view=net|wca     → cubing.js 2D net
 *   - sq1 / mega / pyra / skewb + view=iso|top     → sr-puzzlegen (linkedom)
 *
 * URL params:
 *   alg / case / setup       WCA notation (case = inverse of alg on solved)
 *   view                     cube:     iso | plan | f2l | oll | pll | pll-iso | trans | net
 *                            non-cube: iso | top | net | wca   (was: variant=)
 *   mask                     explicit Masking enum value
 *   size                     32-1000; default 256
 *   pzl                      numeric (NxN size 1-50) OR keyword
 *                            (cube | sq1 | mega | pyra | skewb); legacy `puzzle=`
 *                            with old `megaminx`/`pyraminx` long forms still accepted
 *   bg / cc / co             background / plastic / opacity (cube renderer only)
 *
 * Cached 24h since responses are deterministic from inputs.
 */
import { Hono } from 'hono';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { invertAlg } from '@/lib/cube3';
import { invertSq1Alg } from '@cuberoot/shared/sq1-notation';
import { renderPuzzleNetSVG } from './cubing_render.js';
import { renderSrPuzzlegenSVG } from './sr_render.js';
import { renderEngineIsoSVG } from './engine_render.js';

export const cubeRoutes = new Hono();

/** Resolve the puzzle type + numeric NxN size (when cube) from `pzl` (primary)
 *  or legacy `puzzle=`. Returns `cubeSizeFromPzl` only when pzl was numeric. */
function resolvePuzzle(pzlRaw: string | undefined, legacyPuzzle: string | undefined): {
  puzzle: 'cube' | 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';
  cubeSizeFromPzl: number | null;
} {
  const raw = (pzlRaw ?? legacyPuzzle ?? 'cube').toLowerCase().trim();
  if (/^\d+$/.test(raw)) {
    return { puzzle: 'cube', cubeSizeFromPzl: parseInt(raw, 10) };
  }
  if (raw === 'sq1') return { puzzle: 'sq1', cubeSizeFromPzl: null };
  if (raw === 'mega' || raw === 'megaminx') return { puzzle: 'megaminx', cubeSizeFromPzl: null };
  if (raw === 'pyra' || raw === 'pyraminx') return { puzzle: 'pyraminx', cubeSizeFromPzl: null };
  if (raw === 'skewb') return { puzzle: 'skewb', cubeSizeFromPzl: null };
  return { puzzle: 'cube', cubeSizeFromPzl: null };
}

cubeRoutes.get('/visualcube.svg', async (c) => {
  const q = (k: string) => c.req.query(k);

  const { puzzle, cubeSizeFromPzl } = resolvePuzzle(q('pzl'), q('puzzle'));
  const view = q('view');

  // alg/setup are forward; case is the inverse alg (state the alg solves).
  // case wins (matches the cube renderer's precedence).
  const algStr = q('case') ?? q('alg') ?? q('setup') ?? '';
  const isCase = q('case') != null;

  // `view=wca` is the tnoodle-port unfolded layout — server doesn't ship a TS port,
  // so reuse the cubing.js scramble-display net renderer (close-enough WCA preview).
  const wantsNet = view === 'net' || view === 'wca';

  if (wantsNet) {
    let event: string;
    if (puzzle === 'cube') {
      const sz = cubeSizeFromPzl ?? parseInt(q('cubeSize') ?? '3', 10);
      const n = isNaN(sz) ? 3 : Math.max(2, Math.min(7, sz));
      event = `${n}${n}${n}`;
    } else {
      event = puzzle === 'sq1' ? 'sq1'
        : puzzle === 'megaminx' ? 'minx'
        : puzzle === 'pyraminx' ? 'pyram'
        : 'skewb';
    }
    const svg = await renderPuzzleNetSVG(event, algStr, isCase);
    if (svg) {
      c.header('Content-Type', 'image/svg+xml; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=86400');
      return c.body(svg);
    }
    // fall through to 501 below
    return c.text(`Server-side net render unavailable for ${puzzle}/${event}`, 501);
  }

  // Non-cube iso/top(Phase 4,PLAN-sr-retirement):iso 首选 /sim 引擎 headless
  // 渲染(engine_render,与 /sim 伴图同导出器同观感),失败回退 sr-puzzlegen
  // (后悔药,观察期后随 Phase 5 删);top 仍 sr(mega-top 俯视是 sr 特有形态,
  // skewb-top 自绘 fan)。engine 路径 case = 先逆变换再正向 setup(与 client
  // render.ts 同一 invert 函数集)。上线注意:响应观感变 → 消费方按缓存规则
  // bump `v=`(nginx 24h cache 键含 query)。
  if (puzzle === 'sq1' || puzzle === 'megaminx' || puzzle === 'pyraminx' || puzzle === 'skewb') {
    const v: 'iso' | 'top' = view === 'top' ? 'top' : 'iso';
    const sizeRaw = parseInt(q('size') ?? '256', 10);
    const size = isNaN(sizeRaw) ? 256 : Math.max(32, Math.min(1000, sizeRaw));
    if (v === 'iso') {
      const forward = isCase
        ? (puzzle === 'sq1' ? invertSq1Alg(algStr) : invertAlg(algStr))
        : algStr;
      const engineSvg = renderEngineIsoSVG(puzzle, forward, q('r'), size);
      if (engineSvg) {
        c.header('Content-Type', 'image/svg+xml; charset=utf-8');
        c.header('Cache-Control', 'public, max-age=86400');
        return c.body(engineSvg);
      }
    }
    const svg = await renderSrPuzzlegenSVG(puzzle, v, algStr, isCase, q('r'), size);
    if (svg) {
      c.header('Content-Type', 'image/svg+xml; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=86400');
      return c.body(svg);
    }
    return c.text(`Server-side render failed for puzzle=${puzzle} view=${v}`, 500);
  }

  // Default cube (3D / plan / trans / oll / pll / ...)
  const svg = renderFromSimpleQuery({
    alg: q('alg'),
    case: q('case'),
    setup: q('setup'),
    view,
    mask: q('mask'),
    size: q('size'),
    cubeSize: q('cubeSize'),
    // Only pass pzl when numeric — keyword values (sq1/mega/pyra/skewb/cube)
    // would otherwise confuse the visualcube parser.
    pzl: cubeSizeFromPzl != null ? String(cubeSizeFromPzl) : undefined,
    bg: q('bg'),
    cc: q('cc'),
    co: q('co'),
  });
  c.header('Content-Type', 'image/svg+xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(svg);
});
