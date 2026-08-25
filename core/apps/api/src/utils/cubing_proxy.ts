/**
 * cubing.com 实时成绩代理
 * - 抓 HTML 拿 data-c="<内部 id>" + 接收 cookies
 * - WebSocket 连 wss://cubing.com/ws,带 cookies + 真实 UA(否则 403)
 * - 发 {type:competition,competitionId} + {type:result,action:fetch,params}
 * - 收 users 事件(选手注册列表) + result.all 事件(整轮成绩,centisecond 整数)
 * - 缓存:slug→compId 1h,(slug,event,round)→roundData 5min(避免 WS 反复连)
 */
import WebSocket from 'ws';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const COMP_TTL = 60 * 60 * 1000;     // 1h
const RESULTS_TTL = 5 * 60 * 1000;   // 5min
const WS_TIMEOUT = 8000;
const HTML_TIMEOUT = 10000;

interface CubingUser {
  number: number;
  name: string;
  wcaid: string;
}

interface CubingResultRow {
  n: number;
  e: string;
  r: string;
  v: number[];
}

interface RoundData {
  users: Record<string, CubingUser>;
  results: CubingResultRow[];
}

interface CompMeta {
  id: number;
  cookies: string;
}

const compMetaCache = new Map<string, { val: CompMeta | null; expiresAt: number }>();
const roundCache = new Map<string, { val: RoundData | null; expiresAt: number }>();

async function tryFetchCompMeta(slug: string): Promise<CompMeta | null> {
  try {
    const res = await fetch(`https://cubing.com/live/${encodeURIComponent(slug)}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(HTML_TIMEOUT),
    });
    if (!res.ok) {
      console.error(`[cubing_proxy] HTML ${res.status} for slug=${slug}`);
      return null;
    }
    const html = await res.text();
    const m = html.match(/data-c="(\d+)"/);
    if (!m) {
      console.error(`[cubing_proxy] no data-c in HTML for slug=${slug}`);
      return null;
    }
    const id = Number(m[1]);
    const setCookies = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    const cookies = setCookies.map(c => c.split(';')[0]).join('; ');
    return { id, cookies };
  } catch (err) {
    console.error(`[cubing_proxy] HTML fetch failed for slug=${slug}:`, err);
    return null;
  }
}

async function getCompMeta(slug: string): Promise<CompMeta | null> {
  const cached = compMetaCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.val;

  // NOTE: 先按用户给的 slug(通常已是 dash-case),失败再 fallback 到去掉 dash 的形式
  let meta = await tryFetchCompMeta(slug);
  if (!meta) {
    const flat = slug.replace(/-/g, '');
    if (flat !== slug) {
      console.error(`[cubing_proxy] retrying with flat slug=${flat}`);
      meta = await tryFetchCompMeta(flat);
    }
  }
  compMetaCache.set(slug, { val: meta, expiresAt: Date.now() + (meta ? COMP_TTL : 60_000) });
  return meta;
}

function fetchRoundOverWs(meta: CompMeta, event: string, round: string): Promise<RoundData | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://cubing.com/ws', {
      headers: {
        'Origin': 'https://cubing.com',
        'User-Agent': UA,
        'Cookie': meta.cookies,
      },
    });

    let users: Record<string, CubingUser> | null = null;
    let results: CubingResultRow[] | null = null;
    let done = false;

    const finish = (data: RoundData | null) => {
      if (done) return;
      done = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve(data);
    };

    const timer = setTimeout(() => finish(null), WS_TIMEOUT);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'competition', competitionId: meta.id }));
      ws.send(JSON.stringify({ type: 'result', action: 'fetch', params: { event, round, filter: 'all' } }));
    });

    ws.on('message', (raw) => {
      const txt = raw.toString();
      if (txt === 'pong') return;
      try {
        const j = JSON.parse(txt);
        if (j.code !== 200) return;
        if (j.type === 'users' && j.data) {
          users = j.data;
        } else if (j.type === 'result.all' && Array.isArray(j.data)) {
          results = j.data;
        }
        if (users && results !== null) {
          clearTimeout(timer);
          finish({ users, results });
        }
      } catch { /* ignore parse error */ }
    });

    ws.on('error', (err) => { console.error('[cubing_proxy] ws err:', err.message); clearTimeout(timer); finish(null); });
    ws.on('close', (code, reason) => { if (!users || !results) console.error(`[cubing_proxy] ws closed before data, code=${code} reason=${reason}`); clearTimeout(timer); });
  });
}

async function getRoundData(slug: string, event: string, round: string): Promise<RoundData | null> {
  const key = `${slug}|${event}|${round}`;
  const cached = roundCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.val;

  const meta = await getCompMeta(slug);
  if (!meta) {
    roundCache.set(key, { val: null, expiresAt: Date.now() + 60_000 });
    return null;
  }
  const data = await fetchRoundOverWs(meta, event, round);
  // NOTE: null 也 cache 1min,避免短时间反复打
  roundCache.set(key, { val: data, expiresAt: Date.now() + (data ? RESULTS_TTL : 60_000) });
  return data;
}

/** 取整轮成绩,匹配选手 wca_id；返回 (秒|null)[] DNF=-1 DNS=-2 缺失=null,失败返回 null */
export async function fetchCubingAttempts(
  slug: string,
  event: string,
  round: string,
  personId: string,
): Promise<(number | null)[] | null> {
  const data = await getRoundData(slug, event, round);
  if (!data) return null;
  const user = Object.values(data.users).find(u => u.wcaid === personId);
  if (!user) return null;
  const row = data.results.find(r => r.n === user.number && r.e === event && r.r === round);
  if (!row || !Array.isArray(row.v)) return null;
  return row.v.map(v => {
    if (v === 0) return null;
    if (v < 0) return v;
    return v / 100;
  });
}
