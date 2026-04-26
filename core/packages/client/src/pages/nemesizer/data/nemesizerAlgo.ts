// Nemesis computation algorithms — strict definition matching nemesizer.com.
//
// Q is a nemesis of P iff:
//   1. E_P ⊆ E_Q  (Q has rank in every event-kind P competes in)
//   2. ∀ ek ∈ E_P : rank_Q(ek) < rank_P(ek)  (Q strictly better in each)
//
// Reverse: P nemesizes Q ⟺ Q is a nemesis of P with roles swapped, i.e.
// E_Q ⊆ E_P and ∀ ek ∈ E_Q : rank_P(ek) < rank_Q(ek). Note the asymmetry —
// the *event-coverage* requirement flips with the roles.
//
// "Nearly nemesis" of P: same coverage requirement (E_P ⊆ E_Q), strictly better
// in pRanks.length - 1 of P's eks, ties or loses in exactly 1.
// Reverse "I nearly nemesize Q": E_Q ⊆ E_P, P wins on qRanks.length - 1, loses 1.
//
// "Only just nemesis": strict nemesis with min margin (P_rank - Q_rank over E_P)
// equal to 1.
//
// IMPORTANT: rank comparison `rank_Q < rank_P` is equivalent to "Q's PB strictly
// better than P's PB" only when the rank generator collapses ties (RANK / DENSE_RANK,
// not ROW_NUMBER). The build pipeline in stats-build/bin/nemesizer.ts uses RANK().
import type { NemesizerDataset, RankRef } from './nemesizerData';

export type RelationView =
  | 'myNem'        // who are my nemeses (E_P ⊆ E_Q, Q strictly better in every E_P ek)
  | 'iNem'         // who I nemesize (E_Q ⊆ E_P, P strictly better in every E_Q ek)
  | 'nearlyMe'     // who nearly nemesizes me (E_P ⊆ E_Q, Q wins all but 1 E_P ek)
  | 'iNearly'      // who I nearly nemesize (E_Q ⊆ E_P, P wins all but 1 E_Q ek)
  | 'onlyJustMe'   // who only-just nemesizes me (strict nemesis with min margin == 1)
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

// Build "ek → P's rank" map from a (possibly overridden) pRanks list.
function pEksMapOf(pRanks: RankRef[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of pRanks) m.set(r.ev * 2 + r.kind, r.rank);
  return m;
}

// Forward strict nemesis: Q has rank in every E_P ek AND is strictly better in each.
// Computed by intersecting "strict-better prefix" sets across E_P, smallest-first
// for fast convergence (the Python ref's approach).
function computeMyNem(
  ds: NemesizerDataset,
  p: number,
  pRanks: RankRef[],
): NemesisResult[] {
  // Precompute (ek, prefix-split) per pRank, sorted by prefix size ascending.
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
      // Mark "this ek's strict-better" set, then intersect.
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

// Reverse strict nemesis: E_Q ⊆ E_P AND P strictly better in every E_Q ek.
// Iterate persons; cheap rejection on the first non-conforming Q ek.
//
// NOTE: a person with 0 ranks (registered but never had a positive `best`,
// e.g. someone who DNF'd every attempt at their only competition) is included:
// E_Q = ∅ ⊆ E_P trivially, ∀ ek ∈ E_Q is vacuous. Matches nemesizer.com.
function computeINem(
  ds: NemesizerDataset,
  p: number,
  pRanks: RankRef[],
): NemesisResult[] {
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

// Forward "nearly": Q has every E_P ek; wins all but 1; ties/loses exactly 1.
function computeNearlyMe(
  ds: NemesizerDataset,
  p: number,
  pRanks: RankRef[],
): NemesisResult[] {
  if (pRanks.length < 2) return [];  // need ≥ 2 eks to "miss by 1"
  const out: NemesisResult[] = [];
  // Iterate all persons; for each Q check the strict coverage + 1-loss criterion over E_P.
  for (let q = 0; q < ds.persons.length; q++) {
    if (q === p) continue;
    let coverage = 0;
    let qWins = 0;
    let qLoses = 0;
    for (const r of pRanks) {
      const ek = r.ev * 2 + r.kind;
      const qRank = ds.rankOfPerson[ek].get(q);
      if (qRank === undefined) break;  // Q lacks this E_P ek → not "nearly"
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

// Reverse "nearly": E_Q ⊆ E_P; P wins all but 1; ties/loses exactly 1 over E_Q.
function computeINearly(
  ds: NemesizerDataset,
  p: number,
  pRanks: RankRef[],
): NemesisResult[] {
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
      if (pRank === undefined) break;  // Q has ek P doesn't → not E_Q ⊆ E_P
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

// Only-just: strict nemesis where min margin (over the relevant ek set) is 1.
// For myNem: margins computed over E_P; for iNem: over E_Q.
function computeOnlyJust(
  ds: NemesizerDataset,
  p: number,
  pRanks: RankRef[],
  invert: boolean,
): NemesisResult[] {
  const nemeses = invert ? computeINem(ds, p, pRanks) : computeMyNem(ds, p, pRanks);
  const pEksMap = pEksMapOf(pRanks);
  const out: NemesisResult[] = [];
  for (const n of nemeses) {
    let minMargin = Infinity;
    if (!invert) {
      // Margin = pRank - qRank over E_P
      for (const r of pRanks) {
        const ek = r.ev * 2 + r.kind;
        const qRank = ds.rankOfPerson[ek].get(n.personIdx);
        if (qRank === undefined) continue;  // shouldn't happen given strict nemesis
        const m = r.rank - qRank;
        if (m < minMargin) minMargin = m;
      }
    } else {
      // Margin = qRank - pRank over E_Q
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

export function computeNemesisOf(
  ds: NemesizerDataset,
  p: number,
  opts: { invert?: boolean; override?: RankOverride } = {},
): NemesisResult[] {
  const pRanks = getPersonRanks(ds, p, opts.override);
  if (pRanks.length === 0) return [];
  return opts.invert ? computeINem(ds, p, pRanks) : computeMyNem(ds, p, pRanks);
}

export function computeNearlyNemesis(
  ds: NemesizerDataset,
  p: number,
  opts: { invert?: boolean; override?: RankOverride } = {},
): NemesisResult[] {
  const pRanks = getPersonRanks(ds, p, opts.override);
  if (pRanks.length === 0) return [];
  return opts.invert ? computeINearly(ds, p, pRanks) : computeNearlyMe(ds, p, pRanks);
}

export function computeOnlyJustNemesis(
  ds: NemesizerDataset,
  p: number,
  opts: { invert?: boolean; override?: RankOverride } = {},
): NemesisResult[] {
  const pRanks = getPersonRanks(ds, p, opts.override);
  if (pRanks.length === 0) return [];
  return computeOnlyJust(ds, p, pRanks, opts.invert ?? false);
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
