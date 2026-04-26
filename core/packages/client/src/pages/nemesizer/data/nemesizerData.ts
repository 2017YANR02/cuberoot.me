// Fetches and decodes the nemesizer binary dataset once per session.
// Files: /stats/data/nemesizer/{persons.bin.gz, ranks.bin.gz, counts.bin.gz, meta.json}
import {
  decodePersons,
  decodeRanks,
  decodeCounts,
  NEMESIZER_EVENTS,
  EVENT_INDEX,
  type PersonRecord,
  type DecodedRanks,
  type DecodedCounts,
  type NemesizerMeta,
} from '@cuberoot/shared';

export interface RankRef {
  ev: number;    // eventIdx
  kind: number;  // 0 single, 1 average
  rank: number;  // worldRank
  best: number;
}

export interface NemesizerDataset {
  meta: NemesizerMeta;
  persons: PersonRecord[];
  continents: string[];
  ranks: DecodedRanks;
  counts: DecodedCounts;
  // Indexes
  wcaIdIndex: Map<string, number>;
  nameIndex: Map<string, number>;           // lowercased name → personIdx
  zhNameIndex: Map<string, number>;         // Chinese name → personIdx
  ranksByPerson: RankRef[][];               // personIdx → ranks
  byEk: Uint32Array[];                      // (ev*2+kind) → sorted personIdx by worldRank asc
  rankOfPerson: Map<number, number>[];      // (ev*2+kind) → Map<personIdx, worldRank>
  countryIndex: Map<string, number[]>;      // iso2 → personIdx[]
  continentIndex: Map<number, number[]>;    // continentIdx → personIdx[]
}

const BASE = '/stats/data/nemesizer';

async function fetchGz(url: string): Promise<Uint8Array> {
  // NOTE: force-cache is safe because the URL itself carries an exportDate
  // version tag — a fresh dataset gets a new URL and the browser refetches.
  const resp = await fetch(url, { cache: 'force-cache' });
  if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
  const ds = new DecompressionStream('gzip');
  const stream = resp.body!.pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

let loading: Promise<NemesizerDataset> | null = null;

export function loadNemesizerData(onProgress?: (phase: string) => void): Promise<NemesizerDataset> {
  if (loading) return loading;
  const p = (async (): Promise<NemesizerDataset> => {
    onProgress?.('meta');
    // NOTE: meta.json must always revalidate so we pick up new exportDate
    // (which versions the binary URLs below). no-cache returns 304 when the
    // file is unchanged, so we don't pay for re-downloading the body.
    const metaResp = await fetch(`${BASE}/meta.json`, { cache: 'no-cache' });
    if (!metaResp.ok) throw new Error(`fetch meta: ${metaResp.status}`);
    const meta: NemesizerMeta = await metaResp.json();
    const v = encodeURIComponent(meta.exportDate || meta.generatedAt);

    onProgress?.('persons');
    const [personsBytes, ranksBytes, countsBytes] = await Promise.all([
      fetchGz(`${BASE}/persons.bin.gz?v=${v}`),
      fetchGz(`${BASE}/ranks.bin.gz?v=${v}`),
      fetchGz(`${BASE}/counts.bin.gz?v=${v}`),
    ]);

    onProgress?.('parsing');
    const { continents, persons } = decodePersons(personsBytes);
    const ranks = decodeRanks(ranksBytes);
    const counts = decodeCounts(countsBytes);

    onProgress?.('indexing');
    const wcaIdIndex = new Map<string, number>();
    const nameIndex = new Map<string, number>();
    const zhNameIndex = new Map<string, number>();
    for (let i = 0; i < persons.length; i++) {
      const p = persons[i];
      wcaIdIndex.set(p.wcaId, i);
      nameIndex.set(stripParens(p.name).toLowerCase(), i);
      const zh = extractZh(p.name);
      if (zh) zhNameIndex.set(zh, i);
    }

    const nEk = NEMESIZER_EVENTS.length * 2;
    const ranksByPerson: RankRef[][] = Array.from({ length: persons.length }, () => []);
    const buckets: number[][] = Array.from({ length: nEk }, () => []);
    const rankOfPerson: Map<number, number>[] = Array.from({ length: nEk }, () => new Map());
    for (let i = 0; i < ranks.count; i++) {
      const pi = ranks.personIdx[i];
      const ev = ranks.eventIdx[i];
      const kind = ranks.kind[i];
      const r = ranks.worldRank[i];
      const best = ranks.best[i];
      const ek = ev * 2 + kind;
      ranksByPerson[pi].push({ ev, kind, rank: r, best });
      buckets[ek].push(pi);
      rankOfPerson[ek].set(pi, r);
    }
    const byEk: Uint32Array[] = new Array(nEk);
    for (let ek = 0; ek < nEk; ek++) {
      const arr = buckets[ek];
      const map = rankOfPerson[ek];
      arr.sort((a, b) => map.get(a)! - map.get(b)!);
      byEk[ek] = Uint32Array.from(arr);
    }

    const countryIndex = new Map<string, number[]>();
    const continentIndex = new Map<number, number[]>();
    for (let i = 0; i < persons.length; i++) {
      const iso2 = persons[i].countryIso2;
      if (iso2) {
        if (!countryIndex.has(iso2)) countryIndex.set(iso2, []);
        countryIndex.get(iso2)!.push(i);
      }
      const ci = persons[i].continentIdx;
      if (!continentIndex.has(ci)) continentIndex.set(ci, []);
      continentIndex.get(ci)!.push(i);
    }

    return {
      meta, persons, continents, ranks, counts,
      wcaIdIndex, nameIndex, zhNameIndex,
      ranksByPerson, byEk, rankOfPerson,
      countryIndex, continentIndex,
    };
  })();
  loading = p.catch(err => { loading = null; throw err; });
  return loading;
}

export function findPersons(ds: NemesizerDataset, query: string): number[] {
  const q = query.trim();
  if (!q) return [];
  // Exact WCA ID
  const id = ds.wcaIdIndex.get(q.toUpperCase());
  if (id !== undefined) return [id];
  // Chinese name exact
  const zh = ds.zhNameIndex.get(q);
  if (zh !== undefined) return [zh];
  // 4-digit year prefix → all WCA IDs starting with that year (e.g. "2017" → 2017XXXXNN)
  if (/^\d{4}$/.test(q)) {
    const out: number[] = [];
    for (let i = 0; i < ds.persons.length && out.length < 200; i++) {
      if (ds.persons[i].wcaId.startsWith(q)) out.push(i);
    }
    if (out.length > 0) return out;
  }
  // 2-letter ISO country code → all persons from that country
  if (/^[A-Za-z]{2}$/.test(q)) {
    const iso = q.toLowerCase();
    const country = ds.countryIndex.get(iso);
    if (country && country.length > 0) return country.slice(0, 200);
  }
  // Country name (English) — match via meta.countries
  const qLower = q.toLowerCase();
  for (const c of ds.meta.countries) {
    if (c.nameEn.toLowerCase() === qLower || c.nameZh === q) {
      const arr = ds.countryIndex.get(c.iso2);
      if (arr && arr.length > 0) return arr.slice(0, 200);
    }
  }
  // Fuzzy substring on name (case-insensitive)
  const needle = stripParens(q).toLowerCase();
  const results: number[] = [];
  for (let i = 0; i < ds.persons.length && results.length < 50; i++) {
    const n = stripParens(ds.persons[i].name).toLowerCase();
    if (n === needle) results.unshift(i);
    else if (n.includes(needle)) results.push(i);
  }
  return results;
}

function stripParens(s: string): string {
  return s.replace(/\s*[（(].*?[)）]\s*/g, '').trim();
}
function extractZh(s: string): string | null {
  const m = s.match(/[（(]([^)）]+)[)）]/);
  return m ? m[1] : null;
}

// For tests / override scenarios: build a dataset-like object from literal data.
export function _buildTestDataset(
  persons: PersonRecord[],
  ranksInput: { personIdx: number; ev: number; kind: number; worldRank: number; best: number }[],
): NemesizerDataset {
  const continents = persons.length > 0 ? ['World'] : [];
  const ranks: DecodedRanks = {
    count: ranksInput.length,
    personIdx: Uint32Array.from(ranksInput.map(r => r.personIdx)),
    eventIdx: Uint8Array.from(ranksInput.map(r => r.ev)),
    kind: Uint8Array.from(ranksInput.map(r => r.kind)),
    worldRank: Uint32Array.from(ranksInput.map(r => r.worldRank)),
    best: Uint32Array.from(ranksInput.map(r => r.best)),
  };
  const counts: DecodedCounts = {
    count: persons.length,
    nemesisCount: new Uint32Array(persons.length),
    nemesizedCount: new Uint32Array(persons.length),
  };
  const nEk = NEMESIZER_EVENTS.length * 2;
  const ranksByPerson: RankRef[][] = Array.from({ length: persons.length }, () => []);
  const buckets: number[][] = Array.from({ length: nEk }, () => []);
  const rankOfPerson: Map<number, number>[] = Array.from({ length: nEk }, () => new Map());
  for (const r of ranksInput) {
    const ek = r.ev * 2 + r.kind;
    ranksByPerson[r.personIdx].push({ ev: r.ev, kind: r.kind, rank: r.worldRank, best: r.best });
    buckets[ek].push(r.personIdx);
    rankOfPerson[ek].set(r.personIdx, r.worldRank);
  }
  const byEk = buckets.map((arr, ek) => {
    const m = rankOfPerson[ek];
    arr.sort((a, b) => m.get(a)! - m.get(b)!);
    return Uint32Array.from(arr);
  });
  const meta: NemesizerMeta = {
    generatedAt: '', exportDate: '', personCount: persons.length, rankCount: ranksInput.length,
    events: NEMESIZER_EVENTS.map(id => ({ id, nameEn: id, nameZh: id })),
    countries: [], hasAverage: Object.fromEntries(NEMESIZER_EVENTS.map(e => [e, e !== '333mbf'])),
  };
  const wcaIdIndex = new Map(persons.map((p, i) => [p.wcaId, i]));
  return {
    meta, persons, continents, ranks, counts,
    wcaIdIndex, nameIndex: new Map(), zhNameIndex: new Map(),
    ranksByPerson, byEk, rankOfPerson,
    countryIndex: new Map(), continentIndex: new Map(),
  };
}

export { EVENT_INDEX, NEMESIZER_EVENTS };
