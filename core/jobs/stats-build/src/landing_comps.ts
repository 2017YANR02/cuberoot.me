export interface LandingCompRecord {
  id: string;
  start_date: string;
  end_date?: string;
  [key: string]: unknown;
}

// The homepage renders a 30-day past window. Keep twice that range so a delayed
// history refresh cannot make entries disappear between pipeline runs.
export const LANDING_HISTORY_DAYS = 60;

function assertSource(name: string, comps: readonly LandingCompRecord[]): void {
  const ids = new Set<string>();
  for (const comp of comps) {
    if (!comp.id || !/^\d{4}-\d{2}-\d{2}$/.test(comp.start_date)) {
      throw new Error(`${name}: invalid competition identity/date`);
    }
    if (comp.end_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(comp.end_date)) {
      throw new Error(`${name}: invalid competition end date`);
    }
    if (ids.has(comp.id)) throw new Error(`${name}: duplicate competition id ${comp.id}`);
    ids.add(comp.id);
  }
}

export function buildLandingPastComps(
  past: readonly LandingCompRecord[],
  nowMs = Date.now(),
): LandingCompRecord[] {
  assertSource('all_past_comps', past);

  const cutoffDate = new Date(nowMs);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - LANDING_HISTORY_DAYS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  return past.filter((comp) => (comp.end_date || comp.start_date) >= cutoff).sort((a, b) =>
    a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id),
  );
}
