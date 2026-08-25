/**
 * Server-side nemesis algorithm — direct port of client/.../nemesizerAlgo.ts.
 *
 * Q is a nemesis of P iff E_P ⊆ E_Q AND ∀ ek ∈ E_P : rank_Q(ek) < rank_P(ek).
 * Reverse iNem: E_Q ⊆ E_P, P strictly better in every E_Q ek.
 * NearlyMe: same coverage as myNem but wins all but 1 of E_P's eks.
 * INearly: same coverage as iNem but P wins all but 1 of E_Q's eks.
 * OnlyJust: strict nemesis with min margin == 1.
 *
 * Reads the compact dataset via accessors (personRanks / rankInEk) and, on the
 * hot all-persons loops, walks the CSR rank arrays directly (no per-rank object).
 */
import { personRanks, rankInEk, type NemesizerDataset, type RankRef } from './loader.js';

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
  if (!override || override.size === 0) return personRanks(ds, p);
  const base = personRanks(ds, p);
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
    const split = lowerBoundRank(ds.byEkRank[ek], r.rank);
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
  const N = ds.persons.length;
  for (let q = 0; q < N; q++) {
    if (q === p) continue;
    const lo = ds.rbpOff[q], hi = ds.rbpOff[q + 1];
    let ok = true;
    for (let j = lo; j < hi; j++) {
      const ek = ds.rbpEv[j] * 2 + ds.rbpKind[j];
      const pRank = pEksMap.get(ek);
      if (pRank === undefined || pRank >= ds.rbpRank[j]) { ok = false; break; }
    }
    if (ok) out.push({ personIdx: q, sharedEkCount: hi - lo });
  }
  return out;
}

function computeNearlyMe(ds: NemesizerDataset, p: number, pRanks: RankRef[]): NemesisResult[] {
  if (pRanks.length < 2) return [];
  const out: NemesisResult[] = [];
  const N = ds.persons.length;
  for (let q = 0; q < N; q++) {
    if (q === p) continue;
    let coverage = 0;
    let qWins = 0;
    let qLoses = 0;
    for (const r of pRanks) {
      const ek = r.ev * 2 + r.kind;
      const qRank = rankInEk(ds, ek, q);
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
  const N = ds.persons.length;
  for (let q = 0; q < N; q++) {
    if (q === p) continue;
    const lo = ds.rbpOff[q], hi = ds.rbpOff[q + 1];
    const len = hi - lo;
    if (len < 2) continue;
    let coverage = 0;
    let pWins = 0;
    let pLoses = 0;
    for (let j = lo; j < hi; j++) {
      const ek = ds.rbpEv[j] * 2 + ds.rbpKind[j];
      const pRank = pEksMap.get(ek);
      if (pRank === undefined) break;
      coverage++;
      if (pRank < ds.rbpRank[j]) pWins++;
      else pLoses++;
    }
    if (coverage === len && pLoses === 1 && pWins === len - 1) {
      out.push({ personIdx: q, sharedEkCount: len });
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
        const qRank = rankInEk(ds, ek, n.personIdx);
        if (qRank === undefined) continue;
        const m = r.rank - qRank;
        if (m < minMargin) minMargin = m;
      }
    } else {
      const lo = ds.rbpOff[n.personIdx], hi = ds.rbpOff[n.personIdx + 1];
      for (let j = lo; j < hi; j++) {
        const ek = ds.rbpEv[j] * 2 + ds.rbpKind[j];
        const pRank = pEksMap.get(ek);
        if (pRank === undefined) continue;
        const m = ds.rbpRank[j] - pRank;
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

/** First index i where rankArr[i] >= target (rankArr is ascending). */
function lowerBoundRank(rankArr: Uint32Array, target: number): number {
  let lo = 0, hi = rankArr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rankArr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
