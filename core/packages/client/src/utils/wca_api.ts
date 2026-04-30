/**
 * WCA 公开 persons / users API（无 auth）
 * - GET /api/v0/persons?q={q}            — 名字 / WCA ID 模糊搜索,返回数组(包顶层),limit 参数被服务端忽略
 * - GET /api/v0/persons/{wcaId}          — 单人精确查,200 / 404
 * - GET /api/v0/users/{wcaId}?upcoming_competitions=true — 拉某人的未来已注册比赛
 *
 * 缓存: 模块级 Map<key, Promise<T>>,弱限流且 TTL 由 WCA 服务端保证。
 */

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

export interface WcaPersonLite {
  id: string;             // WCA ID 如 '2026MEDU01'
  name: string;           // 可能含括号本地名 'Yiheng Wang (王艺衡)'
  country_iso2: string;
}

export const WCA_ID_REGEX = /^\d{4}[A-Z]{4}\d{2}$/;

interface PersonsApiItem {
  person?: {
    wca_id?: string | null;
    id?: string;
    name?: string;
    country_iso2?: string;
    country?: { iso2?: string } | null;
  };
}

interface UserUpcomingApi {
  upcoming_competitions?: { id: string }[];
}

interface PersonGetApi {
  person?: {
    wca_id?: string | null;
    id?: string;
    name?: string;
    country_iso2?: string;
    country?: { iso2?: string } | null;
  };
}

const searchCache = new Map<string, Promise<WcaPersonLite[]>>();
const personCache = new Map<string, Promise<WcaPersonLite | null>>();
const upcomingCache = new Map<string, Promise<string[]>>();

function normalizePerson(p: PersonsApiItem['person']): WcaPersonLite | null {
  if (!p) return null;
  const id = p.wca_id || p.id;
  if (!id || !WCA_ID_REGEX.test(id)) return null;
  return {
    id,
    name: p.name || id,
    country_iso2: p.country_iso2 || p.country?.iso2 || '',
  };
}

/** 名字 / WCA ID 模糊搜索。WCA 服务端 ~1.3s 平均。结果客户端取前 limit 条。 */
export function searchPersons(q: string, limit = 8): Promise<WcaPersonLite[]> {
  const key = q.trim().toLowerCase();
  if (!key) return Promise.resolve([]);
  const hit = searchCache.get(key);
  if (hit) return hit.then(arr => arr.slice(0, limit));
  const url = `${WCA_API_BASE}/persons?q=${encodeURIComponent(key)}`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : [])
    .then((j: unknown) => {
      if (!Array.isArray(j)) return [];
      const out: WcaPersonLite[] = [];
      for (const item of j as PersonsApiItem[]) {
        const pl = normalizePerson(item?.person);
        if (pl) out.push(pl);
      }
      return out;
    })
    .catch(() => [] as WcaPersonLite[]);
  searchCache.set(key, p);
  return p.then(arr => arr.slice(0, limit));
}

/** WCA ID 精确查。404 / 失败 → null。 */
export function getPerson(wcaId: string): Promise<WcaPersonLite | null> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return Promise.resolve(null);
  const hit = personCache.get(id);
  if (hit) return hit;
  const url = `${WCA_API_BASE}/persons/${encodeURIComponent(id)}`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : null)
    .then((j: unknown) => normalizePerson((j as PersonGetApi)?.person))
    .catch(() => null);
  personCache.set(id, p);
  return p;
}

/** 拉某人的未来已注册比赛(WCA 平台口径,不含 cubing.com)。返回 comp id 数组。失败 / 无 → []。 */
export function fetchUserUpcoming(wcaId: string): Promise<string[]> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return Promise.resolve([]);
  const hit = upcomingCache.get(id);
  if (hit) return hit;
  const url = `${WCA_API_BASE}/users/${encodeURIComponent(id)}?upcoming_competitions=true`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : null)
    .then((j: unknown) => {
      const arr = (j as UserUpcomingApi)?.upcoming_competitions;
      if (!Array.isArray(arr)) return [];
      return arr.map(c => c.id).filter(Boolean);
    })
    .catch(() => [] as string[]);
  upcomingCache.set(id, p);
  return p;
}
