/**
 * Server-side nemesizer dataset loader.
 *
 * At Hono boot, reads the three .bin.gz files shipped by stats-build
 * (persons / ranks / counts), decodes them with the shared format helpers,
 * and builds the same in-memory indexes the client used to build (typed
 * arrays + Maps). Sits in Node heap for the lifetime of the process.
 *
 * NEMESIZER_DATA_DIR env var overrides the default prod path so local dev
 * (and parity tests) can point at the repo's stats/nemesizer/ checkout.
 */
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import {
  decodePersons,
  decodeRanks,
  decodeCounts,
  NEMESIZER_EVENTS,
  type NemesizerMeta,
  type PersonRecord,
  type DecodedRanks,
  type DecodedCounts,
} from '@cuberoot/shared/nemesizer-format';

export interface RankRef {
  ev: number;
  kind: number;
  rank: number;
  best: number;
}

export interface NemesizerDataset {
  meta: NemesizerMeta;
  persons: PersonRecord[];
  continents: string[];
  ranks: DecodedRanks;
  counts: DecodedCounts;
  wcaIdIndex: Map<string, number>;
  ranksByPerson: RankRef[][];
  byEk: Uint32Array[];
  rankOfPerson: Map<number, number>[];
  countryIndex: Map<string, number[]>;
}

const DATA_DIR = process.env.NEMESIZER_DATA_DIR
  || '/www/wwwroot/toolkit/stats/nemesizer';

let dataset: NemesizerDataset | null = null;
let loadingPromise: Promise<NemesizerDataset> | null = null;

export function getDataset(): NemesizerDataset | null {
  return dataset;
}

export function loadNemesizerDataset(): Promise<NemesizerDataset> {
  if (dataset) return Promise.resolve(dataset);
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const t0 = Date.now();
    const metaText = await readFile(path.join(DATA_DIR, 'meta.json'), 'utf8');
    const meta: NemesizerMeta = JSON.parse(metaText);

    const [personsGz, ranksGz, countsGz] = await Promise.all([
      readFile(path.join(DATA_DIR, 'persons.bin.gz')),
      readFile(path.join(DATA_DIR, 'ranks.bin.gz')),
      readFile(path.join(DATA_DIR, 'counts.bin.gz')),
    ]);
    const personsBytes = new Uint8Array(gunzipSync(personsGz));
    const ranksBytes = new Uint8Array(gunzipSync(ranksGz));
    const countsBytes = new Uint8Array(gunzipSync(countsGz));

    const { continents, persons } = decodePersons(personsBytes);
    const ranks = decodeRanks(ranksBytes);
    const counts = decodeCounts(countsBytes);

    const wcaIdIndex = new Map<string, number>();
    for (let i = 0; i < persons.length; i++) wcaIdIndex.set(persons[i].wcaId, i);

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
    for (let i = 0; i < persons.length; i++) {
      const iso = persons[i].countryIso2;
      if (!iso) continue;
      let arr = countryIndex.get(iso);
      if (!arr) { arr = []; countryIndex.set(iso, arr); }
      arr.push(i);
    }

    dataset = {
      meta, persons, continents, ranks, counts,
      wcaIdIndex, ranksByPerson, byEk, rankOfPerson, countryIndex,
    };
    console.log(`[nemesizer] loaded ${persons.length} persons, ${ranks.count} ranks in ${Date.now() - t0}ms`);
    return dataset;
  })();
  loadingPromise = loadingPromise.catch(err => {
    console.error('[nemesizer] load failed:', err);
    loadingPromise = null;
    throw err;
  });
  return loadingPromise;
}
