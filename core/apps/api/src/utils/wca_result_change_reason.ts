/** Correlation is an inference, not an official explanation. Poll timestamps are
 * observation times; never join arbitrary historical corrections in a round. */
export const RESULT_CHANGE_CORRELATION_MS = 30 * 60_000;

export interface ReasonChange {
  id: string | number;
  wca_id: string;
  competition_id: string | null;
  event_id: string | null;
  round_type_id: string | null;
  change_type: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  detected_at: string;
  source: string | null;
  status: string | null;
  person_name: string | null;
}

interface Fingerprint {
  c: string; e: string; r: string; f: string;
  a: number; b: number; p: number; at: number[];
}

export interface RoundStanding {
  wca_id: string;
  name?: string | null;
  format_id: string;
  pos: number;
  best: number;
  average: number;
  attempts: (number | null)[] | null;
}

interface RoundCause {
  wcaId: string;
  personName: string | null;
  changeType: 'modified' | 'removed' | 'added';
  field: 'average' | 'best';
  oldValue: number | null;
  newValue: number | null;
  oldPlace: number | null;
  newPlace: number | null;
}

export interface RoundPlacementReason {
  kind: 'round_comparison';
  causes: RoundCause[];
}

const STANDARD_FORMATS = ['a', 'm', '1', '2', '3', '5'];

function fingerprint(value: Record<string, unknown> | null): Fingerprint | null {
  if (!value || !['c', 'e', 'r', 'f'].every(key => typeof value[key] === 'string')
    || !['a', 'b', 'p'].every(key => Number.isInteger(value[key]))
    || !Array.isArray(value.at) || !value.at.every(Number.isInteger)) return null;
  return value as unknown as Fingerprint;
}

function sameRound(a: Fingerprint, b: Fingerprint): boolean {
  return a.c === b.c && a.e === b.e && a.r === b.r && a.f === b.f;
}

function sameScores(a: Fingerprint, b: Fingerprint): boolean {
  return a.a === b.a && a.b === b.b && a.at.length === b.at.length
    && a.at.every((value, i) => value === b.at[i]);
}

/** Standard WCA formats: average/mean first, then best as the tie breaker.
 * Missing, DNF and DNS do not beat a valid result. Head-to-head is excluded. */
function ahead(a: Fingerprint, b: Fingerprint): boolean {
  const score = (value: number) => value > 0 ? value : Infinity;
  if (a.f === 'a' || a.f === 'm') {
    if (score(a.a) !== score(b.a)) return score(a.a) < score(b.a);
  }
  return score(a.b) < score(b.b);
}

function placementOnlyPair(change: ReasonChange) {
  const before = fingerprint(change.before_json);
  const after = fingerprint(change.after_json);
  return change.change_type === 'modified' && before && after
    && before.p > 0 && after.p > 0 && before.p !== after.p
    && sameRound(before, after) && sameScores(before, after) ? { before, after } : null;
}

export function isPlacementOnlyChange(change: ReasonChange): boolean {
  return placementOnlyPair(change) !== null;
}

export function roundComparisonPair(change: ReasonChange) {
  const pair = placementOnlyPair(change);
  if (!pair || change.source !== 'auto' || change.status !== 'approved'
    || !STANDARD_FORMATS.includes(pair.before.f)
    || pair.before.c !== change.competition_id || pair.before.e !== change.event_id
    || pair.before.r !== change.round_type_id) return null;
  return pair;
}

function standingFingerprint(row: RoundStanding, target: Fingerprint): Fingerprint {
  return { ...target, a: row.average, b: row.best, p: row.pos, at: row.attempts?.map(value => value ?? 0) ?? [] };
}

function matchesRoundStanding(row: RoundStanding | undefined, target: Fingerprint): boolean {
  if (!row || row.format_id !== target.f || row.pos !== target.p) return false;
  const normalized = (values: number[]) => {
    let length = values.length;
    while (length > 0 && values[length - 1] === 0) length--;
    return values.slice(0, length);
  };
  const standing = standingFingerprint(row, target);
  return sameScores({ ...standing, at: normalized(standing.at) }, { ...target, at: normalized(target.at) });
}

export function matchesRoundBaseline(change: ReasonChange, standings: readonly RoundStanding[]): boolean {
  const pair = placementOnlyPair(change);
  return !!pair && matchesRoundStanding(standings.find(row => row.wca_id === change.wca_id), pair.before);
}

function indexStandings(standings: readonly RoundStanding[], target: Fingerprint) {
  const index = new Map<string, RoundStanding>();
  for (const row of standings) {
    if (typeof row?.wca_id !== 'string' || !row.wca_id || index.has(row.wca_id) || row.format_id !== target.f
      || !Number.isInteger(row.pos) || row.pos <= 0
      || !Number.isInteger(row.best) || !Number.isInteger(row.average)
      || (row.attempts != null && (!Array.isArray(row.attempts)
        || !row.attempts.every(value => value === null || Number.isInteger(value))))) return null;
    index.set(row.wca_id, row);
  }
  // A missing row ahead, duplicated athlete, or partial feed cannot explain a rank.
  return standings.filter(row => row.pos < target.p).length === target.p - 1 ? index : null;
}

/** Explain only crossings supported by both official placements and score order. */
export function compareRoundPlacements(
  change: ReasonChange,
  previous: readonly RoundStanding[],
  current: readonly RoundStanding[],
): RoundPlacementReason | null {
  const pair = roundComparisonPair(change);
  if (!pair) return null;
  const { before, after } = pair;
  const oldRows = indexStandings(previous, before);
  const newRows = indexStandings(current, after);
  if (!oldRows || !newRows || !matchesRoundStanding(oldRows.get(change.wca_id), before)
    || !matchesRoundStanding(newRows.get(change.wca_id), after)) return null;

  const causes: RoundCause[] = [];
  for (const wcaId of new Set([...oldRows.keys(), ...newRows.keys()])) {
    if (wcaId === change.wca_id) continue;
    const old = oldRows.get(wcaId);
    const next = newRows.get(wcaId);
    const wasAhead = !!old && old.pos < before.p;
    const isAhead = !!next && next.pos < after.p;
    if (wasAhead === isAhead) continue;
    const oldScore = old && standingFingerprint(old, before);
    const newScore = next && standingFingerprint(next, after);
    if ((oldScore && ahead(oldScore, before) !== wasAhead)
      || (newScore && ahead(newScore, after) !== isAhead)
      || (oldScore && newScore && sameScores(oldScore, newScore))) return null;
    const byAverage = before.f === 'a' || before.f === 'm';
    const field = byAverage && old?.average !== next?.average ? 'average' : 'best';
    causes.push({
      wcaId, personName: next?.name ?? old?.name ?? null,
      changeType: !old ? 'added' : !next ? 'removed' : 'modified',
      field, oldValue: old?.[field] ?? null, newValue: next?.[field] ?? null,
      oldPlace: old?.pos ?? null, newPlace: next?.pos ?? null,
    });
  }
  if (!causes.length) return null;
  causes.sort((a, b) => (a.oldPlace ?? Infinity) - (b.oldPlace ?? Infinity)
    || (a.newPlace ?? Infinity) - (b.newPlace ?? Infinity) || a.wcaId.localeCompare(b.wcaId));
  return { kind: 'round_comparison', causes };
}

function isCorrelated(change: ReasonChange, candidate: ReasonChange): boolean {
  if (candidate.wca_id === change.wca_id || candidate.source !== 'auto' || candidate.status !== 'approved'
    || candidate.competition_id !== change.competition_id || candidate.event_id !== change.event_id
    || candidate.round_type_id !== change.round_type_id) return false;
  const elapsed = Math.abs(Date.parse(candidate.detected_at) - Date.parse(change.detected_at));
  return elapsed <= RESULT_CHANGE_CORRELATION_MS;
}

/** Only infer a single-time ordering in the results feed. Match outcomes are separate evidence. */
function inferHeadToHeadSingleOrder(change: ReasonChange, before: Fingerprint, after: Fingerprint, candidates: readonly ReasonChange[]) {
  // A single swap can match single-time order by coincidence.
  if (candidates.length < 2) return null;
  const batch = [{ change, before, after }];
  for (const candidate of candidates) {
    const pair = placementOnlyPair(candidate);
    if (!pair || !sameRound(before, pair.before)) return null;
    batch.push({ change: candidate, ...pair });
  }
  if (new Set(batch.map(row => row.change.wca_id)).size !== batch.length
    || new Set(batch.map(row => row.before.p)).size !== batch.length) return null;

  batch.sort((a, b) => a.after.p - b.after.p);
  if (batch.some((row, i) => row.after.b <= 0 || (i > 0
    && (batch[i - 1].after.p === row.after.p || batch[i - 1].after.b >= row.after.b)))) return null;

  let delta = 0;
  const causes = [];
  for (const row of batch) {
    const contribution = Number(row.after.p < after.p) - Number(row.before.p < before.p);
    if (!contribution) continue;
    delta += contribution;
    causes.push({
      changeId: Number(row.change.id), wcaId: row.change.wca_id, personName: row.change.person_name,
      best: row.after.b, oldPlace: row.before.p, newPlace: row.after.p,
    });
  }
  return delta === after.p - before.p ? { kind: 'head_to_head_single_order' as const, causes } : null;
}

export function inferPlacementChangeReason(change: ReasonChange, candidates: readonly ReasonChange[]) {
  const pair = placementOnlyPair(change);
  if (!pair) return null;
  const unknown = { kind: 'unknown' as const, causes: [] };
  const { before, after } = pair;
  if (change.source !== 'auto' || change.status !== 'approved') return unknown;
  const related = candidates.filter(candidate => isCorrelated(change, candidate));
  if (before.f === 'h') return inferHeadToHeadSingleOrder(change, before, after, related) ?? unknown;
  if (!STANDARD_FORMATS.includes(before.f)) return unknown;
  const causes = [];
  const seen = new Set<string>();
  let delta = 0;
  for (const candidate of related) {
    const old = fingerprint(candidate.before_json);
    const next = fingerprint(candidate.after_json);
    if (!old || !sameRound(before, old)) continue;
    const removed = candidate.change_type === 'removed' && candidate.after_json === null;
    if (!removed && (candidate.change_type !== 'modified' || !next
      || !sameRound(old, next) || sameScores(old, next))) continue;
    // Multiple revisions of one opponent in this window are ambiguous.
    if (seen.has(candidate.wca_id)) return unknown;
    seen.add(candidate.wca_id);
    const contribution = Number(!removed && ahead(next!, after)) - Number(ahead(old, before));
    if (!contribution) continue;
    delta += contribution;
    const field = (before.f === 'a' || before.f === 'm') && (removed || old.a !== next!.a)
      ? 'average' as const : 'best' as const;
    causes.push({
      changeId: Number(candidate.id), wcaId: candidate.wca_id, personName: candidate.person_name,
      changeType: removed ? 'removed' as const : 'modified' as const,
      field, oldValue: field === 'average' ? old.a : old.b,
      newValue: removed ? null : field === 'average' ? next!.a : next!.b,
      oldPlace: old.p, newPlace: removed ? null : next!.p,
    });
  }
  // The evidence must account for the entire displacement, not just its direction.
  return causes.length > 0 && delta === after.p - before.p
    ? { kind: 'inferred' as const, causes } : unknown;
}
