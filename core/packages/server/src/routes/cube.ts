/**
 * GET /v1/visualcube.svg — server-rendered cube SVG.
 *
 * Dispatch (post pzl unification — numeric pzl OR keyword pzl):
 *   - cube + view in {iso,plan,trans,oll,pll,...}  → @cuberoot/visualcube
 *   - cube + view=net                              → cubing.js 2D net
 *   - sq1 / mega / pyra / skewb + variant=net      → cubing.js 2D net
 *   - sq1 / mega / pyra / skewb + iso/top          → sr-puzzlegen (linkedom)
 *
 * URL params:
 *   alg / case / setup       WCA notation (case = inverse of alg on solved)
 *   view                     iso | plan | f2l | oll | pll | pll-iso | trans | net
 *   mask                     explicit Masking enum value
 *   size                     32-1000; default 256
 *   pzl                      numeric (NxN size 1-50) OR keyword
 *                            (cube | sq1 | mega | pyra | skewb); legacy `puzzle=`
 *                            with old `megaminx`/`pyraminx` long forms still accepted
 *   bg / cc / co             background / plastic / opacity (cube renderer only)
 *   variant                  iso | net | top (relevant for non-cube puzzles)
 *
 * Cached 24h since responses are deterministic from inputs.
 */
import { Hono } from 'hono';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
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
  const variant = q('variant');
  const view = q('view');

  // alg/setup are forward; case is the inverse alg (state the alg solves).
  // case wins (matches the cube renderer's precedence).
  const algStr = q('case') ?? q('alg') ?? q('setup') ?? '';
  const isCase = q('case') != null;

  const wantsNet =
    (puzzle === 'cube' && view === 'net') ||
    (puzzle !== 'cube' && variant === 'net');

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

  // Non-cube iso/top: sr-puzzlegen via linkedom (+ shared skewb fan for skewb-top).
  if (puzzle === 'sq1' || puzzle === 'megaminx' || puzzle === 'pyraminx' || puzzle === 'skewb') {
    const v: 'iso' | 'top' = variant === 'top' ? 'top' : 'iso';
    const sizeRaw = parseInt(q('size') ?? '256', 10);
    const size = isNaN(sizeRaw) ? 256 : Math.max(32, Math.min(1000, sizeRaw));
    const svg = await renderSrPuzzlegenSVG(puzzle, v, algStr, isCase, q('r'), size);
    if (svg) {
      c.header('Content-Type', 'image/svg+xml; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=86400');
      return c.body(svg);
    }
    return c.text(`Server-side render failed for puzzle=${puzzle} variant=${v}`, 500);
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
