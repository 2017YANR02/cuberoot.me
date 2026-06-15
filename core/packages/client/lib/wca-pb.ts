// WCA 个人记录 (personal_records) — per-WCA-ID, 模块级缓存, 用于 /comp 页面比对 PR。
//
// 注意: WCA API 没有 batch 端点, 每个 WCA ID 一次 fetch ~1s。为避免阻塞 UI,
// 调用方应按可见 round 内的 wcaid 集合 prefetch, 边到边渲染。

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

export interface PbEntry {
  best: number;     // centiseconds (FMC raw moves; 333mbf 编码)
  world_rank: number;
  continental_rank: number;
  national_rank: number;
  // wca_db 路径塞的:best 那条 result 的区域纪录 marker (WR/AsR/NR/...);REST 路径无此字段.
  recordTag?: string;
}

export interface PbByEvent {
  [eventId: string]: {
    single?: PbEntry;
    average?: PbEntry;
  };
}

const cache = new Map<string, Promise<PbByEvent | null>>();

interface ApiPbValue { best?: number; world_rank?: number; continental_rank?: number; national_rank?: number }
interface ApiPbEntry { single?: ApiPbValue; average?: ApiPbValue }
interface ApiResp { personal_records?: Record<string, ApiPbEntry> }

function normPb(v: ApiPbValue | undefined): PbEntry | undefined {
  if (!v || typeof v.best !== 'number') return undefined;
  return {
    best: v.best,
    world_rank: v.world_rank ?? 0,
    continental_rank: v.continental_rank ?? 0,
    national_rank: v.national_rank ?? 0,
  };
}

export function fetchPb(wcaId: string): Promise<PbByEvent | null> {
  const id = wcaId.trim().toUpperCase();
  if (!/^\d{4}[A-Z]{4}\d{2}$/.test(id)) return Promise.resolve(null);
  const hit = cache.get(id);
  if (hit) return hit;
  const url = `${WCA_API_BASE}/persons/${encodeURIComponent(id)}`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : null)
    .then((j: unknown) => {
      if (!j || typeof j !== 'object') return null;
      const pr = (j as ApiResp).personal_records;
      if (!pr) return {};
      const out: PbByEvent = {};
      for (const [ev, entry] of Object.entries(pr)) {
        const s = normPb(entry.single);
        const a = normPb(entry.average);
        out[ev] = { single: s, average: a };
      }
      return out;
    })
    .catch(() => null);
  cache.set(id, p);
  return p;
}

/** 限并发批量预取一组 WCA ID 的 PR。返回 Promise<void>,完成后调用方再读 cache(通过 fetchPb)。 */
export async function prefetchPbs(wcaIds: string[], concurrency = 8): Promise<void> {
  const unique = Array.from(new Set(wcaIds.filter(Boolean)));
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (i < unique.length) {
      const id = unique[i++];
      await fetchPb(id).catch(() => null);
    }
  });
  await Promise.all(workers);
}
