/**
 * Server-side nemesis algorithm — direct port of client/.../nemesizerAlgo.ts.
 *
 * Q is a nemesis of P iff E_P ⊆ E_Q AND ∀ ek ∈ E_P : rank_Q(ek) < rank_P(ek).
 * Reverse iNem: E_Q ⊆ E_P, P strictly better in every E_Q ek.
 * NearlyMe: same coverage as myNem but wins all but 1 of E_P's eks.
 * INearly: same coverage as iNem but P wins all but 1 of E_Q's eks.
 * OnlyJust: strict nemesis with min margin == 1.
 */
import type { NemesizerDataset, RankRef } from './loader.js';

export type RelationView =
  | 'myNem'
  | 'iNem'
  | 'nearlyMe'
  | 'iNearly'
  | 'onlyJustMe'
  | 'iOnlyJust';

export interface NemesisResult {
  personIdx: number;
  sharedEkCount: number;
}

export type RankOverride = Map<number, number>;

function getPersonRanks(ds: NemesizerDataset, p: number, override?: RankOverride): RankRef[] {
  if (!override || override.size === 0) return ds.ranksByPerson[p];
  const base = ds.ranksByPerson[p];
  const overridden = new Map<number, RankRef>();
  for (const r of base) overridden.set(r.ev * 2 + r.kind, r);
  for (const [ek, newRank] of override) {
    const ev = ek >> 1;
    const kind = ek & 1;
    if (newRank <= 0) {
      overridden.delete(ek);
    } else {
      const prev = overridden.get(ek);
      overridden.set(ek, { ev, kind, rank: newRank, best: prev?.best ?? 0 });
    }
  }
  return Array.from(overridden.values());
}

function pEksMapOf(pRanks: RankRef[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of pRanks) m.set(r.ev * 2 + r.kind, r.rank);
  return m;
}

function computeMyNem(ds: NemesizerDataset, p: number, pRanks: RankRef[]): NemesisResult[] {
  const pEksWithSplit = pRanks.map(r => {
    const ek = r.ev * 2 + r.kind;
    const split = lowerBoundRank(ds.byEk[ek], ds.rankOfPerson[ek], r.rank);
    return { ek, split };
  });
  pEksWithSplit.sort((a, b) => a.split - b.split);

  let candidates: Set<number> | null = null;
  for (const { ek, split } of pEksWithSplit) {
    const list = ds.byEk[ek];
    if (candidates === null) {
      candidates = new Set();
      for (let i = 0; i < split; i++) candidates.add(list[i]);
    } else {
      const mark = new Uint8Array(ds.persons.length);
      for (let i = 0; i < split; i++) mark[list[i]] = 1;
      const next = new Set<number>();
      for (const q of candidates) if (mark[q]) next.add(q);
      candidates = next;
    }
    if (candidates.size === 0) break;
  }

  if (!candidates) return [];
  candidates.delete(p);
  const out: NemesisResult[] = [];
  for (const q of candidates) out.push({ personIdx: q, sharedEkCount: pRanks.length });
  return out;
}

function computeINem(ds: NemesizerDataset, p: number, pRanks: RankRef[]): NemesisResult[] {
  const pEksMap = pEksMapOf(pRanks);
  const out: NemesisResult[] = [];
  const ranksByPerson = ds.ranksByPerson;
  for (let q = 0; q < ranksByPerson.length; q++) {
    if (q === p) continue;
    const qRanks = ranksByPerson[q];
    let ok = true;
    for (let i = 0; i < qRanks.length; i++) {
      const r = qRanks[i];
      const ek = r.ev * 2 + r.kind;
      const pRank = pEksMap.get(ek);
      if (pRank === undefined || pRank >= r.rank) { ok = false; break; }
    }
    if (ok) out.push({ personIdx: q, sharedEkCount: qRanks.length });
  }
  return out;
}

function computeNearlyMe(ds: NemesizerDataset, p: number, pRanks: RankRef[]): NemesisResult[] {
  if (pRanks.length < 2) return [];
  const out: NemesisResult[] = [];
  for (let q = 0; q < ds.persons.length; q++) {
    if (q === p) continue;
    let coverage = 0;
    let qWins = 0;
    let qLoses = 0;
    for (const r of pRanks) {
      const ek = r.ev * 2 + r.kind;
      const qRank = ds.rankOfPerson[ek].get(q);
      if (qRank === undefined) break;
      coverage++;
      if (qRank < r.rank) qWins++;
      else qLoses++;
    }
    if (coverage === pRanks.length && qLoses === 1 && qWins === pRanks.length - 1) {
      out.push({ personIdx: q, sharedEkCount: pRanks.length });
    }
  }
  return out;
}

function computeINearly(ds: NemesizerDataset, p: number, pRanks: RankRef[]): NemesisResult[] {
  const pEksMap = pEksMapOf(pRanks);
  const out: NemesisResult[] = [];
  const ranksByPerson = ds.ranksByPerson;
  for (let q = 0; q < ranksByPerson.length; q++) {
    if (q === p) continue;
    const qRanks = ranksByPerson[q];
    if (qRanks.length < 2) continue;
    let coverage = 0;
    let pWins = 0;
    let pLoses = 0;
    for (const r of qRanks) {
      const ek = r.ev * 2 + r.kind;
      const pRank = pEksMap.get(ek);
      if (pRank === undefined) break;
      coverage++;
      if (pRank < r.rank) pWins++;
      else pLoses++;
    }
    if (coverage === qRanks.length && pLoses === 1 && pWins === qRanks.length - 1) {
      out.push({ personIdx: q, sharedEkCount: qRanks.length });
    }
  }
  return out;
}

function computeOnlyJust(ds: NemesizerDataset, p: number, pRanks: RankRef[], invert: boolean): NemesisResult[] {
  const nemeses = invert ? computeINem(ds, p, pRanks) : computeMyNem(ds, p, pRanks);
  const pEksMap = pEksMapOf(pRanks);
  const out: NemesisResult[] = [];
  for (const n of nemeses) {
    let minMargin = Infinity;
    if (!invert) {
      for (const r of pRanks) {
        const ek = r.ev * 2 + r.kind;
        const qRank = ds.rankOfPerson[ek].get(n.personIdx);
        if (qRank === undefined) continue;
        const m = r.rank - qRank;
        if (m < minMargin) minMargin = m;
      }
    } else {
      const qRanks = ds.ranksByPerson[n.personIdx];
      for (const r of qRanks) {
        const ek = r.ev * 2 + r.kind;
        const pRank = pEksMap.get(ek);
        if (pRank === undefined) continue;
        const m = r.rank - pRank;
        if (m < minMargin) minMargin = m;
      }
    }
    if (minMargin === 1) out.push(n);
  }
  return out;
}

export function applyRelation(
  ds: NemesizerDataset,
  p: number,
  view: RelationView,
  override?: RankOverride,
): NemesisResult[] {
  const pRanks = getPersonRanks(ds, p, override);
  if (pRanks.length === 0) return [];
  switch (view) {
    case 'myNem':      return computeMyNem(ds, p, pRanks);
    case 'iNem':       return computeINem(ds, p, pRanks);
    case 'nearlyMe':   return computeNearlyMe(ds, p, pRanks);
    case 'iNearly':    return computeINearly(ds, p, pRanks);
    case 'onlyJustMe': return computeOnlyJust(ds, p, pRanks, false);
    case 'iOnlyJust':  return computeOnlyJust(ds, p, pRanks, true);
  }
}

export function filterByScope(
  ds: NemesizerDataset,
  results: NemesisResult[],
  scope: 'world' | 'continent' | 'country',
  refPerson: number,
): NemesisResult[] {
  if (scope === 'world') return results;
  if (scope === 'country') {
    const iso2 = ds.persons[refPerson].countryIso2;
    return results.filter(r => ds.persons[r.personIdx].countryIso2 === iso2);
  }
  const ci = ds.persons[refPerson].continentIdx;
  return results.filter(r => ds.persons[r.personIdx].continentIdx === ci);
}

function lowerBoundRank(list: Uint32Array, rankMap: Map<number, number>, target: number): number {
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const r = rankMap.get(list[mid])!;
    if (r < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
