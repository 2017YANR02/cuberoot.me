/**
 * GET /v1/visualcube.svg — server-rendered cube SVG.
 *
 * Two-renderer dispatch:
 *   - puzzle=cube + view in {iso,plan,trans,oll,pll,...}  → @cuberoot/visualcube (3D / top-down)
 *   - puzzle=cube + view=net                              → cubing.js 2D net
 *   - puzzle=sq1|megaminx|pyraminx|skewb (any variant=net) → cubing.js 2D net
 *   - puzzle=sq1|megaminx|pyraminx|skewb (iso/top)        → not server-rendered yet
 *     (client-side falls back to sr-puzzlegen; 501 here)
 *
 * URL params:
 *   alg / case / setup       WCA notation (case = inverse of alg on solved)
 *   view                     iso | plan | f2l | oll | pll | pll-iso | trans | net
 *   mask                     explicit Masking enum value
 *   size                     32-1000; default 256
 *   cubeSize / pzl           NxN, 2-7; default 3
 *   bg / cc / co             background / plastic / opacity (cube renderer only)
 *   puzzle                   cube | sq1 | megaminx | pyraminx | skewb (default cube)
 *   variant                  iso | net | top (relevant for non-cube puzzles)
 *
 * Cached 24h since responses are deterministic from inputs.
 */
import { Hono } from 'hono';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { renderPuzzleNetSVG } from './cubing_render.js';

export const cubeRoutes = new Hono();

cubeRoutes.get('/visualcube.svg', async (c) => {
  const q = (k: string) => c.req.query(k);

  const puzzle = (q('puzzle') ?? 'cube').toLowerCase();
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
      const pzl = parseInt(q('cubeSize') ?? q('pzl') ?? '3', 10);
      const n = isNaN(pzl) ? 3 : Math.max(2, Math.min(7, pzl));
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

  // Non-cube puzzles in non-net variants: not yet wired server-side.
  if (puzzle !== 'cube') {
    return c.text(`Server-side render not implemented for puzzle=${puzzle} variant=${variant ?? 'iso'}`, 501);
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
    pzl: q('pzl'),
    bg: q('bg'),
    cc: q('cc'),
    co: q('co'),
  });
  c.header('Content-Type', 'image/svg+xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(svg);
});
