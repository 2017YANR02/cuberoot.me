import { buildRowChangeListMap, effectiveAttemptPenalties, isApprovedChange, type ResultChange } from './result-watch-api';

/** Per-person, per-attempt final changes. Summary/best/average fields are not extra solves.
 * Penalty annotations describe the same correction as attempt deltas, so never add them twice.
 */
export function summarizeResultChanges(changes: ResultChange[]) {
  const penalties = new Map<number, number>();
  let dnf = 0;
  let cancelled = 0;
  for (const chain of buildRowChangeListMap(changes.filter(isApprovedChange)).values()) {
    const latest = chain.at(-1)!;
    if (latest.changeType === 'removed') {
      cancelled += (latest.before?.at ?? []).filter(value => value !== 0).length;
      continue;
    }
    const originals = new Map<number, number>();
    const current = new Map<number, number>();
    for (const change of chain) {
      const field = change.fields?.find(field => field.field === 'attempts');
      const oldValues = Array.isArray(field?.old) ? field.old : change.before?.at;
      const newValues = Array.isArray(field?.new) ? field.new : change.after?.at;
      if (!oldValues || !newValues) continue;
      for (let index = 0; index < Math.max(oldValues.length, newValues.length); index++) {
        const oldValue = oldValues[index];
        const newValue = newValues[index];
        if (typeof oldValue !== 'number' || typeof newValue !== 'number') continue;
        if (!originals.has(index)) originals.set(index, oldValue);
        current.set(index, newValue);
      }
    }
    const annotations = effectiveAttemptPenalties(chain);
    const timed = !['333fm', '333mbf', '333mbo'].includes(latest.eventId ?? '');
    const indices = new Set([...current.keys(), ...annotations.keys()]);
    for (const index of indices) {
      const oldValue = originals.get(index);
      const newValue = current.get(index);
      if (oldValue != null && oldValue > 0 && newValue === -1) { dnf++; continue; }
      if (!timed || (newValue != null && newValue <= 0)) continue;
      const delta = oldValue != null && oldValue > 0 && newValue != null && newValue > 0
        ? newValue - oldValue : 0;
      // If an actual attempt changed, its net difference wins over descriptive metadata.
      const penalty = delta !== 0 ? delta : annotations[index] ?? 0;
      if (penalty > 0 && Number.isInteger(penalty) && penalty % 200 === 0) {
        penalties.set(penalty / 100, (penalties.get(penalty / 100) ?? 0) + 1);
      }
    }
  }
  return { penalties: [...penalties].sort(([a], [b]) => a - b), dnf, cancelled };
}
