/**
 * GET /api/visualcube.svg — 服务端渲染单个 3x3 SVG 图。
 *
 * URL 参数与客户端 /visualcube 路由保持一致：
 *   alg   WCA notation；默认 Sune
 *   view  iso | plan | f2l | oll | pll | pll-iso
 *   mask  显式 Masking 枚举值（覆盖 view 推断的 mask）
 *   size  32-1000；默认 256
 *   bg    hex（带不带 #）或 CSS 颜色名；默认透明
 *
 * 灵感源自 visualcube.php URL API，确定性输入故缓存 24h。
 */
import { Hono } from 'hono';
import { renderCubeSVG, Masking, Face, type ICubeOptions } from '@cuberoot/visualcube';

const DEFAULT_ALG = "R U R' U R U2 R'"; // Sune (OLL 27)
const DEFAULT_SIZE = 256;

// PHP visualcube `stage=oll` 风格：U 黄、其他全灰 → 朝向二元图。
const OLL_STAGE_SCHEME = {
  [Face.U]: '#FFFF00',
  [Face.D]: '#404040',
  [Face.F]: '#404040',
  [Face.B]: '#404040',
  [Face.L]: '#404040',
  [Face.R]: '#404040',
};

function findMask(name?: string): Masking | undefined {
  if (!name) return undefined;
  const lookup = (Object.values(Masking) as string[]).find(
    (v) => v.toLowerCase() === name.toLowerCase(),
  );
  return lookup as Masking | undefined;
}

export const cubeRoutes = new Hono();

cubeRoutes.get('/api/visualcube.svg', (c) => {
  const alg = c.req.query('alg') ?? DEFAULT_ALG;
  const view = c.req.query('view') ?? 'iso';
  const maskParam = c.req.query('mask');
  const sizeRaw = parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10);
  const size = Math.max(
    32,
    Math.min(1000, Number.isNaN(sizeRaw) ? DEFAULT_SIZE : sizeRaw),
  );
  const bg = c.req.query('bg');

  const opts: ICubeOptions = { case: alg, width: size, height: size };
  if (bg) {
    // Whitelist: hex (with/without #) or named CSS color (alpha-only).
    // Anything else dropped — public unauthenticated endpoint, defense in
    // depth even though drawing.ts attr() escaper handles SVG-injection.
    if (/^#?[0-9a-f]{3,8}$/i.test(bg)) {
      opts.backgroundColor = bg.startsWith('#') ? bg : '#' + bg;
    } else if (/^[a-z]+$/i.test(bg)) {
      opts.backgroundColor = bg;
    }
  }

  const explicitMask = findMask(maskParam);
  if (explicitMask) opts.mask = explicitMask;
  else if (view === 'f2l') opts.mask = Masking.F2L;
  else if (view === 'oll') opts.mask = Masking.OLL;
  else if (view === 'pll') opts.mask = Masking.LL;
  else if (view === 'pll-iso') opts.mask = Masking.LL;

  if (view === 'plan' || view === 'oll' || view === 'pll') opts.view = 'plan';

  // OLL 默认走朝向二元图 scheme（除非显式给了 mask 覆盖了 view 推断）
  if (view === 'oll' && !explicitMask) opts.colorScheme = OLL_STAGE_SCHEME;

  const svg = renderCubeSVG(opts);
  c.header('Content-Type', 'image/svg+xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(svg);
});
