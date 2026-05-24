/**
 * /v1/wca/recent-records — WCA Live "recent records" 镜像
 *
 * WCA Live (https://live.worldcubeassociation.org/) GraphQL `recentRecords`:
 * 默认 10 天内 WR/CR/NR,落地页右下角列表展示。
 *
 * 同步策略:服务器后台每 60s 拉一次 GraphQL → 内存快照;端点直接吐快照,
 * 不阻塞请求。nginx 再 proxy_cache 60s 兜底,所以单实例 1 req/min 上游负载。
 * 用户从 WCA Live 更新到我方页面同步:最大 ≤60s。
 */
import { Hono } from 'hono';

export const wcaRecentRecordsRoutes = new Hono();

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';
const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

// 与 WCA Live RecordList/fragments.jsx 同形;仅保留前端展示需要的字段
export interface RecentRecord {
  id: string;
  tag: 'WR' | 'CR' | 'NR' | string;
  type: 'single' | 'average' | string;
  attemptResult: number;
  eventId: string;
  eventName: string;
  personName: string;
  countryIso2: string;
  countryName: string;
  competitionId: string; // WCA ID, e.g. "FMCAsia2026"
}

interface Snapshot {
  fetchedAt: number;
  records: RecentRecord[];
}

let snapshot: Snapshot = { fetchedAt: 0, records: [] };
let inflight: Promise<void> | null = null;

const QUERY = `
  query RecentRecords {
    recentRecords {
      id
      tag
      type
      attemptResult
      result {
        person {
          name
          country { iso2 name }
        }
        round {
          competitionEvent {
            event { id name }
            competition { id }
          }
        }
      }
    }
  }
`;

interface RawRecord {
  id: string;
  tag: string;
  type: string;
  attemptResult: number;
  result: {
    person: { name: string; country: { iso2: string; name: string } };
    round: {
      competitionEvent: {
        event: { id: string; name: string };
        competition: { id: string };
      };
    };
  };
}

async function fetchOnce(): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    });
    if (!res.ok) throw new Error(`WCA Live HTTP ${res.status}`);
    const j = await res.json() as { data?: { recentRecords?: RawRecord[] }; errors?: { message: string }[] };
    if (j.errors?.length) throw new Error(`WCA Live: ${j.errors[0].message}`);
    const raw = j.data?.recentRecords ?? [];
    snapshot = {
      fetchedAt: Date.now(),
      records: raw.map(r => ({
        id: r.id,
        tag: r.tag,
        type: r.type,
        attemptResult: r.attemptResult,
        eventId: r.result.round.competitionEvent.event.id,
        eventName: r.result.round.competitionEvent.event.name,
        personName: r.result.person.name,
        countryIso2: r.result.person.country.iso2,
        countryName: r.result.person.country.name,
        competitionId: r.result.round.competitionEvent.competition.id,
      })),
    };
  } finally {
    clearTimeout(t);
  }
}

function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchOnce()
    .catch(err => {
      console.warn('[recent-records] poll failed:', (err as Error).message);
    })
    .finally(() => { inflight = null; });
  return inflight;
}

// 启动:立即拉一次,然后每 60s 重拉
export function startRecentRecordsPoller(): void {
  refresh();
  setInterval(refresh, POLL_INTERVAL_MS);
}

wcaRecentRecordsRoutes.get('/wca/recent-records', (c) => {
  // 首请求若 snapshot 还空,触发一次拉取(不阻塞 — 直接返当前 records,可能为 [])
  if (snapshot.fetchedAt === 0) refresh();
  // 60s cache — nginx 已显式 proxy_cache_valid 200 60s,这里给浏览器/CDN 兜底
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=60');
  return c.json({
    fetchedAt: snapshot.fetchedAt,
    records: snapshot.records,
  });
});
