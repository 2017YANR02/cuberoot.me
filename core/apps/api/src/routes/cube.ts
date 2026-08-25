/**
 * GET /v1/visualcube.svg — server-rendered cube SVG.
 *
 * Dispatch (post pzl unification — numeric pzl OR keyword pzl):
 *   - cube + view in {iso,plan,trans,oll,pll,...}  → @cuberoot/visualcube
 *   - cube + view=net|wca                          → cubing.js 2D net
 *   - sq1 / mega / pyra / skewb + view=net|wca     → cubing.js 2D net
 *   - sq1 / mega / pyra / skewb + view=iso         → @cuberoot/puzzle-render-core
 *   - sq1 / mega / pyra / skewb + view=top         → dedicated flat-view renderers
 *
 * URL params:
 *   alg / case / setup       WCA notation (case = inverse of alg on solved)
 *   view                     cube:     iso | plan | f2l | oll | pll | pll-iso | trans | net
 *                            non-cube: iso | top | net | wca   (was: variant=)
 *   mask                     explicit Masking enum value
 *   fc                       exact facelet colours in U R F D L B order
 *   sch                      face colors U R F D L B (cube renderer only): `wrgyob`
 *                            abbreviations or comma hex/names, `#` optional. Default
 *                            stays the legacy yellow-top scheme (alg-case ecosystem);
 *                            studio links always pass sch (its default is WCA white-top)
 *   size                     32-1000; default 256
 *   pzl                      numeric (NxN size 1-50) OR keyword
 *                            (cube | sq1 | mega | pyra | skewb); legacy `puzzle=`
 *                            with old `megaminx`/`pyraminx` long forms still accepted
 *   bg / cc / co             background / plastic / opacity (cube renderer only)
 *   ngs                      plan views only: 1 = drop the grey (masked) side-rim
 *                            stickers, leaving just the coloured bars. U face unchanged.
 *   psr / pur                plan-view recognition simplification: side rule
 *                            (all|bar|oppline|cece|light|oppbar|ecec) / up rule
 *                            (all|bar|baroppbar). 3x3 only.
 *   psy                      keep every last-layer-coloured sticker (default 1)
 *   pfs / pfh                force-show / force-hide `side=<csv>&up=<csv>` index lists
 *   mid                      Square-1 wca only: 0 = hide the equator strip
 *   blk                      Square-1 wca only: 0 = yellow top (default black)
 *
 * Cached 24h since responses are deterministic from inputs.
 */
import { Hono } from 'hono';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { invertSq1Alg } from '@cuberoot/shared/sq1-notation';
import { renderUnfoldedSvg } from '@cuberoot/shared/cube-unfolded-svg';
import { renderPuzzleIsoSvg } from '@cuberoot/puzzle-render-core/iso-svg';
import { renderPuzzleNetSVG } from './cubing_render.js';
import { renderSrPuzzlegenSVG } from './sr_render.js';

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

  // net/wca = the unfolded-cross layout (tnoodle style).
  const wantsNet = view === 'net' || view === 'wca';

  if (wantsNet) {
    // Cube net/wca: the SAME tnoodle-port emitter the client uses
    // (@cuberoot/shared/cube-unfolded-svg) → server bytes == studio bytes, no more
    // cubing.js stand-in for cubes. Non-cube nets stay on the cubing.js renderer.
    if (puzzle === 'cube') {
      const sz = cubeSizeFromPzl ?? parseInt(q('cubeSize') ?? '3', 10);
      const n = isNaN(sz) ? 3 : Math.max(2, Math.min(50, sz));
      // case = the state the alg solves = its inverse (matches client render.ts).
      const forward = isCase ? invertAlg(algStr) : algStr;
      let svg = renderUnfoldedSvg(n, forward);
      // Honor ?size (the emitter is otherwise width:100% responsive); the viewBox
      // keeps the 4:3 aspect, so setting width alone is enough.
      const sizeRaw = parseInt(q('size') ?? '256', 10);
      const size = isNaN(sizeRaw) ? 256 : Math.max(32, Math.min(1000, sizeRaw));
      svg = svg.replace('style="width:100%;height:100%"', `width="${size}"`);
      c.header('Content-Type', 'image/svg+xml; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=86400');
      return c.body(svg);
    }
    const event = puzzle === 'sq1' ? 'sq1'
      : puzzle === 'megaminx' ? 'minx'
      : puzzle === 'pyraminx' ? 'pyram'
      : 'skewb';
    const showSq1Middle = q('mid') !== '0';
    const sq1BlackTop = q('blk') !== '0';
    const svg = await renderPuzzleNetSVG(event, algStr, isCase, showSq1Middle, sq1BlackTop);
    if (svg) {
      c.header('Content-Type', 'image/svg+xml; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=86400');
      return c.body(svg);
    }
    return c.text(`Server-side net render unavailable for ${puzzle}/${event}`, 501);
  }

  // Non-cube iso/top: iso 只走共享的 /sim headless 核心；top 走独立的
  // 平面视图实现。两者不是互相回退关系，避免同一 iso 契约存在两套实现。
  // iso 路径 case = 先逆变换再正向 setup(与 client render.ts 一致)。
  if (puzzle === 'sq1' || puzzle === 'megaminx' || puzzle === 'pyraminx' || puzzle === 'skewb') {
    const v: 'iso' | 'top' = view === 'top' ? 'top' : 'iso';
    const sizeRaw = parseInt(q('size') ?? '256', 10);
    const size = isNaN(sizeRaw) ? 256 : Math.max(32, Math.min(1000, sizeRaw));
    if (v === 'iso') {
      const forward = isCase
        ? (puzzle === 'sq1' ? invertSq1Alg(algStr) : invertAlg(algStr))
        : algStr;
      const engineSvg = renderPuzzleIsoSvg(puzzle, forward, q('r'), size);
      if (engineSvg) {
        c.header('Content-Type', 'image/svg+xml; charset=utf-8');
        c.header('Cache-Control', 'public, max-age=86400');
        return c.body(engineSvg);
      }
      return c.text(`Server-side engine render failed for puzzle=${puzzle}`, 500);
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
    fc: q('fc'),
    sch: q('sch'),
    size: q('size'),
    cubeSize: q('cubeSize'),
    // Only pass pzl when numeric — keyword values (sq1/mega/pyra/skewb/cube)
    // would otherwise confuse the visualcube parser.
    pzl: cubeSizeFromPzl != null ? String(cubeSizeFromPzl) : undefined,
    bg: q('bg'),
    cc: q('cc'),
    co: q('co'),
    ngs: q('ngs'),
    psr: q('psr'),
    pur: q('pur'),
    psy: q('psy'),
    pfs: q('pfs'),
    pfh: q('pfh'),
  });
  c.header('Content-Type', 'image/svg+xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(svg);
});
