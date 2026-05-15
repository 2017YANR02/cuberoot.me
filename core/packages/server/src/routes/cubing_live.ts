/**
 * /v1/cubing-live/* — cubing.com 比赛直播数据接口。
 *   GET /v1/cubing-live/:slug         — 元数据 (compId, 比赛名, events, users) + 全部 round 结果
 *
 * 流程: 抓 /live/{slug} HTML 拿 data-c (competition id) + data-events;
 *       连 wss://cubing.com/ws,subscribe competition,fetch result.all 所有 round。
 *
 * Cache: in-memory 60s。比赛实时刷新但 60s 粒度够看。
 */
import { Hono } from 'hono';
import WebSocket from 'ws';

export const cubingLiveRoutes = new Hono();

// ─── 类型 ──────────────────────────────────────────────────────────────────

interface User {
  number: number;
  name: string;
  wcaid: string;
  region: string;
}

interface RoundMeta {
  i: string;        // round id (1/2/3/f/d/etc)
  e: string;        // event id (333/222/...)
  f: string;        // format (a/m/1/2/3/5)
  co: number;       // cutoff (seconds)
  tl: number;       // time limit (seconds)
  n: number;        // advance count
  s: number;        // status (0=open, 1=finished, 2=live)
  rn: number;       // result count
  tt: number;       // total attempts
  name: string;     // "First round" / "Final" / etc
  allStatus?: string[];
}

interface EventMeta {
  i: string;        // event id
  name: string;     // "3x3x3 Cube"
  rs: RoundMeta[];  // rounds in chronological order
}

interface LiveResult {
  i: number;        // result id
  c: number;        // competition id
  n: number;        // competitor number
  e: string;        // event id
  r: string;        // round id
  f: string;        // format
  b: number;        // best (centiseconds)
  a: number;        // average (centiseconds)
  v: number[];      // attempts (centiseconds)
  sr: string;       // single record marker
  ar: string | number; // average record marker
}

interface CompData {
  slug: string;
  compId: number;
  name: string;
  type: string;     // "WCA" / "Non-WCA"
  events: EventMeta[];
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>; // key = "<event>:<round>"
  fetchedAt: number;
}

// ─── HTML scraping ─────────────────────────────────────────────────────────

const CUBING_BASE = 'https://cubing.com';

function attrFromHtml(html: string, attr: string): string | null {
  // simple data-* extractor that is robust to attribute order
  const re = new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`);
  const m = html.match(re);
  if (!m) return null;
  return decodeHtmlEntities(m[1]);
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

interface ScrapedMeta {
  compId: number;
  name: string;
  type: string;
  events: EventMeta[];
}

async function scrapeMeta(slug: string): Promise<ScrapedMeta> {
  // Force English locale + a real-browser UA so cubing.com renders the full
  // English HTML with data-events embedded (Chinese locale strips events to null).
  const res = await fetch(`${CUBING_BASE}/live/${encodeURIComponent(slug)}?lang=en`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`cubing.com returned ${res.status} for /live/${slug}`);
  const html = await res.text();

  // Find #live-container and read its data-* attrs. The data-* attrs come AFTER
  // the id= within the same <div ...> opening tag — slice from a bit before the
  // id (to keep the start of the opening tag) through ~16KB after (data-events
  // alone is ~7KB and stages can be larger for big comps).
  const idx = html.indexOf('id="live-container"');
  if (idx < 0) throw new Error('live-container not found (slug may be invalid or has no live page)');
  const start = Math.max(0, idx - 200);
  const end = Math.min(html.length, idx + 16000);
  const block = html.slice(start, end);

  const cRaw = attrFromHtml(block, 'data-c');
  const eventsRaw = attrFromHtml(block, 'data-events');
  const typeRaw = attrFromHtml(block, 'data-type');
  if (!cRaw || !eventsRaw || eventsRaw === 'null') {
    throw new Error('live-container missing data-c / data-events (locale or slug issue)');
  }

  const compId = Number(cRaw);
  if (!Number.isFinite(compId)) throw new Error(`invalid compId: ${cRaw}`);

  let events: EventMeta[];
  try {
    events = JSON.parse(eventsRaw);
  } catch (e) {
    throw new Error(`failed to parse data-events: ${(e as Error).message}`);
  }

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  let name = titleMatch ? titleMatch[1].trim() : slug;
  // "Xi'an Cherry Blossom 2026 - Live - Cubing China" → "Xi'an Cherry Blossom 2026"
  name = name.replace(/\s*-\s*Live\s*-\s*Cubing China\s*$/i, '');

  return { compId, name, type: typeRaw || 'WCA', events };
}

// ─── WS fetch ──────────────────────────────────────────────────────────────

interface WsMessage {
  code?: number;
  type?: string;
  data?: unknown;
}

function openCubingWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://cubing.com/ws', {
      headers: {
        'Origin': 'https://cubing.com',
        'User-Agent': 'Mozilla/5.0 (compatible; cuberoot-me/1.0)',
      },
    });
    const t = setTimeout(() => {
      ws.terminate();
      reject(new Error('WS open timeout'));
    }, 10000);
    ws.once('open', () => { clearTimeout(t); resolve(ws); });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

interface WsCollectResult {
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>;
}

async function collectCompData(compId: number, events: EventMeta[], timeoutMs = 25000): Promise<WsCollectResult> {
  const ws = await openCubingWs();
  const result: WsCollectResult = { users: {}, resultsByRound: {} };

  const rounds: { e: string; r: string }[] = [];
  for (const ev of events) {
    for (const rd of ev.rs) {
      // Skip rounds that have 0 results to save time on huge comps
      if (rd.rn === 0 && rd.s !== 2) continue;
      rounds.push({ e: ev.i, r: rd.i });
    }
  }

  let pendingRounds = new Set(rounds.map(r => `${r.e}:${r.r}`));
  let gotUsers = false;

  await new Promise<void>((resolve, reject) => {
    const finish = (err?: Error) => {
      try { ws.close(); } catch {}
      if (err) reject(err); else resolve();
    };
    const overallTimeout = setTimeout(() => {
      finish(new Error(`WS collect timeout; missing rounds=${pendingRounds.size}, gotUsers=${gotUsers}`));
    }, timeoutMs);

    ws.on('message', (raw: WebSocket.RawData) => {
      let msg: WsMessage;
      try {
        const text = raw.toString();
        if (text === '"pong"' || text === 'pong') return;
        msg = JSON.parse(text);
      } catch { return; }
      if (msg.code !== 200) return;

      if (msg.type === 'users' && msg.data && typeof msg.data === 'object') {
        result.users = msg.data as Record<string, User>;
        gotUsers = true;
      } else if (msg.type === 'result.all' && Array.isArray(msg.data)) {
        const arr = msg.data as LiveResult[];
        if (arr.length > 0) {
          const key = `${arr[0].e}:${arr[0].r}`;
          result.resultsByRound[key] = arr;
          pendingRounds.delete(key);
        } else {
          // empty round → drop one pending key (we don't know which from the data alone)
          // we'll let timeout handle this; for empty rounds we already skipped above
        }
      }

      if (gotUsers && pendingRounds.size === 0) {
        clearTimeout(overallTimeout);
        finish();
      }
    });

    ws.once('close', () => {
      clearTimeout(overallTimeout);
      if (!gotUsers) finish(new Error('WS closed before users received'));
      else resolve();
    });
    ws.once('error', (e) => {
      clearTimeout(overallTimeout);
      finish(e as Error);
    });

    // Subscribe to competition
    ws.send(JSON.stringify({ type: 'competition', competitionId: compId }));
    // Fetch each round's results. Stagger so the server doesn't reject as flood.
    for (const r of rounds) {
      ws.send(JSON.stringify({ type: 'result', action: 'fetch', params: { event: r.e, round: r.r, filter: 'all' } }));
    }
  });

  return result;
}

// ─── Cache ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CompData>();
const inflight = new Map<string, Promise<CompData>>();

async function loadComp(slug: string): Promise<CompData> {
  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const pending = inflight.get(slug);
  if (pending) return pending;

  const p = (async () => {
    const meta = await scrapeMeta(slug);
    const { users, resultsByRound } = await collectCompData(meta.compId, meta.events);
    const data: CompData = {
      slug,
      compId: meta.compId,
      name: meta.name,
      type: meta.type,
      events: meta.events,
      users,
      resultsByRound,
      fetchedAt: Date.now(),
    };
    cache.set(slug, data);
    return data;
  })().finally(() => inflight.delete(slug));

  inflight.set(slug, p);
  return p;
}

// ─── Routes ────────────────────────────────────────────────────────────────

cubingLiveRoutes.get('/cubing-live/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(slug)) return c.json({ error: 'invalid slug' }, 400);
  try {
    const data = await loadComp(slug);
    // public cache 30s on edge so repeated viewers hit nginx cache, not us
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    return c.json({ error: msg }, 502);
  }
});
