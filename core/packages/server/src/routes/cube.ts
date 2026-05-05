/**
 * GET /api/visualcube.svg — server-rendered cube SVG.
 *
 * URL params (forwarded to `renderFromSimpleQuery`):
 *   alg       WCA notation, applied DIRECTLY (forward) — cube state AFTER alg from solved
 *   case      WCA notation, applied INVERTED — cube state that `case` solves; takes precedence
 *   setup     Alias of `alg` (forward); for code-level clarity when src is a case-setup scramble
 *   view      iso | plan | f2l | oll | pll | pll-iso | trans
 *             trans = PHP visualcube preset (cc=silver, co=50, semi-transparent shell)
 *   mask      explicit Masking enum value (overrides view-implied mask)
 *   size      32-1000; default 256
 *   cubeSize  NxN puzzle, 2-7; default 3 (alias: pzl)
 *   bg        hex / CSS color name; default transparent
 *   cc        plastic color (PHP `cc`)
 *   co        plastic opacity 0-100 (PHP `co`)
 *
 * Cached 24h since the response is deterministic from the inputs.
 */
import { Hono } from 'hono';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';

export const cubeRoutes = new Hono();

cubeRoutes.get('/api/visualcube.svg', (c) => {
  const svg = renderFromSimpleQuery({
    alg: c.req.query('alg'),
    case: c.req.query('case'),
    setup: c.req.query('setup'),
    view: c.req.query('view'),
    mask: c.req.query('mask'),
    size: c.req.query('size'),
    cubeSize: c.req.query('cubeSize'),
    pzl: c.req.query('pzl'),
    bg: c.req.query('bg'),
    cc: c.req.query('cc'),
    co: c.req.query('co'),
  });
  c.header('Content-Type', 'image/svg+xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(svg);
});
