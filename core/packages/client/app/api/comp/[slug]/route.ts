// /api/comp/:slug — 比赛直播数据的边缘缓存代理.
//
// 为什么存在:海外用户的主站 HTML 走 Vercel 边缘很快,但客户端直连
// api.cuberoot.me (单地域自有服务器) 拿比赛数据要跨洋,每请求 1.5-3s 起步
// (缓存命中也躲不掉),正在进行的比赛冷拉上游还要 +3-20s.
//
// 这里在 Vercel 上代理一层并按比赛状态发 Cache-Control:
//   - 全部轮次 finished → 准静态,缓存 1 天 (近零回源,护住 Hobby 配额);
//   - 进行中 → s-maxage=30 + stale-while-revalidate,首个用户付一次跨洋,
//     之后同地区 30s 内全是边缘 HIT (~50-200ms),过期后 SWR 先返旧再后台刷.
// 初始数据只是引导,客户端 WS 实时层随后补丁到最新,所以 30s 旧完全安全.
//
// 配额护栏:只代理这一条全量端点 (一比赛一缓存键);已结束比赛缓存 1 天让回源
// 次数被"正在进行的十来场"封顶,而非全部比赛.source 覆盖 / 手动刷新走客户端
// 直连 SSE,不进这里.

import dns from 'node:dns';

// Node fetch 默认 IPv6-first,api.cuberoot.me 的 AAAA 查询会挂起到超时 (next.config
// 在主进程设过,但 route handler 运行时 / Vercel serverless function 不一定继承,
// 这里在本模块运行时再设一次).
dns.setDefaultResultOrder('ipv4first');

const UPSTREAM = 'https://api.cuberoot.me';

export const maxDuration = 30;

interface MinimalRound { s?: number }
interface MinimalEvent { rs?: MinimalRound[] }

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(slug)) {
    return Response.json({ error: 'invalid slug' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  // 首屏分片:?only=<event> 只要当前项目 (WC2023 380KB → 数 KB)。查询串进边缘缓存键,
  // 分片与全量各自成条目;上游认不出的 only 会自己回全量,这里只做形状校验。
  const only = new URL(req.url).searchParams.get('only');
  const onlyQs = only && /^(auto|[A-Za-z0-9]+(:[A-Za-z0-9]+)?)$/.test(only)
    ? `?only=${encodeURIComponent(only)}`
    : '';

  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}/v1/cubing-live/${encodeURIComponent(slug)}${onlyQs}`, {
      signal: AbortSignal.timeout(28_000),
      headers: { accept: 'application/json' },
    });
  } catch {
    return Response.json({ error: 'upstream error' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }

  if (!upstream.ok) {
    let body = '';
    try { body = await upstream.text(); } catch { /* ignore */ }
    return new Response(body || JSON.stringify({ error: `HTTP ${upstream.status}` }), {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return Response.json({ error: 'bad upstream json' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }

  const events = (data as { events?: unknown })?.events;
  const eventList: MinimalEvent[] = Array.isArray(events) ? (events as MinimalEvent[]) : [];
  const allFinished = eventList.length > 0 &&
    eventList.every(ev => Array.isArray(ev?.rs) && ev.rs!.length > 0 && ev.rs!.every(rd => rd?.s === 1));

  const cacheControl = allFinished
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'public, s-maxage=30, stale-while-revalidate=600';

  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl },
  });
}
