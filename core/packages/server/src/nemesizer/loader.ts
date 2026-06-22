/**
 * Server-side nemesizer dataset loader.
 *
 * At Hono boot, reads the three .bin.gz files shipped by stats-build
 * (persons / ranks / counts), decodes them, and builds compact in-memory
 * indexes that live in the Node heap for the lifetime of the process.
 *
 * Memory note: the per-person ranks are stored as a CSR (compressed sparse row)
 * of flat typed arrays — NOT an array-of-objects — and per-event-kind lookups
 * use sorted typed arrays + binary search instead of Map<number,number>[]. For
 * 291k persons / 1.88M ranks this keeps the dataset at ~120MB instead of ~300MB;
 * the array-of-1.88M-objects + Maps layout the old code used cost ~270MB on its
 * own. Access goes through the exported accessors (personRanks / rankInEk / …),
 * which the route + algo use; the raw decoded `ranks` arrays are dropped after
 * the indexes are built. Parity with the old layout is byte-exact (verified).
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
  type DecodedCounts,
} from '@cuberoot/shared/nemesizer-format';

/** A single (event, kind) result for one person — materialised on demand. */
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
  counts: DecodedCounts;
  wcaIdIndex: Map<string, number>;
  countryIndex: Map<string, number[]>;
  // CSR of each person's ranks: person i owns rbp* slices [rbpOff[i], rbpOff[i+1]).
  rbpOff: Uint32Array;   // length persons.length + 1
  rbpEv: Uint8Array;     // length rankCount
  rbpKind: Uint8Array;
  rbpRank: Uint32Array;
  rbpBest: Uint32Array;
  // Per event-kind (ek = ev*2+kind): personIdx sorted by world rank + parallel rank.
  byEk: Uint32Array[];
  byEkRank: Uint32Array[];
  // Per ek: personIdx sorted ascending + parallel world rank, for O(log) rank lookup.
  ekPid: Uint32Array[];
  ekRank: Uint32Array[];
}

const DATA_DIR = process.env.NEMESIZER_DATA_DIR
  || '/www/wwwroot/toolkit/stats/nemesizer';

let dataset: NemesizerDataset | null = null;
let loadingPromise: Promise<NemesizerDataset> | null = null;

export function getDataset(): NemesizerDataset | null {
  return dataset;
}

/** Number of ranked (event, kind) results person `i` holds. */
export function personRankCount(ds: NemesizerDataset, i: number): number {
  return ds.rbpOff[i + 1] - ds.rbpOff[i];
}

/** Materialise person `i`'s ranks as RankRef[] (small, request-scoped). */
export function personRanks(ds: NemesizerDataset, i: number): RankRef[] {
  const out: RankRef[] = [];
  for (let j = ds.rbpOff[i]; j < ds.rbpOff[i + 1]; j++) {
    out.push({ ev: ds.rbpEv[j], kind: ds.rbpKind[j], rank: ds.rbpRank[j], best: ds.rbpBest[j] });
  }
  return out;
}

/** World rank of person `pi` in event-kind `ek`, or undefined if unranked there. */
export function rankInEk(ds: NemesizerDataset, ek: number, pi: number): number | undefined {
  const pid = ds.ekPid[ek];
  let lo = 0, hi = pid.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pid[mid] < pi) lo = mid + 1; else hi = mid;
  }
  return lo < pid.length && pid[lo] === pi ? ds.ekRank[ek][lo] : undefined;
}

/** Best result of person `i` in (ev, kind), or undefined if not ranked there. */
export function bestInEvKind(ds: NemesizerDataset, i: number, ev: number, kind: number): number | undefined {
  for (let j = ds.rbpOff[i]; j < ds.rbpOff[i + 1]; j++) {
    if (ds.rbpEv[j] === ev && ds.rbpKind[j] === kind) return ds.rbpBest[j];
  }
  return undefined;
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

    const N = persons.length;
    const R = ranks.count;
    const nEk = NEMESIZER_EVENTS.length * 2;

    // CSR of per-person ranks (counting sort by personIdx; file order within a person).
    const rbpOff = new Uint32Array(N + 1);
    for (let i = 0; i < R; i++) rbpOff[ranks.personIdx[i] + 1]++;
    for (let i = 0; i < N; i++) rbpOff[i + 1] += rbpOff[i];
    const rbpEv = new Uint8Array(R);
    const rbpKind = new Uint8Array(R);
    const rbpRank = new Uint32Array(R);
    const rbpBest = new Uint32Array(R);
    const cursor = rbpOff.slice(0, N); // write head per person, starts at slice begin
    for (let i = 0; i < R; i++) {
      const pi = ranks.personIdx[i];
      const w = cursor[pi]++;
      rbpEv[w] = ranks.eventIdx[i];
      rbpKind[w] = ranks.kind[i];
      rbpRank[w] = ranks.worldRank[i];
      rbpBest[w] = ranks.best[i];
    }

    // Per event-kind indexes. byEk is rank-sorted (stable, rank-only — callers depend
    // on the WCA tie order); ekPid is personIdx-sorted for binary-search rank lookups.
    const ekBucket: number[][] = Array.from({ length: nEk }, () => []);
    for (let i = 0; i < R; i++) ekBucket[ranks.eventIdx[i] * 2 + ranks.kind[i]].push(i);
    const byEk: Uint32Array[] = new Array(nEk);
    const byEkRank: Uint32Array[] = new Array(nEk);
    const ekPid: Uint32Array[] = new Array(nEk);
    const ekRank: Uint32Array[] = new Array(nEk);
    for (let ek = 0; ek < nEk; ek++) {
      const idx = ekBucket[ek];
      const byRank = idx.slice().sort((a, b) => ranks.worldRank[a] - ranks.worldRank[b]);
      byEk[ek] = Uint32Array.from(byRank, (i) => ranks.personIdx[i]);
      byEkRank[ek] = Uint32Array.from(byRank, (i) => ranks.worldRank[i]);
      const byPid = idx.sort((a, b) => ranks.personIdx[a] - ranks.personIdx[b]);
      ekPid[ek] = Uint32Array.from(byPid, (i) => ranks.personIdx[i]);
      ekRank[ek] = Uint32Array.from(byPid, (i) => ranks.worldRank[i]);
    }

    const wcaIdIndex = new Map<string, number>();
    for (let i = 0; i < N; i++) wcaIdIndex.set(persons[i].wcaId, i);

    const countryIndex = new Map<string, number[]>();
    for (let i = 0; i < N; i++) {
      const iso = persons[i].countryIso2;
      if (!iso) continue;
      let arr = countryIndex.get(iso);
      if (!arr) { arr = []; countryIndex.set(iso, arr); }
      arr.push(i);
    }

    dataset = {
      meta, persons, continents, counts, wcaIdIndex, countryIndex,
      rbpOff, rbpEv, rbpKind, rbpRank, rbpBest,
      byEk, byEkRank, ekPid, ekRank,
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
