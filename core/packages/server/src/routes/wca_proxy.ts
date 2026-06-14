import { Hono } from 'hono';

/**
 * WCA API egress 代理 —— 仅供 CI 的 upcoming / comp-names-zh 抓取脚本使用。
 *
 * 背景:WCA(Cloudflare 后)2026-06-13 起对 GitHub 托管 runner 的数据中心 IP 段返回 403,
 * update_upcoming.yml 因此拉不到比赛数据(只能写空,触发首页选手筛选 / 预排名缺数据)。
 * 本服务器自己的出口 IP 未被封(实测 /api/v0/competitions 返 200),故 CI 改为把 WCA 请求
 * 经此端点转发,由服务器代为出网,再把响应原样回给 runner。
 *
 * 安全:这是公网端点,fail-closed + 收紧攻击面:
 *   - 服务器未配 WCA_PROXY_SECRET → 路由当作不存在(404),功能默认关闭。
 *   - 请求头 X-Proxy-Secret 必须等于该 secret,否则 403。
 *   - 仅 GET;仅放行 /api/v0/competitions 前缀(列表 / 详情 / WCIF public)——抓取脚本唯一会打的端点。
 *   - 目标 host 硬编码 WCA,路径经白名单校验后再拼,杜绝 SSRF / 开放代理。
 *   - 进程级限流安全网,防脚本失控狂打 WCA。
 *   - 响应 no-store,绝不进任何缓存(每日刷新必须见到最新数据)。
 */
const wcaProxyRoutes = new Hono();

const WCA_ORIGIN = 'https://www.worldcubeassociation.org';
// 列表 /api/v0/competitions、详情 /api/v0/competitions/:id、WCIF /api/v0/competitions/:id/wcif/public
const ALLOW_PATH = /^\/api\/v0\/competitions(\/|$)/;

// 进程级限流:secret 是主门,这只是防失控的安全网。一次正常刷新(~553 场分页 + WCIF,
// 多数 WCIF 命中本地缓存)远低于此速率。
const hits: number[] = [];
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 240;

wcaProxyRoutes.get('/wca-proxy/*', async (c) => {
  const expected = process.env.WCA_PROXY_SECRET;
  if (!expected) return c.json({ error: 'not found' }, 404); // fail closed
  if (c.req.header('X-Proxy-Secret') !== expected) return c.json({ error: 'forbidden' }, 403);

  const u = new URL(c.req.url); // 构造时已归一化字面 ..、. 点段
  const after = u.pathname.replace(/^\/v1\/wca-proxy/, ''); // -> /api/v0/competitions/...
  // %2e/%2f 不被 new URL 解码,可能在 WCA 侧被还原成 ./ 逃出白名单 → 直接拒
  // (合法 comp 路径全是字母数字 id,无编码字符)。
  if (/%2[ef]/i.test(after)) return c.json({ error: 'path not allowed' }, 403);
  if (!ALLOW_PATH.test(after)) return c.json({ error: 'path not allowed' }, 403);

  const target = WCA_ORIGIN + after + u.search;
  // 纵深防御:复核拼好的 URL,host 必须仍是 WCA、路径仍在白名单内,挡掉任何点段 / 协议相对逃逸残留。
  const tu = new URL(target);
  if (tu.origin !== WCA_ORIGIN || !ALLOW_PATH.test(tu.pathname)) return c.json({ error: 'path not allowed' }, 403);

  const now = Date.now();
  while (hits.length && hits[0]! < now - RATE_WINDOW_MS) hits.shift();
  if (hits.length >= RATE_MAX) return c.json({ error: 'rate limited' }, 429);
  hits.push(now);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const upstream = await fetch(target, {
      // 转发 runner 的 UA(与本地直连一致);secret 头不外传给 WCA。
      headers: { 'User-Agent': c.req.header('User-Agent') ?? 'cuberoot-wca-proxy/1.0' },
      redirect: 'manual', // WCA API 直接 200,不跟随重定向(防跟到非白名单 / 外部 Location)
      signal: ctrl.signal,
    });
    // 防超大响应全缓冲打爆内存(WCA 锦标赛 WCIF 至多数 MB,64MB 是宽松上限)。
    if (Number(upstream.headers.get('content-length') ?? 0) > 64 * 1024 * 1024) {
      return c.json({ error: 'upstream too large' }, 502);
    }
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return c.json({ error: `upstream fetch failed: ${(e as Error).message}` }, 502);
  } finally {
    clearTimeout(timer);
  }
});

export { wcaProxyRoutes };
