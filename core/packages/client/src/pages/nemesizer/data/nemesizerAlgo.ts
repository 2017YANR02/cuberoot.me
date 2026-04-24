// Nemesis computation algorithms.
//
// Definition: Q is a nemesis of P iff:
//   1. E_P ∩ E_Q ≠ ∅  (they share ≥ 1 event+kind)
//   2. ∀ ek ∈ E_P ∩ E_Q : rank_Q(ek) < rank_P(ek)
//
// Reverse: P nemesizes Q ⟺ Q is a nemesis of P with roles swapped
// (E_P ∩ E_Q ≠ ∅ and ∀ shared ek: rank_P(ek) < rank_Q(ek)).
//
// "Nearly nemesis": Q is better than P in all shared ek EXCEPT at most 1.
// "Only just nemesis": Q is nemesis of P AND max(rank_P(ek) - rank_Q(ek)) == 1.
import type { NemesizerDataset, RankRef } from './nemesizerData';

export type RelationView =
  | 'myNem'        // who are my nemeses (people better than me in every shared ek)
  | 'iNem'         // who I nemesize (I'm better than them in every shared ek)
  | 'nearlyMe'     // who nearly nemesizes me (all except 1 shared ek)
  | 'iNearly'      // who I nearly nemesize
  | 'onlyJustMe'   // who only-just nemesizes me
  | 'iOnlyJust';   // who I only-just nemesize

export interface NemesisResult {
  personIdx: number;
  sharedEkCount: number;
}

// Override map for what-if: (ev*2+kind) -> rank. If rank is 0 or negative, treat as "no rank".
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

function getRankAt(ds: NemesizerDataset, person: number, ek: number, override?: RankOverride): number | undefined {
  if (override?.has(ek)) {
    const v = override.get(ek)!;
    return v > 0 ? v : undefined;
  }
  return ds.rankOfPerson[ek].get(person);
}

// Given a target person P, compute "who is better than P in every shared ek".
// If invert=true, compute "who is worse than P in every shared ek" (= who P nemesizes).
// Uses prefix / suffix of each ek's sorted list.
export function computeNemesisOf(
  ds: NemesizerDataset,
  p: number,
  opts: { invert?: boolean; override?: RankOverride } = {},
): NemesisResult[] {
  const { invert = false, override } = opts;
  const pRanks = getPersonRanks(ds, p, override);
  if (pRanks.length === 0) return [];

  // "Winning side": set of Q who have a rank in this ek on the winning side vs P.
  // - Direct (invert=false): Q wins ⇔ rank_Q < rank_P → list prefix.
  // - Reverse (invert=true): P wins ⇔ rank_P < rank_Q → list suffix after P.
  // "Losing side": Q who have a rank in this ek on the losing side vs P.
  //
  // nemesis = (union of Q winning in ≥ 1 ek in E_P) \ (union of Q losing in ≥ 1 ek in E_P)

  const candidates = new Set<number>();     // union of winners
  const disqualified = new Uint8Array(ds.persons.length);  // union of losers

  for (const { ev, kind, rank } of pRanks) {
    const ek = ev * 2 + kind;
    const list = ds.byEk[ek];
    const rankMap = ds.rankOfPerson[ek];
    // find index range where rank < our rank (prefix)
    const splitBetter = lowerBoundRank(list, rankMap, rank);  // list[i].rank < rank for i<splitBetter
    if (!invert) {
      for (let i = 0; i < splitBetter; i++) candidates.add(list[i]);
      for (let i = splitBetter; i < list.length; i++) disqualified[list[i]] = 1;
    } else {
      for (let i = splitBetter; i < list.length; i++) candidates.add(list[i]);
      for (let i = 0; i < splitBetter; i++) disqualified[list[i]] = 1;
    }
  }

  const out: NemesisResult[] = [];
  for (const q of candidates) {
    if (q === p) continue;
    if (disqualified[q]) continue;
    // count shared eks
    let shared = 0;
    for (const { ev, kind } of ds.ranksByPerson[q]) {
      if (getRankAt(ds, p, ev * 2 + kind, override) !== undefined) shared++;
    }
    if (shared > 0) out.push({ personIdx: q, sharedEkCount: shared });
  }
  return out;
}

// Nearly: Q is better than P in all shared ek except exactly 1 (that 1 is strictly worse; rest strictly better).
// invert: P is the one failing by exactly 1 vs Q (i.e. I nearly nemesize Q).
export function computeNearlyNemesis(
  ds: NemesizerDataset,
  p: number,
  opts: { invert?: boolean; override?: RankOverride } = {},
): NemesisResult[] {
  const { invert = false, override } = opts;
  const pRanks = getPersonRanks(ds, p, override);
  if (pRanks.length === 0) return [];

  // Candidate pool = anyone who shares ≥ 1 ek with P and wins at least 1 shared ek (against P if invert=false, or P wins if invert=true).
  const pool = new Set<number>();
  for (const { ev, kind, rank } of pRanks) {
    const ek = ev * 2 + kind;
    const list = ds.byEk[ek];
    const rankMap = ds.rankOfPerson[ek];
    const split = lowerBoundRank(list, rankMap, rank);
    if (!invert) {
      for (let i = 0; i < split; i++) pool.add(list[i]);
      for (let i = split; i < list.length; i++) pool.add(list[i]);
    } else {
      for (let i = 0; i < list.length; i++) pool.add(list[i]);
    }
  }

  const out: NemesisResult[] = [];
  for (const q of pool) {
    if (q === p) continue;
    let sharedTotal = 0;
    let qLoses = 0;
    let qWins = 0;
    for (const { ev, kind, rank: qRank } of ds.ranksByPerson[q]) {
      const ek = ev * 2 + kind;
      const pRank = getRankAt(ds, p, ek, override);
      if (pRank === undefined) continue;
      sharedTotal++;
      if (!invert) {
        // Nearly nemesis of P: Q should win all but 1
        if (qRank < pRank) qWins++;
        else qLoses++;
      } else {
        // I nearly nemesize Q: P wins all but 1
        if (pRank < qRank) qWins++;  // P wins
        else qLoses++;                // P loses
      }
    }
    if (sharedTotal >= 2 && qLoses === 1 && qWins === sharedTotal - 1) {
      out.push({ personIdx: q, sharedEkCount: sharedTotal });
    }
  }
  return out;
}

// Only just nemesis: full nemesis relation AND the minimum margin is exactly 1 rank.
export function computeOnlyJustNemesis(
  ds: NemesizerDataset,
  p: number,
  opts: { invert?: boolean; override?: RankOverride } = {},
): NemesisResult[] {
  const { invert = false, override } = opts;
  const nemeses = computeNemesisOf(ds, p, opts);
  const out: NemesisResult[] = [];
  for (const n of nemeses) {
    const q = n.personIdx;
    let minMargin = Infinity;
    for (const { ev, kind, rank: qRank } of ds.ranksByPerson[q]) {
      const ek = ev * 2 + kind;
      const pRank = getRankAt(ds, p, ek, override);
      if (pRank === undefined) continue;
      const margin = invert ? qRank - pRank : pRank - qRank;
      if (margin < minMargin) minMargin = margin;
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
  switch (view) {
    case 'myNem':      return computeNemesisOf(ds, p, { invert: false, override });
    case 'iNem':       return computeNemesisOf(ds, p, { invert: true, override });
    case 'nearlyMe':   return computeNearlyNemesis(ds, p, { invert: false, override });
    case 'iNearly':    return computeNearlyNemesis(ds, p, { invert: true, override });
    case 'onlyJustMe': return computeOnlyJustNemesis(ds, p, { invert: false, override });
    case 'iOnlyJust':  return computeOnlyJustNemesis(ds, p, { invert: true, override });
  }
}

// Scope filter: given list, keep only those matching scope.
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

// Binary search: return first index i such that rankMap.get(list[i]) >= target.
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
