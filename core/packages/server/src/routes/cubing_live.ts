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
import { streamSSE } from 'hono/streaming';
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
  slug: string;     // WCA ID (无横杠),规范形态
  cubingSlug?: string; // cubing.com 用的 dash slug;source=wca 时无
  source: 'cubing' | 'wca';
  /** 这场比赛两边都有数据时给前端展示数据源切换器 */
  availableSources?: ('cubing' | 'wca')[];
  compId: number;
  name: string;
  type: string;     // "WCA" / "Non-WCA"
  events: EventMeta[];
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>; // key = "<event>:<round>"
  membersByFilter: MembersByFilter; // 哪些 user number 属于 females / children / newcomers
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

interface MembersByFilter {
  females: number[];
  children: number[];
  newcomers: number[];
}

interface WsCollectResult {
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>;
  membersByFilter: MembersByFilter;
}

type SecondaryFilter = 'females' | 'children' | 'newcomers';

export interface ProgressEvent {
  step: 'meta' | 'cubing.results' | 'cubing.filter' | 'wca.fetch' | 'wca.transform';
  filter?: SecondaryFilter;
  done: number;
  total: number;
}
export type ProgressFn = (p: ProgressEvent) => void;

async function collectCompData(compId: number, events: EventMeta[], onProgress?: ProgressFn, timeoutMs = 25000): Promise<WsCollectResult> {
  const ws = await openCubingWs();
  const result: WsCollectResult = {
    users: {},
    resultsByRound: {},
    membersByFilter: { females: [], children: [], newcomers: [] },
  };

  const rounds: { e: string; r: string }[] = [];
  for (const ev of events) {
    for (const rd of ev.rs) {
      // Skip rounds that have 0 results to save time on huge comps
      if (rd.rn === 0 && rd.s !== 2) continue;
      rounds.push({ e: ev.i, r: rd.i });
    }
  }

  // cubing.com 不在 result.all 消息里回传 filter,只能"一次只跑一个 filter"分相,
  // 收齐这相的所有 round 响应再发下一相 — 共 4 相 (all + 3 secondary)。
  type Phase = { filter: 'all' | SecondaryFilter; pending: Set<string>; received: number; done: () => void };
  let currentPhase: Phase | null = null;
  let gotUsers = false;

  await new Promise<void>((resolve, reject) => {
    const finish = (err?: Error) => {
      try { ws.close(); } catch {}
      if (err) reject(err); else resolve();
    };
    const overallTimeout = setTimeout(() => {
      finish(new Error(`WS collect timeout; phase=${currentPhase?.filter}, gotUsers=${gotUsers}`));
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
        return;
      }
      if (msg.type !== 'result.all' || !Array.isArray(msg.data)) return;
      if (!currentPhase) return;

      const arr = msg.data as LiveResult[];
      currentPhase.received += 1;

      if (currentPhase.filter === 'all') {
        if (arr.length > 0) {
          const key = `${arr[0].e}:${arr[0].r}`;
          result.resultsByRound[key] = arr;
        }
      } else {
        const bucket = result.membersByFilter[currentPhase.filter];
        for (const r of arr) if (!bucket.includes(r.n)) bucket.push(r.n);
      }

      try {
        onProgress?.({
          step: currentPhase.filter === 'all' ? 'cubing.results' : 'cubing.filter',
          filter: currentPhase.filter === 'all' ? undefined : currentPhase.filter,
          done: currentPhase.received,
          total: currentPhase.pending.size,
        });
      } catch { /* progress 异常不影响主流程 */ }

      if (currentPhase.received >= currentPhase.pending.size) {
        currentPhase.done();
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

    const runPhase = (filter: 'all' | SecondaryFilter) => new Promise<void>((res) => {
      currentPhase = {
        filter,
        pending: new Set(rounds.map(r => `${r.e}:${r.r}`)),
        received: 0,
        done: res,
      };
      for (const r of rounds) {
        ws.send(JSON.stringify({ type: 'result', action: 'fetch', params: { event: r.e, round: r.r, filter } }));
      }
    });

    (async () => {
      ws.send(JSON.stringify({ type: 'competition', competitionId: compId }));
      await runPhase('all');
      // secondary filters: 缺数据不致命,单相 timeout 用全局 overallTimeout 兜底
      for (const f of ['females', 'children', 'newcomers'] as const) {
        await runPhase(f);
      }
      clearTimeout(overallTimeout);
      finish();
    })().catch((e) => finish(e as Error));
  });

  return result;
}

// ─── Cache ─────────────────────────────────────────────────────────────────

const CUBING_CACHE_TTL_MS = 60_000;      // cubing.com 直播,1 分钟兜底
const WCA_CACHE_TTL_MS = 60 * 60_000;    // WCA 静态数据,1 小时
const cache = new Map<string, CompData>();
const inflight = new Map<string, Promise<CompData>>();

function ttlFor(source: 'cubing' | 'wca'): number {
  return source === 'wca' ? WCA_CACHE_TTL_MS : CUBING_CACHE_TTL_MS;
}

/** WCA ID (e.g. XuzhouZenith2026) → cubing.com slug (Xuzhou-Zenith-2026)。
 *  在小写↔大写、字母↔数字边界插横杠。绝大多数 cubing.com slug 都是这个规则。 */
function wcaIdToCubingSlug(wcaId: string): string {
  return wcaId
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2');
}

// ─── WCA API fallback (non-cubing.com comps) ──────────────────────────────

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

interface WcaCompMeta { id: string; name: string; event_ids?: string[]; }
interface WcaResultRow {
  id: number; round_id: number; pos: number;
  best: number; average: number;
  name: string; country_iso2: string; wca_id: string;
  competition_id: string; event_id: string; round_type_id: string; format_id: string;
  attempts: number[];
  regional_single_record: string | null;
  regional_average_record: string | null;
}

const ROUND_ORDER: Record<string, number> = {
  d: 0, '1': 1, e: 2, '2': 3, g: 4, '3': 5, c: 6, b: 7, f: 8, h: 9,
};
const ROUND_NAME: Record<string, string> = {
  '1': 'First round',
  '2': 'Second round',
  '3': 'Semi Final',
  f: 'Final',
  d: 'First round',
  e: 'Second round',
  g: 'Semi Final',
  c: 'Final',
  b: 'B Final',
  h: 'Final',
};

async function loadFromWca(wcaId: string, onProgress?: ProgressFn): Promise<CompData> {
  onProgress?.({ step: 'wca.fetch', done: 0, total: 2 });
  const [metaRes, resultsRes] = await Promise.all([
    fetch(`${WCA_API_BASE}/competitions/${encodeURIComponent(wcaId)}`),
    fetch(`${WCA_API_BASE}/competitions/${encodeURIComponent(wcaId)}/results`),
  ]);
  if (!metaRes.ok) throw new Error(`WCA meta HTTP ${metaRes.status}`);
  if (!resultsRes.ok) throw new Error(`WCA results HTTP ${resultsRes.status}`);
  const meta = await metaRes.json() as WcaCompMeta;
  const results = await resultsRes.json() as WcaResultRow[];
  onProgress?.({ step: 'wca.fetch', done: 2, total: 2 });
  onProgress?.({ step: 'wca.transform', done: 0, total: 1 });

  // Users — competitor number 用自增序号(WCA 没有 number 概念)
  const users: Record<string, User> = {};
  const numByWcaId = new Map<string, number>();
  for (const r of results) {
    if (!r.wca_id) continue;
    if (numByWcaId.has(r.wca_id)) continue;
    const n = numByWcaId.size + 1;
    numByWcaId.set(r.wca_id, n);
    users[String(n)] = {
      number: n,
      name: r.name,
      wcaid: r.wca_id,
      region: r.country_iso2 ? r.country_iso2.toLowerCase() : '',
    };
  }

  // Events + rounds (从 results 反推)
  const eventMap = new Map<string, EventMeta>();
  for (const r of results) {
    let ev = eventMap.get(r.event_id);
    if (!ev) {
      ev = { i: r.event_id, name: r.event_id, rs: [] };
      eventMap.set(r.event_id, ev);
    }
    let rd = ev.rs.find(x => x.i === r.round_type_id);
    if (!rd) {
      rd = {
        i: r.round_type_id, e: r.event_id, f: r.format_id,
        co: 0, tl: 0, n: 0, s: 1, rn: 0, tt: 0,
        name: ROUND_NAME[r.round_type_id] || r.round_type_id,
      };
      ev.rs.push(rd);
    }
    rd.rn += 1;
    rd.tt = rd.rn;
  }
  for (const ev of eventMap.values()) {
    ev.rs.sort((a, b) => (ROUND_ORDER[a.i] ?? 99) - (ROUND_ORDER[b.i] ?? 99));
  }
  // Order events as listed in meta.event_ids (官方顺序),其余 fallback 按 results 出现序
  const evIds = meta.event_ids ?? [...eventMap.keys()];
  const events: EventMeta[] = [];
  for (const id of evIds) {
    const ev = eventMap.get(id);
    if (ev) events.push(ev);
  }
  for (const ev of eventMap.values()) {
    if (!events.includes(ev)) events.push(ev);
  }

  // resultsByRound
  const resultsByRound: Record<string, LiveResult[]> = {};
  for (const r of results) {
    const key = `${r.event_id}:${r.round_type_id}`;
    if (!resultsByRound[key]) resultsByRound[key] = [];
    const n = numByWcaId.get(r.wca_id) ?? 0;
    resultsByRound[key].push({
      i: r.id, c: 0, n,
      e: r.event_id, r: r.round_type_id, f: r.format_id,
      b: r.best, a: r.average, v: r.attempts ?? [],
      sr: r.regional_single_record ?? '',
      ar: r.regional_average_record ?? '',
    });
  }
  onProgress?.({ step: 'wca.transform', done: 1, total: 1 });

  return {
    slug: wcaId,
    source: 'wca',
    compId: 0,
    name: meta.name,
    type: 'WCA',
    events,
    users,
    resultsByRound,
    membersByFilter: { females: [], children: [], newcomers: [] },
    fetchedAt: Date.now(),
  };
}

async function loadFromCubing(wcaId: string, onProgress?: ProgressFn, prefetchedMeta?: ScrapedMeta): Promise<CompData> {
  const cubingSlug = wcaIdToCubingSlug(wcaId);
  let meta: ScrapedMeta;
  if (prefetchedMeta) {
    meta = prefetchedMeta;
    onProgress?.({ step: 'meta', done: 1, total: 1 });
  } else {
    onProgress?.({ step: 'meta', done: 0, total: 1 });
    meta = await scrapeMeta(cubingSlug);
    onProgress?.({ step: 'meta', done: 1, total: 1 });
  }
  const { users, resultsByRound, membersByFilter } = await collectCompData(meta.compId, meta.events, onProgress);
  return {
    slug: wcaId,
    cubingSlug,
    source: 'cubing',
    compId: meta.compId,
    name: meta.name,
    type: meta.type,
    events: meta.events,
    users,
    resultsByRound,
    membersByFilter,
    fetchedAt: Date.now(),
  };
}

// ─── Source probing ───────────────────────────────────────────────────────

const PROBE_TTL_MS = 5 * 60_000;
interface ProbeResult { wca: boolean; cubingMeta: ScrapedMeta | null; at: number }
const probeCache = new Map<string, ProbeResult>();

async function probeSources(wcaId: string): Promise<ProbeResult> {
  const hit = probeCache.get(wcaId);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit;
  const [wca, cubingMeta] = await Promise.all([
    fetch(`${WCA_API_BASE}/competitions/${encodeURIComponent(wcaId)}`, { method: 'HEAD' })
      .then(r => r.ok).catch(() => false),
    scrapeMeta(wcaIdToCubingSlug(wcaId)).catch(() => null),
  ]);
  const result: ProbeResult = { wca, cubingMeta, at: Date.now() };
  probeCache.set(wcaId, result);
  return result;
}

type SourceChoice = 'auto' | 'wca' | 'cubing';

async function loadComp(wcaId: string, choice: SourceChoice = 'auto', onProgress?: ProgressFn): Promise<CompData> {
  const probe = await probeSources(wcaId);
  const availableSources: ('wca' | 'cubing')[] = [];
  if (probe.wca) availableSources.push('wca');
  if (probe.cubingMeta) availableSources.push('cubing');
  if (availableSources.length === 0) throw new Error('Not found on WCA or cubing.com');

  let useSource: 'wca' | 'cubing';
  if (choice === 'auto') {
    useSource = availableSources.includes('wca') ? 'wca' : 'cubing';
  } else if (!availableSources.includes(choice)) {
    throw new Error(`No data on ${choice}`);
  } else {
    useSource = choice;
  }

  const cacheKey = `${wcaId}:${useSource}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ttlFor(cached.source)) {
    return { ...cached, availableSources };
  }

  // inflight 去重(非流式)
  if (!onProgress) {
    const pending = inflight.get(cacheKey);
    if (pending) return pending.then(d => ({ ...d, availableSources }));
  }

  const p = (async () => {
    const data = useSource === 'wca'
      ? await loadFromWca(wcaId, onProgress)
      : await loadFromCubing(wcaId, onProgress, probe.cubingMeta || undefined);
    data.availableSources = availableSources;
    cache.set(cacheKey, data);
    return data;
  })().finally(() => { if (!onProgress) inflight.delete(cacheKey); });

  if (!onProgress) inflight.set(cacheKey, p);
  return p;
}

// ─── Routes ────────────────────────────────────────────────────────────────

function parseSource(s: string | undefined): SourceChoice {
  if (s === 'wca' || s === 'cubing') return s;
  return 'auto';
}

cubingLiveRoutes.get('/cubing-live-stream/:slug', async (c) => {
  const raw = c.req.param('slug');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(raw)) return c.json({ error: 'invalid slug' }, 400);
  const wcaId = raw.replace(/-/g, '');
  const source = parseSource(c.req.query('source'));

  return streamSSE(c, async (stream) => {
    const onProgress: ProgressFn = (p) => {
      stream.writeSSE({ event: 'progress', data: JSON.stringify(p) }).catch(() => {});
    };

    try {
      const data = await loadComp(wcaId, source, onProgress);
      await stream.writeSSE({ event: 'done', data: JSON.stringify(data) });
    } catch (e) {
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: (e as Error).message }) });
    }
  });
});

cubingLiveRoutes.get('/cubing-live/:slug', async (c) => {
  const raw = c.req.param('slug');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(raw)) return c.json({ error: 'invalid slug' }, 400);
  const wcaId = raw.replace(/-/g, '');
  const source = parseSource(c.req.query('source'));
  try {
    const data = await loadComp(wcaId, source);
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    return c.json({ error: msg }, 502);
  }
});
