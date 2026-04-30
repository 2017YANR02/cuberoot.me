// 拉取 WCA 比赛公开 WCIF 抽出每个项目每轮的 format。
// 仅用于 CompModal / Recon 录入等"点开比赛"场景；CORS 公开，localStorage 缓存 24h。

const WCIF_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// NOTE: v2 — 返回结构从 Record<eid, count> 升级到 Record<eid, RoundFormat[]>，bump 让旧缓存自然失效
const CACHE_PREFIX = 'wcif-rounds-v2-';

/** WCIF round.format 取值 — 见 https://github.com/thewca/worldcubeassociation.org/blob/main/lib/static_data/formats.json */
export type RoundFormat = '1' | '2' | '3' | '5' | 'a' | 'm' | 'h';

const VALID_FORMATS: ReadonlySet<string> = new Set(['1', '2', '3', '5', 'a', 'm', 'h']);

interface CacheEntry { t: number; v: Record<string, RoundFormat[]>; }

function cacheGet(id: string): Record<string, RoundFormat[]> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry;
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet(id: string, v: Record<string, RoundFormat[]>): void {
  try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ t: Date.now(), v })); }
  catch { /* quota / private mode */ }
}

const inflight = new Map<string, Promise<Record<string, RoundFormat[]>>>();

/** eventId（WCA 标准短码 333/222/...）→ 每轮的 format 数组（数组长度 = rounds 数）。失败返回 {}。 */
export async function fetchCompRounds(compId: string): Promise<Record<string, RoundFormat[]>> {
  if (!compId) return {};
  const cached = cacheGet(compId);
  if (cached) return cached;
  const existing = inflight.get(compId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(WCIF_URL(compId));
      if (!res.ok) return {};
      const data = await res.json() as { events?: { id: string; rounds?: { format?: string }[] }[] };
      const out: Record<string, RoundFormat[]> = {};
      for (const e of data.events ?? []) {
        out[e.id] = (e.rounds ?? []).map(r => {
          const f = r.format;
          return (f && VALID_FORMATS.has(f)) ? (f as RoundFormat) : '1';
        });
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
