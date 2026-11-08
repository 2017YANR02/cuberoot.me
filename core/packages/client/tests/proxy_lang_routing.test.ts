// proxy.ts 的 Pattern B 语言路由回归。
//
// 盯死的那个坑:裸(英文)路径靠 middleware **rewrite** 到 /en 树。自托管的 Next 服务器
// 消费不了自己的 x-middleware-rewrite,会带着 x-forwarded-proto=https 自代理回自己的
// 纯 HTTP 端口 → EPROTO → 500。原来只按 NODE_ENV==='production' 关掉 rewrite,于是
// `next dev` 只要也挂在终止 TLS 的反代后面(dev.cuberoot.me → frp → 本机 :3000,nginx
// 发 X-Forwarded-Proto: https)就全站裸 URL 500,而 /zh 正常 —— 表现为「切到英文就
// Internal Server Error」。改成按请求判定后,这里锁住两边都不许回退。

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import nextConfig from '../next.config';
import { RETIRED_ROUTES, isRetiredRoute } from '@/lib/retired-routes';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { matchHas } from 'next/dist/shared/lib/router/utils/prepare-destination';
import { WCA_STAT_NON_PAGE_IDS } from '@cuberoot/shared/wca-stat-catalog';

function request(url: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(url, { headers: new Headers(headers) }));
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => Response.json({ locks: {} }))); });
afterEach(() => { vi.unstubAllGlobals(); });

const FORWARDED_HTTPS = { 'x-forwarded-proto': 'https' };

describe('retired architecture URLs', () => {
  it('routes retired pages to the root 404 before dynamic shells', async () => {
    const config = await nextConfig.rewrites!();
    expect(Array.isArray(config)).toBe(false);
    if (Array.isArray(config) || !config.beforeFiles) throw new Error('Expected ordered rewrites');
    expect(config.beforeFiles.slice(0, RETIRED_ROUTES.length)).toEqual(RETIRED_ROUTES.map(route => ({
      source: `/:lang(en|zh)?${route.path}${'descendants' in route ? '/:path*' : ''}`, destination: '/404',
    })));
  });
  const paths = ['/dev/architecture/decisions', '/dev/code-history', '/dev/architecture/code-history', '/dev/architecture/history',
    ...WCA_STAT_NON_PAGE_IDS.map(id => `/wca/${id}`)];
  it.each(paths.flatMap(path => [path, `/zh${path}`, `/en${path}`, `${path}?lang=zh&day=2026-02-22`]))('defers to the internal 404 route without a Proxy rewrite for %s', async path => {
    const res = await request(`https://cuberoot.me${path}`, { 'accept-language': 'zh-CN', ...FORWARDED_HTTPS });
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});

describe('retired common-competitor view', () => {
  it('returns the retired view to 404 before the competition shell, preserving other views', async () => {
    const config = await nextConfig.rewrites!();
    if (Array.isArray(config)) throw new Error('Expected ordered rewrites');
    const rules = config.beforeFiles!;
    const index = rules.findIndex(rule => rule.has?.some(item => item.key === 'view' && item.value === 'common'));
    const rule = rules[index];
    expect(rule.destination).toBe('/404');
    expect(index).toBeLessThan(rules.findIndex(item => item.destination === '/:lang/wca/comp/_'));
    for (const prefix of ['', '/zh', '/en']) {
      const path = `${prefix}/wca/comp/HainanOpen2026`;
      expect(getPathMatch(rule.source)(path)).toBeTruthy();
      const res = await request(`https://cuberoot.me${path}?view=common&compare=Other2026&layout=poster`,
        { 'accept-language': 'zh-CN', ...FORWARDED_HTTPS });
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    }
    for (const view of ['', 'result', 'psych', 'schedule', 'podium', 'scramble', 'similar', 'common']) {
      const query = { view };
      expect(Boolean(matchHas({ headers: {} } as Parameters<typeof matchHas>[0], query, rule.has))).toBe(view === 'common');
      expect(isRetiredRoute('/wca/comp/HainanOpen2026', new URLSearchParams(query))).toBe(view === 'common');
    }
    expect(getPathMatch(rule.source)('/zh/wca/competition_streaks')).toBe(false);
    expect(isRetiredRoute('/wca/competition_streaks', new URLSearchParams('view=common'))).toBe(false);
  });
});

describe('retired algorithm trainers', () => {
  it('redirects before rendering and scopes invitations, repeated cases and assignment attribution', async () => {
    const res = await request('http://localhost:3000/zh/alg/333/oll/run?room=invite&case=A&case=B&scope=ocll&mode=memo&trainingOrg=school');
    expect(res.status).toBe(308);
    const url = new URL(res.headers.get('location')!);
    expect(url.pathname).toBe('/zh/timer');
    expect([...url.searchParams]).toEqual([
      ['content', 'oll'], ['source', 'cases'], ['method', 'recall'], ['group', 'ocll'],
      ['trainingRoom', 'invite'], ['case', 'A'], ['case', 'B'], ['trainingOrg', 'school'],
    ]);
    const landed = await request(url.href);
    expect(landed.headers.get('location')).toBeNull();
  });

  it.each([
    '/alg/3x3/pll/select', '/alg/2x2/mix/run?sets=eg1,eg2', '/alg/3x3/cross',
    '/alg/roux', '/alg/skewb-trainer', '/alg/3bld/edge', '/alg/3bld/corner',
    '/alg/3bld/edge-float', '/alg/3bld/corner-float', '/alg/3bld/2c2c', '/alg/3bld/2e2e',
    '/alg/3bld/parity', '/alg/3bld/flip', '/alg/3bld/twist', '/alg/3bld/ltct',
    '/alg/3bld/memo', '/alg/3bld/timer', '/alg/3bld/helper',
    '/alg/sq1/algorithm-trainer', '/alg/sq1/train', '/alg/sq1/parity-game',
    '/alg/lsll', '/alg/lsll/ap', '/alg/lsll/case?k=123', '/alg/lsll/route', '/alg/time-attack',
  ])('keeps the old %s entrance usable in the timer', async path => {
    const res = await request(`http://localhost:3000${path}`, { cookie: 'lang=en' });
    const url = new URL(res.headers.get('location')!);
    expect(url.pathname).toBe('/timer');
    const canonicalCases: Record<string, string> = {
      '/alg/3x3/pll/select': 'content=pll&source=cases&view=select',
      '/alg/2x2/mix/run?sets=eg1,eg2': 'event=222&content=mix&source=cases&sets=eg1%2Ceg2',
      '/alg/lsll': 'content=lsll&source=cases&view=select',
      '/alg/lsll/ap': 'content=lsll&source=cases&view=select&group=ap',
    };
    if (canonicalCases[path]) expect(url.searchParams.toString()).toBe(canonicalCases[path]);
    else expect(url.searchParams.get('training')).toBe(path.split('?')[0]);
  });

  it('uses explicit and preferred language without permanently caching a user preference', async () => {
    const preferred = await request('http://localhost:3000/alg/roux', { cookie: 'lang=zh' });
    expect(preferred.status).toBe(307);
    expect(new URL(preferred.headers.get('location')!).pathname).toBe('/zh/timer');
    const explicit = await request('http://localhost:3000/zh/alg/roux?lang=en&mode=fb');
    const url = new URL(explicit.headers.get('location')!);
    expect(url.pathname).toBe('/timer');
    expect(url.searchParams.get('train.mode')).toBe('fb');
    expect(url.searchParams.has('train.lang')).toBe(false);
  });

  it.each(['/alg', '/alg/3x3', '/alg/3x3/oll', '/alg/3x3/oll/ocll', '/alg/3bld',
    '/alg/3bld/lookup', '/alg/3bld/comm', '/alg/sq1/inspect', '/alg/progress', '/alg/commutator',
    '/alg/double-zbll-about', '/alg-trainers', '/tools/alg_trainers/',
  ])('retains the library, reference or upstream page %s', async path => {
    const res = await request(`http://localhost:3000/zh${path}`);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('proxy: 裸路径 → 英文', () => {
  it('直连(没有反代)时透明 rewrite 到 /en,URL 保持裸', async () => {
    const res = await request('http://127.0.0.1:3000/');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/en$/);
  });

  it('挂在终止 TLS 的反代后面时改发 307 → /en,不再 rewrite(否则自代理 EPROTO 500)', async () => {
    const res = await request('https://dev.cuberoot.me/', FORWARDED_HTTPS);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/en$/);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('子路径同样 307 到 /en 下的对应路径', async () => {
    const res = await request('https://dev.cuberoot.me/timer', FORWARDED_HTTPS);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/en\/timer$/);
  });
});

describe('proxy: 其它分支不受影响', () => {
  it('music assets bypass language redirects even with a Chinese cookie', async () => {
    for (const asset of ['tracks/a.mp3', 'lyrics/a.lrc', 'manifest.v1.json']) {
      const res = await request(`http://127.0.0.1:3000/music/library/${asset}`, { cookie: 'lang=zh' });
      expect(res.headers.get('x-middleware-next')).toBe('1');
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    }
  });

  it('/zh 原样服务,不重定向也不 rewrite', async () => {
    const res = await request('https://dev.cuberoot.me/zh', FORWARDED_HTTPS);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
  });

  it('/en 原样服务(不 308 回裸,否则和 rewrite 打架成环)', async () => {
    const res = await request('https://dev.cuberoot.me/en/timer', FORWARDED_HTTPS);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('中文环境访问裸路径仍优先 307 → /zh,与能否 rewrite 无关', async () => {
    const res = await request('https://dev.cuberoot.me/', {
      ...FORWARDED_HTTPS,
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/zh$/);
  });

  it('lang cookie=en 压过中文 Accept-Language,仍走英文分支', async () => {
    const res = await request('https://dev.cuberoot.me/', {
      ...FORWARDED_HTTPS,
      'accept-language': 'zh-CN,zh;q=0.9',
      cookie: 'lang=en',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/en$/);
  });

  it('?lang= 显式切换先落 cookie 再规范化路径', async () => {
    const res = await request('https://dev.cuberoot.me/zh/timer?lang=en', FORWARDED_HTTPS);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/timer$/);
    expect(res.headers.get('set-cookie')).toContain('lang=en');
  });

  it('非 [lang] 树的应用根路由整条放行,不被 rewrite 成 /en/…', async () => {
    const res = await request('https://dev.cuberoot.me/tools/cstimer/', FORWARDED_HTTPS);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
  });
});
