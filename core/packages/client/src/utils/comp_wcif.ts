// 拉取 WCA 比赛公开 WCIF 抽出每个项目的轮次数（rounds.length）。
// 仅用于 CompModal 等"点开比赛"场景；CORS 公开，localStorage 缓存 24h。

const WCIF_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'wcif-rounds-';

interface CacheEntry { t: number; v: Record<string, number>; }

function cacheGet(id: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry;
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet(id: string, v: Record<string, number>): void {
  try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ t: Date.now(), v })); }
  catch { /* quota / private mode */ }
}

const inflight = new Map<string, Promise<Record<string, number>>>();

/** eventId（WCA 标准短码 333/222/...）→ rounds 数。失败返回 {}。 */
export async function fetchCompRounds(compId: string): Promise<Record<string, number>> {
  if (!compId) return {};
  const cached = cacheGet(compId);
  if (cached) return cached;
  const existing = inflight.get(compId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(WCIF_URL(compId));
      if (!res.ok) return {};
      const data = await res.json() as { events?: { id: string; rounds?: unknown[] }[] };
      const out: Record<string, number> = {};
      for (const e of data.events ?? []) {
        out[e.id] = (e.rounds ?? []).length;
      }
      cacheSet(compId, out);
      return out;
    } catch {
      return {};
    } finally {
      inflight.delete(compId);
    }
  })();
  inflight.set(compId, p);
  return p;
}
