// NOTE: CLI 入口——生成 Nemesizer 功能所需的二进制数据文件
// 输出：stats/data/nemesizer/{persons.bin.gz, ranks.bin.gz, counts.bin.gz, meta.json}
// 用法：
//   pnpm nemesizer           # 从 WCA DB 生成完整数据
//   pnpm nemesizer --mock    # 生成小规模假数据（用于本地开发/测试）
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';
import {
  NEMESIZER_EVENTS,
  EVENT_INDEX,
  KIND_SINGLE,
  KIND_AVERAGE,
  encodePersons,
  encodeRanks,
  encodeCounts,
  type PersonRecord,
  type RankRecord,
  type NemesizerMeta,
} from '@cuberoot/shared/nemesizer-format';
import { EVENTS, eventZh } from '../core/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../../../../../stats/data/nemesizer');

interface RawPerson { wcaId: string; name: string; countryId: string; }
interface RawCountry { id: string; iso2: string; nameZh: string | null; continent: string; continentZh: string; }

const CONTINENT_ZH: Record<string, string> = {
  Africa: '非洲',
  Asia: '亚洲',
  Europe: '欧洲',
  'North America': '北美洲',
  Oceania: '大洋洲',
  'South America': '南美洲',
};

async function loadFromDb(): Promise<{
  persons: RawPerson[];
  countries: Map<string, RawCountry>;
  ranks: { personId: string; eventId: string; kind: number; worldRank: number; best: number }[];
}> {
  // NOTE: dynamic import avoids loading database.yml at module-eval time (so --mock works without a DB)
  const { query } = await import('../core/database.js');
  console.log('[nemesizer] loading countries...');
  const countryRows = await query<any>(
    `SELECT c.id, c.iso2, c.continent_id AS continent
     FROM countries c`,
  );
  const countries = new Map<string, RawCountry>();
  for (const r of countryRows) {
    const continent = String(r.continent).replace(/^_/, '');
    countries.set(String(r.id), {
      id: String(r.id),
      iso2: String(r.iso2 || '').toLowerCase(),
      nameZh: null,
      continent,
      continentZh: CONTINENT_ZH[continent] ?? continent,
    });
  }

  console.log('[nemesizer] loading persons...');
  const personRows = await query<any>(
    `SELECT wca_id, name, country_id
     FROM persons
     WHERE sub_id = 1`,
  );
  const persons: RawPerson[] = personRows.map((r: any) => ({
    wcaId: String(r.wca_id),
    name: String(r.name),
    countryId: String(r.country_id),
  }));

  console.log(`[nemesizer] loading ranks (${persons.length} persons)...`);
  const singleRows = await query<any>(
    `SELECT person_id, event_id, best, world_rank FROM ranks_single`,
  );
  const averageRows = await query<any>(
    `SELECT person_id, event_id, best, world_rank FROM ranks_average`,
  );
  const ranks: { personId: string; eventId: string; kind: number; worldRank: number; best: number }[] = [];
  for (const r of singleRows) {
    if (!(String(r.event_id) in EVENT_INDEX)) continue;
    ranks.push({
      personId: String(r.person_id),
      eventId: String(r.event_id),
      kind: KIND_SINGLE,
      worldRank: Number(r.world_rank),
      best: Number(r.best),
    });
  }
  for (const r of averageRows) {
    if (!(String(r.event_id) in EVENT_INDEX)) continue;
    ranks.push({
      personId: String(r.person_id),
      eventId: String(r.event_id),
      kind: KIND_AVERAGE,
      worldRank: Number(r.world_rank),
      best: Number(r.best),
    });
  }
  return { persons, countries, ranks };
}

function makeMock() {
  const continents = ['Asia', 'Europe', 'North America'];
  const rawCountries: RawCountry[] = [
    { id: 'China', iso2: 'cn', nameZh: '中国', continent: 'Asia', continentZh: '亚洲' },
    { id: 'Japan', iso2: 'jp', nameZh: '日本', continent: 'Asia', continentZh: '亚洲' },
    { id: 'USA', iso2: 'us', nameZh: '美国', continent: 'North America', continentZh: '北美洲' },
    { id: 'Germany', iso2: 'de', nameZh: '德国', continent: 'Europe', continentZh: '欧洲' },
  ];
  const countries = new Map<string, RawCountry>(rawCountries.map(c => [c.id, c]));
  const mockPersons: RawPerson[] = [
    { wcaId: '2019WANY36', name: 'Yiheng Wang (王艺衡)', countryId: 'China' },
    { wcaId: '2025WANY02', name: 'Yiheng Wang (王译衡)', countryId: 'China' },
    { wcaId: '2023GENG02', name: 'Xuanyi Geng (耿暄一)', countryId: 'China' },
    { wcaId: '2015PARK22', name: 'Tymon Kolasiński', countryId: 'Germany' },
    { wcaId: '2009ZEMD01', name: 'Max Park', countryId: 'USA' },
    { wcaId: '2017SUYU01', name: 'Yusheng Du (杜宇生)', countryId: 'China' },
    { wcaId: '2015CHER07', name: 'Tommy Cherry', countryId: 'USA' },
    { wcaId: '2009NAKA02', name: 'Sho Nakajima (中島 翔)', countryId: 'Japan' },
  ];
  const ranks: { personId: string; eventId: string; kind: number; worldRank: number; best: number }[] = [];
  let rng = 12345;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < mockPersons.length; i++) {
    for (const ev of NEMESIZER_EVENTS) {
      if (rand() < 0.3) continue;
      const sRank = i * 2 + Math.floor(rand() * 20) + 1;
      ranks.push({ personId: mockPersons[i].wcaId, eventId: ev, kind: KIND_SINGLE, worldRank: sRank, best: 500 + i * 10 + Math.floor(rand() * 200) });
      if (ev !== '333mbf' && rand() < 0.8) {
        ranks.push({ personId: mockPersons[i].wcaId, eventId: ev, kind: KIND_AVERAGE, worldRank: sRank + Math.floor(rand() * 3), best: 600 + i * 10 });
      }
    }
  }
  return { persons: mockPersons, countries, ranks };
}

function buildPersons(
  rawPersons: RawPerson[],
  rawCountries: Map<string, RawCountry>,
): { records: PersonRecord[]; continents: string[]; personIdxByWcaId: Map<string, number>; countryOfPersonIdx: string[] } {
  const continentsList: string[] = [];
  const continentIdx = new Map<string, number>();
  for (const c of rawCountries.values()) {
    if (!continentIdx.has(c.continent)) {
      continentIdx.set(c.continent, continentsList.length);
      continentsList.push(c.continent);
    }
  }
  rawPersons.sort((a, b) => (a.wcaId < b.wcaId ? -1 : a.wcaId > b.wcaId ? 1 : 0));
  const records: PersonRecord[] = [];
  const personIdxByWcaId = new Map<string, number>();
  const countryOfPersonIdx: string[] = [];
  for (const p of rawPersons) {
    const c = rawCountries.get(p.countryId);
    if (!c) continue;
    const idx = records.length;
    personIdxByWcaId.set(p.wcaId, idx);
    countryOfPersonIdx.push(p.countryId);
    records.push({
      wcaId: p.wcaId,
      countryIso2: c.iso2,
      continentIdx: continentIdx.get(c.continent) ?? 0,
      name: p.name,
    });
  }
  return { records, continents: continentsList, personIdxByWcaId, countryOfPersonIdx };
}

function buildRanks(
  raw: { personId: string; eventId: string; kind: number; worldRank: number; best: number }[],
  personIdxByWcaId: Map<string, number>,
): RankRecord[] {
  const out: RankRecord[] = [];
  for (const r of raw) {
    const pi = personIdxByWcaId.get(r.personId);
    if (pi === undefined) continue;
    out.push({
      personIdx: pi,
      eventIdx: EVENT_INDEX[r.eventId],
      kind: r.kind,
      worldRank: r.worldRank,
      best: r.best,
    });
  }
  return out;
}

// Precompute nemesis counts for every person.
// nemesisCount[P] = |{Q : Q is nemesis of P}|
// nemesizedCount[P] = |{Q : P is nemesis of Q}|
function computeCounts(ranks: RankRecord[], personCount: number): { nemesisCount: Uint32Array; nemesizedCount: Uint32Array } {
  console.log('[nemesizer] indexing ranks for counts...');
  // Per (event, kind): sorted list of personIdx by worldRank asc
  const byEk = new Array<number[]>(NEMESIZER_EVENTS.length * 2);
  for (let i = 0; i < byEk.length; i++) byEk[i] = [];
  const ranksByPerson: { ev: number; kind: number; rank: number }[][] = Array.from({ length: personCount }, () => []);
  const rankOfPersonEk = new Map<number, number>();  // key = personIdx * 36 + ev*2 + kind
  const ekKey = (p: number, ev: number, kind: number) => p * 36 + ev * 2 + kind;
  const ekIdx = (ev: number, kind: number) => ev * 2 + kind;
  for (const r of ranks) {
    byEk[ekIdx(r.eventIdx, r.kind)].push(r.personIdx);
    ranksByPerson[r.personIdx].push({ ev: r.eventIdx, kind: r.kind, rank: r.worldRank });
    rankOfPersonEk.set(ekKey(r.personIdx, r.eventIdx, r.kind), r.worldRank);
  }
  // sort each ek list by rank
  for (const ek of NEMESIZER_EVENTS) {
    for (const kind of [KIND_SINGLE, KIND_AVERAGE]) {
      const list = byEk[ekIdx(EVENT_INDEX[ek], kind)];
      list.sort((a, b) => {
        const ra = rankOfPersonEk.get(ekKey(a, EVENT_INDEX[ek], kind))!;
        const rb = rankOfPersonEk.get(ekKey(b, EVENT_INDEX[ek], kind))!;
        return ra - rb;
      });
    }
  }
  console.log('[nemesizer] computing nemesis counts...');
  const nemesisCount = new Uint32Array(personCount);
  const nemesizedCount = new Uint32Array(personCount);
  const mark = new Uint8Array(personCount);
  const touched: number[] = [];
  let lastLog = Date.now();
  for (let p = 0; p < personCount; p++) {
    if (Date.now() - lastLog > 5000) {
      console.log(`[nemesizer]   ${p}/${personCount}`);
      lastLog = Date.now();
    }
    const eks = ranksByPerson[p];
    if (eks.length === 0) continue;
    // Compute nemesis list (people strictly better than p in every shared ek, AND share ≥ 1).
    // Approach: initial candidates = union of "better prefix" across p's eks.
    // Then filter out anyone who is WORSE-OR-EQUAL in any other shared ek of theirs with p.
    for (const { ev, kind, rank } of eks) {
      const list = byEk[ekIdx(ev, kind)];
      // list is sorted; binary search for rank
      let lo = 0, hi = list.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const r = rankOfPersonEk.get(ekKey(list[mid], ev, kind))!;
        if (r < rank) lo = mid + 1; else hi = mid;
      }
      for (let i = 0; i < lo; i++) {
        const q = list[i];
        if (mark[q] === 0) {
          mark[q] = 1;
          touched.push(q);
        }
      }
    }
    // Filter
    let count = 0;
    for (const q of touched) {
      if (q === p) continue;
      // check q is strictly better on every shared ek
      let ok = true;
      for (const { ev, kind, rank } of ranksByPerson[q]) {
        const pr = rankOfPersonEk.get(ekKey(p, ev, kind));
        if (pr === undefined) continue;  // not shared
        if (rank >= pr) { ok = false; break; }
      }
      if (ok) {
        count++;
        nemesizedCount[q]++;
      }
    }
    nemesisCount[p] = count;
    for (const q of touched) mark[q] = 0;
    touched.length = 0;
  }
  return { nemesisCount, nemesizedCount };
}

async function main() {
  const isMock = process.argv.includes('--mock');
  const raw = isMock ? makeMock() : await loadFromDb();
  if (!isMock) {
    const { closePool } = await import('../core/database.js');
    await closePool();
  }

  const { records: personRecords, continents, personIdxByWcaId, countryOfPersonIdx } = buildPersons(raw.persons, raw.countries);
  console.log(`[nemesizer] ${personRecords.length} persons, ${continents.length} continents`);

  const rankRecords = buildRanks(raw.ranks, personIdxByWcaId);
  console.log(`[nemesizer] ${rankRecords.length} rank records`);

  const { nemesisCount, nemesizedCount } = computeCounts(rankRecords, personRecords.length);

  // Build meta
  const events = NEMESIZER_EVENTS.map(id => ({
    id,
    nameEn: EVENTS[id] ?? id,
    nameZh: eventZh(EVENTS[id] ?? id),
  }));
  const hasAverage: Record<string, boolean> = {};
  for (const ev of NEMESIZER_EVENTS) hasAverage[ev] = ev !== '333mbf';

  const countriesArr: NemesizerMeta['countries'] = [];
  const continentIdxMap = new Map(continents.map((c, i) => [c, i]));
  const seenIso2 = new Set<string>();
  for (let i = 0; i < personRecords.length; i++) {
    const iso2 = personRecords[i].countryIso2;
    if (!iso2 || seenIso2.has(iso2)) continue;
    seenIso2.add(iso2);
    const rc = raw.countries.get(countryOfPersonIdx[i]);
    if (!rc) continue;
    countriesArr.push({
      iso2,
      nameEn: rc.id,
      nameZh: rc.nameZh ?? rc.id,
      continentIdx: continentIdxMap.get(rc.continent) ?? 0,
    });
  }
  countriesArr.sort((a, b) => a.iso2.localeCompare(b.iso2));

  const meta: NemesizerMeta = {
    generatedAt: new Date().toISOString(),
    exportDate: new Date().toISOString().slice(0, 10),
    personCount: personRecords.length,
    rankCount: rankRecords.length,
    events,
    countries: countriesArr,
    hasAverage,
  };

  // Write
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const personsBin = encodePersons({ continents, persons: personRecords });
  const ranksBin = encodeRanks(rankRecords);
  const countsBin = encodeCounts(nemesisCount, nemesizedCount);
  writeFileSync(resolve(OUTPUT_DIR, 'persons.bin.gz'), gzipSync(personsBin, { level: 9 }));
  writeFileSync(resolve(OUTPUT_DIR, 'ranks.bin.gz'),   gzipSync(ranksBin,   { level: 9 }));
  writeFileSync(resolve(OUTPUT_DIR, 'counts.bin.gz'),  gzipSync(countsBin,  { level: 9 }));
  writeFileSync(resolve(OUTPUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
  // Also write meta with continents embedded (saves client from parsing persons header)
  // Actually continents are already inside persons.bin; keep meta lean.

  console.log(`[nemesizer] wrote to ${OUTPUT_DIR}`);
  console.log(`  persons.bin.gz: ${personsBin.length} raw`);
  console.log(`  ranks.bin.gz:   ${ranksBin.length} raw`);
  console.log(`  counts.bin.gz:  ${countsBin.length} raw`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
