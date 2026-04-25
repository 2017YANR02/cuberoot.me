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

async function phase<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  console.log(`[nemesizer] ${label}...`);
  const t0 = Date.now();
  const r = await fn();
  console.log(`[nemesizer]   ↳ ${label} done in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  return r;
}

async function loadFromDb(): Promise<{
  persons: RawPerson[];
  countries: Map<string, RawCountry>;
  ranks: { personId: string; eventId: string; kind: number; worldRank: number; best: number }[];
}> {
  // NOTE: dynamic import avoids loading database.yml at module-eval time (so --mock works without a DB)
  const { query } = await import('../core/database.js');

  const countryRows = await phase('SQL: countries', () => query<any>(
    `SELECT c.id, c.iso2, c.continent_id AS continent
     FROM countries c`,
  ));
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

  const personRows = await phase('SQL: persons', () => query<any>(
    `SELECT wca_id, name, country_id
     FROM persons
     WHERE sub_id = 1`,
  ));
  const persons: RawPerson[] = await phase(`materialize ${personRows.length} persons`, () =>
    personRows.map((r: any) => ({
      wcaId: String(r.wca_id),
      name: String(r.name),
      countryId: String(r.country_id),
    })),
  );

  // NOTE: The public WCA developer dump ships ranks_single/ranks_average as empty
  // (table structure only — actual rows are computed in WCA's production env).
  // So we recompute per-person PBs from `results` and rank them.
  //
  // RANK() not ROW_NUMBER(): the nemesis algorithm uses `rank_Q < rank_P` to mean
  // "Q strictly better than P". With ROW_NUMBER, tied bests get distinct ranks, so
  // a person tied with P would compare as "better" purely by row order — that's a
  // bug vs the Python reference (nemesizer.com) which compares by `best` directly.
  // RANK() collapses ties to the same rank, making rank-comparison equivalent to
  // strict-best-comparison.
  const singleRows = await phase('SQL: single ranks (results → MIN(best) → RANK)', () => query<any>(
    `SELECT person_id, event_id, best,
            RANK() OVER (PARTITION BY event_id ORDER BY best) AS world_rank
     FROM (
       SELECT person_id, event_id, MIN(best) AS best
       FROM results
       WHERE best > 0
       GROUP BY person_id, event_id
     ) t`,
  ));
  console.log(`[nemesizer]     got ${singleRows.length} single rows`);

  const averageRows = await phase('SQL: average ranks (results → MIN(average) → RANK)', () => query<any>(
    `SELECT person_id, event_id, best,
            RANK() OVER (PARTITION BY event_id ORDER BY best) AS world_rank
     FROM (
       SELECT person_id, event_id, MIN(average) AS best
       FROM results
       WHERE average > 0
       GROUP BY person_id, event_id
     ) t`,
  ));
  console.log(`[nemesizer]     got ${averageRows.length} average rows`);

  const ranks = await phase(`build ranks array (${singleRows.length + averageRows.length} rows)`, () => {
    const out: { personId: string; eventId: string; kind: number; worldRank: number; best: number }[] = [];
    let lastLog = Date.now();
    const total = singleRows.length + averageRows.length;
    let i = 0;
    for (const r of singleRows) {
      if (++i % 100000 === 0 && Date.now() - lastLog > 2000) {
        console.log(`[nemesizer]     ${i}/${total}`);
        lastLog = Date.now();
      }
      if (!(String(r.event_id) in EVENT_INDEX)) continue;
      out.push({
        personId: String(r.person_id),
        eventId: String(r.event_id),
        kind: KIND_SINGLE,
        worldRank: Number(r.world_rank),
        best: Number(r.best),
      });
    }
    for (const r of averageRows) {
      if (++i % 100000 === 0 && Date.now() - lastLog > 2000) {
        console.log(`[nemesizer]     ${i}/${total}`);
        lastLog = Date.now();
      }
      if (!(String(r.event_id) in EVENT_INDEX)) continue;
      out.push({
        personId: String(r.person_id),
        eventId: String(r.event_id),
        kind: KIND_AVERAGE,
        worldRank: Number(r.world_rank),
        best: Number(r.best),
      });
    }
    return out;
  });

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

async function main() {
  const isMock = process.argv.includes('--mock');
  const raw = isMock ? makeMock() : await loadFromDb();
  if (!isMock) {
    const { closePool } = await import('../core/database.js');
    await closePool();
  }

  const { records: personRecords, continents, personIdxByWcaId, countryOfPersonIdx } =
    await phase('buildPersons', () => buildPersons(raw.persons, raw.countries));
  console.log(`[nemesizer]     ${personRecords.length} persons, ${continents.length} continents`);

  const rankRecords = await phase('buildRanks', () => buildRanks(raw.ranks, personIdxByWcaId));
  console.log(`[nemesizer]     ${rankRecords.length} rank records`);

  // NOTE: precomputing per-person nemesis counts is O(N · prefix_size) and does not
  // finish on the real WCA dataset (~286k persons). The reference impl at nemesizer.com
  // computes the relation on-demand per query, and so does our client (nemesizerAlgo.ts).
  // Counts are only consumed by StatsMode's leaderboards — leave them zeroed for now.
  const nemesisCount = new Uint32Array(personRecords.length);
  const nemesizedCount = new Uint32Array(personRecords.length);

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
  const personsBin = await phase('encode persons.bin', () => encodePersons({ continents, persons: personRecords }));
  const ranksBin   = await phase('encode ranks.bin',   () => encodeRanks(rankRecords));
  const countsBin  = await phase('encode counts.bin',  () => encodeCounts(nemesisCount, nemesizedCount));
  const personsGz = await phase(`gzip persons.bin (${personsBin.length} → ?)`, () => gzipSync(personsBin, { level: 9 }));
  const ranksGz   = await phase(`gzip ranks.bin (${ranksBin.length} → ?)`,     () => gzipSync(ranksBin,   { level: 9 }));
  const countsGz  = await phase(`gzip counts.bin (${countsBin.length} → ?)`,   () => gzipSync(countsBin,  { level: 9 }));
  writeFileSync(resolve(OUTPUT_DIR, 'persons.bin.gz'), personsGz);
  writeFileSync(resolve(OUTPUT_DIR, 'ranks.bin.gz'),   ranksGz);
  writeFileSync(resolve(OUTPUT_DIR, 'counts.bin.gz'),  countsGz);
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
