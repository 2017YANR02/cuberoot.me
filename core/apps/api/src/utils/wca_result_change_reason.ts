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

export function isPlacementOnlyChange(change: ReasonChange): boolean {
  const before = fingerprint(change.before_json);
  const after = fingerprint(change.after_json);
  return change.change_type === 'modified' && !!before && !!after
    && before.p > 0 && after.p > 0 && before.p !== after.p
    && sameRound(before, after) && sameScores(before, after);
}

export function inferPlacementChangeReason(change: ReasonChange, candidates: readonly ReasonChange[]) {
  if (!isPlacementOnlyChange(change)) return null;
  const unknown = { kind: 'unknown' as const, causes: [] };
  const before = fingerprint(change.before_json)!;
  const after = fingerprint(change.after_json)!;
  // Manual annotations and head-to-head brackets need explicit evidence.
  if (change.source !== 'auto' || change.status !== 'approved'
    || !['a', 'm', '1', '2', '3', '5'].includes(before.f)) return unknown;
  const causes = [];
  const seen = new Set<string>();
  let delta = 0;
  for (const candidate of candidates) {
    if (candidate.wca_id === change.wca_id || candidate.source !== 'auto' || candidate.status !== 'approved'
      || candidate.competition_id !== change.competition_id || candidate.event_id !== change.event_id
      || candidate.round_type_id !== change.round_type_id) continue;
    const elapsed = Math.abs(Date.parse(candidate.detected_at) - Date.parse(change.detected_at));
    if (!Number.isFinite(elapsed) || elapsed > RESULT_CHANGE_CORRELATION_MS) continue;
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
