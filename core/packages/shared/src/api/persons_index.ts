// 本地全量 WCA 选手索引 —— 替代 WCA /search/users 的网络请求
// 数据源：stats/data/persons_search.json.gz （由 stats-build 周更）
// 首次访问后台拉一次（~3.7MB gzip → ~10MB JSON），之后客户端内存搜索 O(n) 但 n=28万 + SIMD includes 通常 <20ms
import type { WcaPerson } from '../types';

const URL = '/stats/data/persons_search.json.gz';

interface Loaded {
  records: Array<[string, string, string]>;  // [wcaId, name, iso2]
  haystacks: string[];                       // 同序，预小写化的 "id|name" 用于 includes
}

let loaded: Loaded | null = null;
let loadPromise: Promise<Loaded> | null = null;

async function fetchAndParse(): Promise<Loaded> {
  const resp = await fetch(URL, { cache: 'force-cache' });
  if (!resp.ok) throw new Error(`persons index fetch ${resp.status}`);
  const ds = new DecompressionStream('gzip');
  const stream = resp.body!.pipeThrough(ds);
  const text = await new Response(stream).text();
  const records = JSON.parse(text) as Array<[string, string, string]>;
  const haystacks = records.map(r => `${r[0].toLowerCase()}|${r[1].toLowerCase()}`);
  return { records, haystacks };
}

export function loadPersonsIndex(): Promise<Loaded> {
  if (loaded) return Promise.resolve(loaded);
  if (loadPromise) return loadPromise;
  loadPromise = fetchAndParse().then(d => { loaded = d; return d; });
  return loadPromise;
}

// 是否已加载完。Picker 用来决定是走本地还是 fallback WCA API
export function isPersonsIndexReady(): boolean {
  return loaded !== null;
}

// 本地搜索；未加载完返回 null（让调用方 fallback）
export function searchLocalPersons(query: string, limit = 20): WcaPerson[] | null {
  if (!loaded) return null;
  const ql = query.trim().toLowerCase();
  if (!ql) return [];
  const { records, haystacks } = loaded;
  const out: WcaPerson[] = [];
  for (let i = 0; i < haystacks.length && out.length < limit; i++) {
    if (haystacks[i].includes(ql)) {
      const r = records[i];
      out.push({ wcaId: r[0], name: r[1], iso2: r[2], avatarUrl: '' });
    }
  }
  return out;
}
